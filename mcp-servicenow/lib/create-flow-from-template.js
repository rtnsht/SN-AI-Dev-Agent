#!/usr/bin/env node
/**
 * Flow Designer Template System
 * 
 * Creates flows from pre-defined templates with customizable variables.
 * Templates are stored in ./flow-templates/ directory.
 * 
 * Usage:
 *   node lib/create-flow-from-template.js <template-name> [options]
 *   node lib/create-flow-from-template.js --list
 * 
 * Options:
 *   --list              List available templates
 *   --var KEY=VALUE     Set template variable
 *   --dry-run           Show what would be created without creating
 * 
 * Examples:
 *   node lib/create-flow-from-template.js --list
 *   node lib/create-flow-from-template.js service-catalog-trigger --var FLOW_NAME="My Flow"
 */
import * as dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

const TEMPLATES_DIR = path.join(__dirname, 'flow-templates');

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        templateName: null,
        list: false,
        dryRun: false,
        variables: {}
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--list' || arg === '-l') {
            options.list = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--var' || arg === '-v') {
            const varDef = args[++i];
            if (varDef) {
                const [key, ...valueParts] = varDef.split('=');
                options.variables[key] = valueParts.join('=');
            }
        } else if (!arg.startsWith('-') && !options.templateName) {
            options.templateName = arg;
        }
    }

    return options;
}

/**
 * List available templates
 */
function listTemplates() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║            Available Flow Templates                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    if (!fs.existsSync(TEMPLATES_DIR)) {
        console.log('   No templates directory found.');
        return;
    }

    const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
    
    if (files.length === 0) {
        console.log('   No templates found in', TEMPLATES_DIR);
        return;
    }

    for (const file of files) {
        const templatePath = path.join(TEMPLATES_DIR, file);
        const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        const name = file.replace('.json', '');
        
        console.log(`📋 ${name}`);
        console.log(`   ${template.description}`);
        console.log(`   Type: ${template.template_type}`);
        console.log(`   Variables:`);
        for (const [key, defaultVal] of Object.entries(template.variables || {})) {
            console.log(`      ${key}: ${defaultVal || '(required)'}`);
        }
        console.log();
    }
    
    console.log('Usage: node lib/create-flow-from-template.js <template-name> [--var KEY=VALUE]');
}

/**
 * Load a template
 */
function loadTemplate(name) {
    const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);
    if (!fs.existsSync(templatePath)) {
        console.error(`❌ Template not found: ${name}`);
        console.error(`   Available templates in: ${TEMPLATES_DIR}`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(templatePath, 'utf8'));
}

/**
 * Replace template variables in an object
 */
function replaceVariables(obj, variables) {
    if (typeof obj === 'string') {
        let result = obj;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
        return result;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => replaceVariables(item, variables));
    }
    if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = replaceVariables(value, variables);
        }
        return result;
    }
    return obj;
}

/**
 * Create a record in ServiceNow
 */
async function createRecord(table, fields) {
    const response = await axios.post(
        `${instanceUrl}/api/now/table/${table}`,
        fields,
        { auth, headers }
    );
    return response.data.result;
}

/**
 * Create a flow from template
 */
