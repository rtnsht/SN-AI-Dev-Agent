/**
 * Setup script for UI Policy Action Helper API
 * Creates a Scripted REST API that uses GlideRecord to properly populate all fields
 */
const axios = require('axios');
require('dotenv').config();

const url = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };

const apiScript = `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var body = request.body.data;
    var uiPolicySysId = body.ui_policy || '';
    var table = body.table || '';
    var field = body.field || '';
    var mandatory = body.mandatory || 'ignore';
    var visible = body.visible || 'ignore';
    var disabled = body.disabled || 'ignore';
    
    if (!uiPolicySysId || !table || !field) {
        response.setStatus(400);
        return { error: 'Missing required fields: ui_policy, table, field' };
    }
    
    var gr = new GlideRecord('sys_ui_policy_action');
    gr.initialize();
    gr.setValue('ui_policy', uiPolicySysId);
    gr.setValue('table', table);
    gr.setValue('field', field);
    gr.setValue('mandatory', mandatory);
    gr.setValue('visible', visible);
    gr.setValue('disabled', disabled);
    var sysId = gr.insert();
    
    if (sysId) {
        return { success: true, sys_id: sysId };
    } else {
        response.setStatus(500);
        return { error: 'Failed to create UI Policy Action' };
    }
})(request, response);`;

async function setup() {
    console.log('Setting up UI Policy Action Helper API...');
    
    // Check if API already exists
    const existing = await axios.get(url + '/api/now/table/sys_ws_definition', {
        auth,
        params: { sysparm_query: 'service_id=ui_policy_action_helper', sysparm_limit: 1 }
    });
    
    if (existing.data.result.length > 0) {
        console.log('API already exists:', existing.data.result[0].sys_id);
        const ns = existing.data.result[0].api_namespace || 'global';
        console.log('Endpoint: POST ' + url + '/api/' + ns + '/ui_policy_action_helper/create');
        return;
    }
    
    // Create API Definition
    const apiDef = await axios.post(url + '/api/now/table/sys_ws_definition', {
        name: 'UIPolicyActionHelper',
        service_id: 'ui_policy_action_helper',
        active: true,
        short_description: 'Helper API to create UI Policy Actions with proper field population'
    }, { auth, headers: { 'Content-Type': 'application/json' } });
    
    const apiId = apiDef.data.result.sys_id;
    const namespace = apiDef.data.result.api_namespace || 'global';
    console.log('Created API Definition:', apiId, 'namespace:', namespace);
    
    // Create Resource
    await axios.post(url + '/api/now/table/sys_ws_operation', {
        web_service_definition: apiId,
        name: 'createUiPolicyAction',
        http_method: 'POST',
        relative_path: '/create',
        active: true,
        operation_script: apiScript,
        short_description: 'Create UI Policy Action with GlideRecord'
    }, { auth, headers: { 'Content-Type': 'application/json' } });
    
    console.log('Created Resource /create');
    console.log('\nEndpoint: POST ' + url + '/api/' + namespace + '/ui_policy_action_helper/create');
    console.log('\nExample body:');
    console.log(JSON.stringify({
        ui_policy: '<sys_id>',
        table: 'incident',
        field: 'short_description',
        mandatory: 'true',
        visible: 'ignore',
        disabled: 'ignore'
    }, null, 2));
}

setup().catch(e => {
    console.error('Error:', e.response?.data?.error || e.message);
});