async function createFlowFromTemplate(template, variables, dryRun = false) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║        Flow Designer Template Creator                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n🌐 Instance: ${instanceUrl}`);
    console.log(`📋 Template: ${template.name}`);
    console.log(`🔧 Mode: ${dryRun ? 'DRY RUN' : 'CREATE'}\n`);

    // Merge template defaults with provided variables
    const mergedVars = { ...template.variables, ...variables };
    console.log('Variables:');
    for (const [key, value] of Object.entries(mergedVars)) {
        console.log(`   ${key}: ${value || '(not set)'}`);
    }

    // Replace variables in template
    const processedFlow = replaceVariables(template.flow.fields, mergedVars);
    const processedTrigger = replaceVariables(template.trigger.fields, mergedVars);
    const processedActions = replaceVariables(template.actions, mergedVars);
    const processedStages = replaceVariables(template.stages, mergedVars);

    if (dryRun) {
        console.log('\n' + '═'.repeat(60));
        console.log('📋 DRY RUN - Would create:\n');
        console.log('Flow:', JSON.stringify(processedFlow, null, 2));
        console.log('\nTrigger:', JSON.stringify(processedTrigger, null, 2));
        console.log('\nActions:', JSON.stringify(processedActions, null, 2));
        console.log('\nStages:', JSON.stringify(processedStages, null, 2));
        return;
    }

    const created = { flow: null, trigger: null, actions: [], stages: [] };

    try {
        // 1. Create flow
        console.log('\n1️⃣  Creating flow...');
        created.flow = await createRecord('sys_hub_flow', processedFlow);
        console.log(`   ✅ Flow created: ${created.flow.sys_id}`);
        const flowId = created.flow.sys_id;

        // 2. Create trigger
        console.log('\n2️⃣  Creating trigger...');
        const triggerFields = { ...processedTrigger, flow: flowId };
        created.trigger = await createRecord('sys_hub_trigger_instance', triggerFields);
        console.log(`   ✅ Trigger created: ${created.trigger.sys_id}`);

        // 3. Create stages
        console.log('\n3️⃣  Creating stages...');
        for (const stage of processedStages) {
            const stageFields = { ...stage, flow: flowId };
            const createdStage = await createRecord('sys_hub_flow_stage', stageFields);
            created.stages.push(createdStage);
            console.log(`   ✅ Stage: ${stage.label}`);
        }

        // 4. Create actions
        console.log('\n4️⃣  Creating action instances...');
        for (const action of processedActions) {
            const actionFields = {
                flow: flowId,
                name: action.name,
                action_type: action.action_type,
                compiled_snapshot: action.action_type,
                order: action.order
            };
            const createdAction = await createRecord('sys_hub_action_instance', actionFields);
            created.actions.push(createdAction);
            console.log(`   ✅ Action: ${action.name} (order: ${action.order})`);
        }

        // Summary
        console.log('\n' + '═'.repeat(60));
        console.log('📊 CREATION SUMMARY');
        console.log('═'.repeat(60));
        console.log(`   Flow:     ${created.flow.name} (${created.flow.sys_id})`);
        console.log(`   Trigger:  ${created.trigger.name}`);
        console.log(`   Stages:   ${created.stages.length}`);
        console.log(`   Actions:  ${created.actions.length}`);

        console.log('\n📋 NEXT STEPS');
        console.log('═'.repeat(60));
        console.log(`   1. Open Flow Designer to configure trigger conditions:`);
        console.log(`      ${instanceUrl}/sys_hub.do?sys_id=${flowId}`);
        console.log(`   2. Configure action inputs as needed`);
        console.log(`   3. Click "Activate" to publish the flow`);
        console.log(`   4. Or use: node lib/activate-flow.js ${flowId}`);

        return created;

    } catch (err) {
        console.error('\n❌ Error creating flow:', err.response?.data?.error?.message || err.message);

        // Cleanup on failure
        if (created.flow) {
            console.log('\n🧹 Cleaning up partial creation...');
            try {
                await axios.delete(
                    `${instanceUrl}/api/now/table/sys_hub_flow/${created.flow.sys_id}`,
                    { auth, headers }
                );
                console.log('   Deleted partial flow');
            } catch (e) {
                console.log('   Failed to cleanup:', e.message);
            }
        }

        throw err;
    }
}

/**
 * Main execution
 */
async function main() {
    const options = parseArgs();

    if (options.list) {
        listTemplates();
        return;
    }

    if (!options.templateName) {
        console.log('Flow Designer Template System');
        console.log('============================\n');
        console.log('Usage:');
        console.log('  node lib/create-flow-from-template.js --list');
        console.log('  node lib/create-flow-from-template.js <template-name> [options]\n');
        console.log('Options:');
        console.log('  --list              List available templates');
        console.log('  --var KEY=VALUE     Set template variable');
        console.log('  --dry-run           Show what would be created without creating\n');
        console.log('Examples:');
        console.log('  node lib/create-flow-from-template.js --list');
        console.log('  node lib/create-flow-from-template.js service-catalog-trigger');
        console.log('  node lib/create-flow-from-template.js record-trigger --var FLOW_NAME="Incident Alert" --var TABLE_NAME=incident');
        process.exit(1);
    }

    const template = loadTemplate(options.templateName);
    await createFlowFromTemplate(template, options.variables, options.dryRun);
}

main().catch(e => {
    console.error('\n❌ Error:', e.response?.data || e.message);
    process.exit(1);
});

