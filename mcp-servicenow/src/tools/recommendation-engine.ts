/**
 * AI-Powered Recommendation Engine
 * 
 * Provides rich context, patterns, and templates to help the consuming AI
 * generate better ServiceNow-specific recommendations and fixes.
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// =============================================================================
// SCHEMAS
// =============================================================================

export const getFixRecommendationsSchema = z.object({
  issueType: z.enum([
    'gr_in_client',
    'hardcoded_sysid',
    'missing_null_check',
    'synchronous_ajax',
    'global_business_rule',
    'empty_catch',
    'current_update_loop',
    'no_setworkflow',
    'eval_usage',
    'document_write',
    'innerhtml_usage',
    'no_try_catch',
    'gs_log_production',
    'answer_true_acl',
    'no_condition_business_rule',
    'select_star',
    'missing_index',
    'excessive_queries',
    'deprecated_api'
  ]).describe('The type of issue to get recommendations for'),
  code: z.string().optional().describe('The problematic code snippet'),
  context: z.object({
    table: z.string().optional(),
    artifactType: z.string().optional(),
    artifactName: z.string().optional()
  }).optional().describe('Additional context about where the issue was found')
});

export const getBestPracticesSchema = z.object({
  artifactType: z.enum([
    'business_rule',
    'client_script',
    'script_include',
    'ui_policy',
    'ui_action',
    'acl',
    'scheduled_job',
    'flow',
    'rest_api',
    'transform_map',
    'catalog_client_script',
    'fix_script'
  ]).describe('The type of artifact to get best practices for'),
  action: z.enum([
    'create',
    'modify',
    'review',
    'optimize',
    'secure',
    'debug'
  ]).optional().default('create').describe('What action you are taking')
});

export const getCodeTemplatesSchema = z.object({
  pattern: z.enum([
    'gliderecord_query',
    'gliderecord_insert',
    'gliderecord_update',
    'glideajax_call',
    'rest_message',
    'script_include_class',
    'business_rule_before',
    'business_rule_after',
    'business_rule_async',
    'client_script_onload',
    'client_script_onchange',
    'client_script_onsubmit',
    'acl_script',
    'scheduled_job',
    'error_handling',
    'null_check',
    'logging',
    'transaction_cancel'
  ]).describe('The code pattern to get a template for'),
  options: z.object({
    table: z.string().optional(),
    includeComments: z.boolean().optional().default(true),
    includeErrorHandling: z.boolean().optional().default(true)
  }).optional()
});

export type GetFixRecommendationsInput = z.infer<typeof getFixRecommendationsSchema>;
export type GetBestPracticesInput = z.infer<typeof getBestPracticesSchema>;
export type GetCodeTemplatesInput = z.infer<typeof getCodeTemplatesSchema>;

// =============================================================================
// KNOWLEDGE BASE - Issue Recommendations
// =============================================================================

interface IssueRecommendation {
  issueType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  whyItMatters: string;
  impact: string[];
  fixPatterns: {
    name: string;
    description: string;
    beforeCode: string;
    afterCode: string;
    explanation: string;
  }[];
  bestPractices: string[];
  relatedIssues: string[];
  documentation: string[];
}

const ISSUE_RECOMMENDATIONS: Record<string, IssueRecommendation> = {
  gr_in_client: {
    issueType: 'gr_in_client',
    severity: 'critical',
    title: 'GlideRecord in Client Script',
    description: 'GlideRecord is a server-side API and should never be used in client scripts.',
    whyItMatters: 'Client scripts run in the browser. GlideRecord requires server access, causing synchronous server calls that block the UI and create security vulnerabilities.',
    impact: [
      'Blocks UI thread causing browser freezes',
      'Exposes database queries to client-side manipulation',
      'Bypasses ACLs and business rules',
      'Poor user experience with slow form loads',
      'Can cause timeout errors on slow connections'
    ],
    fixPatterns: [
      {
        name: 'GlideAjax Pattern',
        description: 'Use GlideAjax to call a Script Include from client scripts',
        beforeCode: `// BAD: GlideRecord in client script
var gr = new GlideRecord('sys_user');
gr.addQuery('user_name', g_form.getValue('caller_id'));
gr.query();
if (gr.next()) {
    g_form.setValue('caller_phone', gr.phone);
}`,
        afterCode: `// GOOD: GlideAjax calling Script Include
var ga = new GlideAjax('UserUtils');
ga.addParam('sysparm_name', 'getUserPhone');
ga.addParam('sysparm_user_id', g_form.getValue('caller_id'));
ga.getXMLAnswer(function(answer) {
    g_form.setValue('caller_phone', answer);
});`,
        explanation: 'GlideAjax makes an asynchronous call to a Script Include, keeping the UI responsive and maintaining security.'
      },
      {
        name: 'g_scratchpad Pattern',
        description: 'Pre-load data on server side using Display Business Rule',
        beforeCode: `// BAD: Querying in client script
var gr = new GlideRecord('sys_user_group');
gr.get(g_form.getValue('assignment_group'));
alert('Group: ' + gr.name);`,
        afterCode: `// Display Business Rule (server-side):
g_scratchpad.groupName = current.assignment_group.getDisplayValue();

// Client Script:
if (g_scratchpad.groupName) {
    alert('Group: ' + g_scratchpad.groupName);
}`,
        explanation: 'Display Business Rules run before the form loads and can pass data via g_scratchpad.'
      }
    ],
    bestPractices: [
      'Always use GlideAjax for server data access from client scripts',
      'Create reusable Script Includes for common data lookups',
      'Use g_scratchpad for data needed immediately on form load',
      'Consider UI Policies for simple field manipulations',
      'Cache frequently accessed data in client-side variables'
    ],
    relatedIssues: ['synchronous_ajax', 'missing_null_check'],
    documentation: [
      'https://docs.servicenow.com/bundle/sandiego-application-development/page/script/ajax/concept/c_GlideAjax.html',
      'https://docs.servicenow.com/bundle/sandiego-application-development/page/script/client-scripts/concept/c_ClientScriptBestPractices.html'
    ]
  },

  hardcoded_sysid: {
    issueType: 'hardcoded_sysid',
    severity: 'high',
    title: 'Hardcoded Sys ID',
    description: 'Sys IDs are instance-specific and will break when code is promoted between environments.',
    whyItMatters: 'Sys IDs are unique identifiers that differ between instances. Hardcoding them causes failures during upgrades, clones, or promotions.',
    impact: [
      'Code breaks when promoted to different instances',
      'Failures after instance clones or refreshes',
      'Difficult to maintain and troubleshoot',
      'Cannot be reliably tested in sub-production'
    ],
    fixPatterns: [
      {
        name: 'System Property Pattern',
        description: 'Store sys_id in a system property',
        beforeCode: `// BAD: Hardcoded sys_id
var assignmentGroup = '681ccaf9c0a8016400b98a06818d57c7';
current.assignment_group = assignmentGroup;`,
        afterCode: `// GOOD: Use system property
var assignmentGroup = gs.getProperty('myapp.default.assignment_group');
if (assignmentGroup) {
    current.assignment_group = assignmentGroup;
}`,
        explanation: 'System properties can be set differently per instance and are easy to update without code changes.'
      },
      {
        name: 'GlideRecord Lookup Pattern',
        description: 'Look up the record by a stable identifier like name',
        beforeCode: `// BAD: Hardcoded sys_id
var template = '3a2ccaf9c0a8016400b98a06818d5888';
gr.setValue('template', template);`,
        afterCode: `// GOOD: Lookup by name
var templateGR = new GlideRecord('sys_template');
if (templateGR.get('name', 'Incident Standard Template')) {
    gr.setValue('template', templateGR.getUniqueValue());
}`,
        explanation: 'Looking up by name or other stable field ensures code works across instances.'
      }
    ],
    bestPractices: [
      'Use system properties for configurable references',
      'Look up records by name or other stable identifiers',
      'Use script includes to centralize reference lookups',
      'Document any necessary sys_id configurations',
      'Use reference qualifiers instead of hardcoded values'
    ],
    relatedIssues: ['missing_null_check'],
    documentation: [
      'https://docs.servicenow.com/bundle/sandiego-application-development/page/script/server-scripting/concept/c_SystemProperties.html'
    ]
  },

  missing_null_check: {
    issueType: 'missing_null_check',
    severity: 'medium',
    title: 'Missing Null Check',
    description: 'Accessing properties of potentially null objects without checking can cause runtime errors.',
    whyItMatters: 'GlideRecord queries may return no results, and accessing fields on null references causes script errors that are hard to debug.',
    impact: [
      'Runtime errors when records not found',
      'Silent failures with incomplete data',
      'Difficult to troubleshoot in production',
      'Poor user experience'
    ],
    fixPatterns: [
      {
        name: 'Standard Null Check',
        description: 'Check if record exists before accessing fields',
        beforeCode: `// BAD: No null check
var gr = new GlideRecord('sys_user');
gr.get(userId);
var email = gr.email; // Fails if user not found`,
        afterCode: `// GOOD: With null check
var gr = new GlideRecord('sys_user');
if (gr.get(userId)) {
    var email = gr.getValue('email');
} else {
    gs.warn('User not found: ' + userId);
}`,
        explanation: 'Always check the return value of get() or use next() after query() before accessing fields.'
      },
      {
        name: 'Reference Field Check',
        description: 'Check reference fields before accessing dot-walked properties',
        beforeCode: `// BAD: No reference check
var managerEmail = current.caller_id.manager.email;`,
        afterCode: `// GOOD: Check each reference
var managerEmail = '';
if (!current.caller_id.nil() && !current.caller_id.manager.nil()) {
    managerEmail = current.caller_id.manager.email;
}`,
        explanation: 'Reference fields can be empty. Use nil() to check before dot-walking.'
      }
    ],
    bestPractices: [
      'Always check get() return value before accessing fields',
      'Use getValue() instead of direct field access',
      'Check nil() on reference fields before dot-walking',
      'Provide meaningful default values',
      'Log warnings when expected records are not found'
    ],
    relatedIssues: ['no_try_catch', 'empty_catch'],
    documentation: [
      'https://docs.servicenow.com/bundle/sandiego-application-development/page/script/server-scripting/concept/c_GlideRecordBestPractices.html'
    ]
  },

  answer_true_acl: {
    issueType: 'answer_true_acl',
    severity: 'critical',
    title: 'Unconditional ACL Access (answer=true)',
    description: 'ACL script that always grants access, bypassing security controls.',
    whyItMatters: 'Setting answer=true unconditionally removes all access protection, exposing sensitive data to unauthorized users.',
    impact: [
      'Complete bypass of security controls',
      'Potential data breach',
      'Compliance violations (GDPR, HIPAA, SOC2)',
      'Audit failures'
    ],
    fixPatterns: [
      {
        name: 'Role-Based Access',
        description: 'Check for appropriate roles',
        beforeCode: `// BAD: Unconditional access
answer = true;`,
        afterCode: `// GOOD: Role-based access
answer = gs.hasRole('itil') || gs.hasRole('admin');`,
        explanation: 'Always require at least one role for access.'
      },
      {
        name: 'Contextual Access',
        description: 'Check record ownership or assignment',
        beforeCode: `// BAD: Everyone can access
answer = true;`,
        afterCode: `// GOOD: Contextual access
answer = current.assigned_to == gs.getUserID() ||
         current.opened_by == gs.getUserID() ||
         gs.hasRole('itil');`,
        explanation: 'Grant access based on the user\'s relationship to the record.'
      }
    ],
    bestPractices: [
      'Never use answer=true without conditions',
      'Always require at least one role',
      'Consider record-level conditions',
      'Test ACLs with different user roles',
      'Document the access requirements'
    ],
    relatedIssues: ['no_condition_business_rule'],
    documentation: [
      'https://docs.servicenow.com/bundle/sandiego-security-management/page/script/acls/concept/c_AccessControlList.html'
    ]
  },

  global_business_rule: {
    issueType: 'global_business_rule',
    severity: 'high',
    title: 'Global Business Rule',
    description: 'Business rules without table restrictions run on every table operation.',
    whyItMatters: 'Global business rules execute on every insert/update across all tables, causing significant performance degradation.',
    impact: [
      'Runs on every table operation system-wide',
      'Severe performance degradation',
      'Difficult to troubleshoot',
      'Unexpected side effects'
    ],
    fixPatterns: [
      {
        name: 'Table-Specific Rule',
        description: 'Limit the business rule to specific tables',
        beforeCode: `// BAD: Global business rule (no table specified)
Name: Global Audit Logger
Table: [blank/global]
Script: gs.log('Record updated');`,
        afterCode: `// GOOD: Table-specific business rule
Name: Incident Audit Logger
Table: incident
Condition: current.isNewRecord() || current.changes()
Script: gs.log('Incident updated: ' + current.number);`,
        explanation: 'Always specify a table. If logic applies to multiple tables, create separate rules or use base table inheritance.'
      }
    ],
    bestPractices: [
      'Always specify a target table',
      'Use conditions to limit execution',
      'Consider async business rules for logging',
      'Use before rules only when modifying current',
      'Profile business rule performance'
    ],
    relatedIssues: ['no_condition_business_rule', 'current_update_loop'],
    documentation: [
      'https://docs.servicenow.com/bundle/sandiego-application-development/page/script/server-scripting/concept/c_BusinessRuleBestPractices.html'
    ]
  },

  current_update_loop: {
    issueType: 'current_update_loop',
    severity: 'critical',
    title: 'current.update() in Loop',
    description: 'Calling current.update() inside a loop causes recursive business rule execution.',
    whyItMatters: 'Each update() call triggers all business rules again, causing infinite loops, stack overflows, and transaction failures.',
    impact: [
      'Infinite loop potential',
      'Stack overflow errors',
      'Transaction timeouts',
      'Database locks'
    ],
    fixPatterns: [
      {
        name: 'Batch Update Pattern',
        description: 'Collect changes and update once outside the loop',
        beforeCode: `// BAD: update in loop
var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.query();
while (gr.next()) {
    gr.work_notes = 'Batch processed';
    gr.update(); // Triggers BRs each time!
}`,
        afterCode: `// GOOD: Use updateMultiple or GlideUpdateManager
var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.setWorkflow(false); // Skip business rules
gr.autoSysFields(false); // Skip sys fields update
gr.setValue('work_notes', 'Batch processed');
gr.updateMultiple();`,
        explanation: 'Use updateMultiple() for batch operations, or setWorkflow(false) to skip business rules.'
      }
    ],
    bestPractices: [
      'Never use current.update() inside loops',
      'Use setWorkflow(false) for batch operations',
      'Consider async business rules for heavy processing',
      'Use updateMultiple() for mass updates',
      'Test with small datasets first'
    ],
    relatedIssues: ['no_setworkflow', 'global_business_rule'],
    documentation: [
      'https://docs.servicenow.com/bundle/sandiego-application-development/page/script/server-scripting/reference/r_GlideRecordUpdateMultiple.html'
    ]
  },

  synchronous_ajax: {
    issueType: 'synchronous_ajax',
    severity: 'high',
    title: 'Synchronous AJAX Call',
    description: 'Using getXMLWait() or synchronous AJAX blocks the browser UI.',
    whyItMatters: 'Synchronous calls freeze the browser until the server responds, creating a poor user experience.',
    impact: [
      'Browser freezes during call',
      'Poor user experience',
      'Timeout errors on slow connections',
      'Cannot be cancelled by user'
    ],
    fixPatterns: [
      {
        name: 'Async Pattern',
        description: 'Use getXMLAnswer with callback',
        beforeCode: `// BAD: Synchronous call
var ga = new GlideAjax('MyUtils');
ga.addParam('sysparm_name', 'getData');
ga.getXMLWait(); // BLOCKS UI
var answer = ga.getAnswer();`,
        afterCode: `// GOOD: Asynchronous with callback
var ga = new GlideAjax('MyUtils');
ga.addParam('sysparm_name', 'getData');
ga.getXMLAnswer(function(answer) {
    // Process answer here
    g_form.setValue('result', answer);
});`,
        explanation: 'Use callbacks to handle async responses without blocking the UI.'
      }
    ],
    bestPractices: [
      'Always use getXMLAnswer() with callbacks',
      'Show loading indicators during async operations',
      'Handle error cases in callbacks',
      'Consider using Promises for complex flows',
      'Cache results when appropriate'
    ],
    relatedIssues: ['gr_in_client'],
    documentation: [
      'https://docs.servicenow.com/bundle/sandiego-application-development/page/script/ajax/concept/c_GlideAjax.html'
    ]
  }
};

// =============================================================================
// BEST PRACTICES DATABASE
// =============================================================================

interface BestPracticeGuide {
  artifactType: string;
  overview: string;
  doList: string[];
  dontList: string[];
  securityConsiderations: string[];
  performanceConsiderations: string[];
  codeTemplate: string;
  commonMistakes: string[];
}

const BEST_PRACTICES: Record<string, BestPracticeGuide> = {
  business_rule: {
    artifactType: 'business_rule',
    overview: 'Business Rules are server-side scripts that run when records are displayed, inserted, updated, deleted, or queried.',
    doList: [
      'Use conditions to limit when the rule runs',
      'Keep scripts short and focused',
      'Use Script Includes for reusable logic',
      'Set appropriate order (100 is default)',
      'Use before rules only when modifying current record',
      'Add meaningful comments',
      'Handle errors gracefully'
    ],
    dontList: [
      'Avoid global business rules',
      'Never use current.update() in before/after rules',
      'Avoid GlideRecord queries in display rules',
      'Do not hardcode sys_ids',
      'Avoid synchronous web service calls',
      'Do not use gs.log() in production'
    ],
    securityConsiderations: [
      'Never trust user input without validation',
      'Use setWorkflow(false) carefully - bypasses security',
      'Validate reference fields before dot-walking',
      'Consider ACL implications of data changes'
    ],
    performanceConsiderations: [
      'Minimize database queries',
      'Use async rules for non-critical operations',
      'Cache repeated lookups',
      'Use efficient query conditions'
    ],
    codeTemplate: `(function executeRule(current, previous) {
    // Validate preconditions
    if (current.isNewRecord()) {
        // Insert logic
    }

    // Check for specific changes
    if (current.state.changes()) {
        // State change logic
    }

    // Use Script Includes for complex logic
    var helper = new MyTableHelper();
    helper.processRecord(current);

})(current, previous);`,
    commonMistakes: [
      'Not checking if fields changed before processing',
      'Missing null checks on reference fields',
      'Using display rules for data modifications',
      'Not considering record locking'
    ]
  },

  client_script: {
    artifactType: 'client_script',
    overview: 'Client Scripts run in the browser and control form behavior. They should be lightweight and never access server data directly.',
    doList: [
      'Use GlideAjax for server data',
      'Keep scripts short and fast',
      'Use g_scratchpad for pre-loaded data',
      'Handle async operations properly',
      'Test on all supported browsers',
      'Use UI Policies for simple show/hide/mandatory'
    ],
    dontList: [
      'Never use GlideRecord',
      'Avoid synchronous AJAX (getXMLWait)',
      'Do not use eval() or document.write()',
      'Avoid global variables',
      'Do not hardcode field names'
    ],
    securityConsiderations: [
      'Never trust client-side validation alone',
      'Do not expose sensitive data in g_scratchpad',
      'Assume all client code can be bypassed',
      'Server-side validation is mandatory'
    ],
    performanceConsiderations: [
      'Minimize DOM manipulations',
      'Debounce onChange handlers',
      'Cache g_form field references',
      'Limit AJAX calls'
    ],
    codeTemplate: `function onChange(control, oldValue, newValue, isLoading) {
    if (isLoading || newValue === '') {
        return;
    }

    // Use GlideAjax for server data
    var ga = new GlideAjax('MyClientUtils');
    ga.addParam('sysparm_name', 'processValue');
    ga.addParam('sysparm_value', newValue);
    ga.getXMLAnswer(function(answer) {
        if (answer) {
            g_form.setValue('target_field', answer);
        }
    });
}`,
    commonMistakes: [
      'Using GlideRecord in client scripts',
      'Not checking isLoading in onChange',
      'Blocking UI with synchronous calls',
      'Not handling empty values'
    ]
  },

  script_include: {
    artifactType: 'script_include',
    overview: 'Script Includes are reusable server-side code libraries. They should be well-documented and follow OOP principles.',
    doList: [
      'Use class-based patterns',
      'Document with JSDoc comments',
      'Make client-callable only when needed',
      'Use meaningful method names',
      'Handle errors and return consistent results',
      'Write unit tests'
    ],
    dontList: [
      'Avoid accessing current unless passed as parameter',
      'Do not use global variables',
      'Never log sensitive data',
      'Avoid circular dependencies'
    ],
    securityConsiderations: [
      'Validate inputs in client-callable methods',
      'Do not expose admin functions as client-callable',
      'Use ACLs for sensitive operations',
      'Sanitize inputs to prevent injection'
    ],
    performanceConsiderations: [
      'Cache expensive operations',
      'Use lazy loading for heavy initialization',
      'Avoid unnecessary queries',
      'Profile complex methods'
    ],
    codeTemplate: `/**
 * @class MyServiceHelper
 * @description Provides utility methods for service operations
 */
var MyServiceHelper = Class.create();
MyServiceHelper.prototype = {
    initialize: function() {
        this.LOG_PREFIX = '[MyServiceHelper] ';
    },

    /**
     * Process a record with validation
     * @param {GlideRecord} record - The record to process
     * @returns {Object} Result with success flag and message
     */
    processRecord: function(record) {
        if (!record || !record.isValidRecord()) {
            return { success: false, message: 'Invalid record' };
        }

        try {
            // Processing logic here
            return { success: true, message: 'Processed successfully' };
        } catch (e) {
            gs.error(this.LOG_PREFIX + 'Error: ' + e.message);
            return { success: false, message: e.message };
        }
    },

    type: 'MyServiceHelper'
};`,
    commonMistakes: [
      'Forgetting to add type property',
      'Not handling null/undefined inputs',
      'Missing error handling',
      'Client-callable methods without input validation'
    ]
  },

  acl: {
    artifactType: 'acl',
    overview: 'Access Control Lists (ACLs) define who can access what data and operations. Security is paramount.',
    doList: [
      'Always require at least one role',
      'Use conditions for record-level security',
      'Test with different user roles',
      'Document access requirements',
      'Follow least-privilege principle'
    ],
    dontList: [
      'Never use answer=true unconditionally',
      'Avoid overly permissive role checks',
      'Do not rely on client-side enforcement',
      'Never expose admin ACLs to general users'
    ],
    securityConsiderations: [
      'Default to deny access',
      'Test ACL inheritance',
      'Consider field-level ACLs for sensitive data',
      'Audit ACL changes'
    ],
    performanceConsiderations: [
      'Keep ACL scripts simple',
      'Avoid GlideRecord queries in ACL scripts',
      'Use ACL inheritance where possible'
    ],
    codeTemplate: `// Role-based with contextual access
answer = false;

// Allow admins
if (gs.hasRole('admin')) {
    answer = true;
}
// Allow assigned user
else if (current.assigned_to == gs.getUserID()) {
    answer = true;
}
// Allow team members with itil role
else if (gs.hasRole('itil') && current.assignment_group.members.indexOf(gs.getUserID()) >= 0) {
    answer = true;
}`,
    commonMistakes: [
      'Setting answer=true without conditions',
      'Not testing ACL inheritance',
      'Complex scripts that slow queries',
      'Forgetting to test as non-admin user'
    ]
  }
};

// =============================================================================
// CODE TEMPLATES
// =============================================================================

const CODE_TEMPLATES: Record<string, { description: string; template: string; variables: string[] }> = {
  gliderecord_query: {
    description: 'Standard GlideRecord query pattern with proper error handling',
    template: `var gr = new GlideRecord('{{table}}');
gr.addQuery('{{field}}', '{{value}}');
gr.query();
while (gr.next()) {
    // Process each record
    var value = gr.getValue('{{resultField}}');
}`,
    variables: ['table', 'field', 'value', 'resultField']
  },

  gliderecord_insert: {
    description: 'Safe GlideRecord insert pattern',
    template: `var gr = new GlideRecord('{{table}}');
gr.initialize();
gr.setValue('{{field1}}', '{{value1}}');
gr.setValue('{{field2}}', '{{value2}}');
var newSysId = gr.insert();
if (newSysId) {
    gs.info('Created record: ' + newSysId);
} else {
    gs.error('Failed to create record');
}`,
    variables: ['table', 'field1', 'value1', 'field2', 'value2']
  },

  glideajax_call: {
    description: 'Async GlideAjax pattern for client scripts',
    template: `var ga = new GlideAjax('{{scriptInclude}}');
ga.addParam('sysparm_name', '{{methodName}}');
ga.addParam('sysparm_{{param1}}', {{value1}});
ga.getXMLAnswer(function(answer) {
    if (answer) {
        var result = JSON.parse(answer);
        // Process result
        g_form.setValue('{{targetField}}', result.value);
    }
});`,
    variables: ['scriptInclude', 'methodName', 'param1', 'value1', 'targetField']
  },

  script_include_class: {
    description: 'Standard Script Include class pattern',
    template: `/**
 * @class {{className}}
 * @description {{description}}
 */
var {{className}} = Class.create();
{{className}}.prototype = {
    initialize: function() {
        this.LOG_PREFIX = '[{{className}}] ';
    },

    /**
     * {{methodDescription}}
     * @param {string} param - Description
     * @returns {Object} Result object
     */
    {{methodName}}: function(param) {
        try {
            // Implementation
            return { success: true, data: null };
        } catch (e) {
            gs.error(this.LOG_PREFIX + 'Error in {{methodName}}: ' + e.message);
            return { success: false, error: e.message };
        }
    },

    type: '{{className}}'
};`,
    variables: ['className', 'description', 'methodName', 'methodDescription']
  },

  error_handling: {
    description: 'Comprehensive error handling pattern',
    template: `try {
    // Main logic here
    {{mainLogic}}

} catch (e) {
    // Log error with context
    gs.error('[{{context}}] Error: ' + e.message +
             '\\nStack: ' + e.stack);

    // Return meaningful error
    return {
        success: false,
        error: e.message,
        context: '{{context}}'
    };
}`,
    variables: ['mainLogic', 'context']
  },

  null_check: {
    description: 'Proper null checking pattern',
    template: `// Check GlideRecord result
var gr = new GlideRecord('{{table}}');
if (gr.get('{{sysId}}')) {
    // Record found - safe to access
    var value = gr.getValue('{{field}}');
} else {
    gs.warn('{{table}} record not found: ' + {{sysId}});
}

// Check reference field before dot-walking
if (!current.{{refField}}.nil()) {
    var refValue = current.{{refField}}.{{dotWalkField}};
}`,
    variables: ['table', 'sysId', 'field', 'refField', 'dotWalkField']
  },

  business_rule_before: {
    description: 'Before business rule pattern',
    template: `(function executeRule(current, previous) {
    // Only run on specific conditions
    if (!current.{{conditionField}}.changes()) {
        return;
    }

    // Validate before save
    if (!current.{{requiredField}}) {
        gs.addErrorMessage('{{requiredField}} is required');
        current.setAbortAction(true);
        return;
    }

    // Set calculated values
    current.{{targetField}} = calculateValue(current);

    function calculateValue(record) {
        // Calculation logic
        return '';
    }

})(current, previous);`,
    variables: ['conditionField', 'requiredField', 'targetField']
  },

  business_rule_async: {
    description: 'Async business rule pattern for heavy operations',
    template: `(function executeRule(current, previous) {
    // Async rules run after transaction commits
    // Safe for heavy operations, notifications, integrations

    // Get record snapshot (current may change)
    var recordData = {
        sys_id: current.getUniqueValue(),
        number: current.getValue('number'),
        {{field}}: current.getValue('{{field}}')
    };

    // Process asynchronously
    var helper = new {{helperClass}}();
    helper.processAsync(recordData);

})(current, previous);`,
    variables: ['field', 'helperClass']
  }
};

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

export async function getFixRecommendations(
  _client: ServiceNowClient,
  input: GetFixRecommendationsInput
): Promise<{
  success: boolean;
  issueType: string;
  recommendation: IssueRecommendation | null;
  contextualAdvice: string[];
  suggestedFix: string | null;
}> {
  const recommendation = ISSUE_RECOMMENDATIONS[input.issueType] || null;

  const contextualAdvice: string[] = [];
  let suggestedFix: string | null = null;

  if (recommendation) {
    // Add contextual advice based on provided context
    if (input.context?.artifactType === 'client_script' && input.issueType === 'gr_in_client') {
      contextualAdvice.push('Since this is a client script, you MUST use GlideAjax instead of GlideRecord.');
      contextualAdvice.push('Create a client-callable Script Include to handle the server-side query.');
    }

    if (input.context?.table && ['sys_user', 'sys_user_group', 'cmn_location'].includes(input.context.table)) {
      contextualAdvice.push(`Table ${input.context.table} is commonly referenced. Consider using a utility Script Include.`);
    }

    // Generate suggested fix based on code if provided
    if (input.code && recommendation.fixPatterns.length > 0) {
      suggestedFix = recommendation.fixPatterns[0].afterCode;
      contextualAdvice.push('Apply the first fix pattern shown in the recommendation.');
    }
  } else {
    contextualAdvice.push(`No specific recommendation found for issue type: ${input.issueType}`);
    contextualAdvice.push('Consider checking ServiceNow documentation or community forums.');
  }

  return {
    success: true,
    issueType: input.issueType,
    recommendation,
    contextualAdvice,
    suggestedFix
  };
}

export async function getBestPractices(
  _client: ServiceNowClient,
  input: GetBestPracticesInput
): Promise<{
  success: boolean;
  artifactType: string;
  action: string;
  guide: BestPracticeGuide | null;
  actionSpecificAdvice: string[];
}> {
  const guide = BEST_PRACTICES[input.artifactType] || null;
  const actionSpecificAdvice: string[] = [];

  if (guide) {
    switch (input.action) {
      case 'create':
        actionSpecificAdvice.push('Review the code template as a starting point.');
        actionSpecificAdvice.push('Ensure you follow all items in the "do" list.');
        break;
      case 'modify':
        actionSpecificAdvice.push('Check for existing patterns in the codebase before changing.');
        actionSpecificAdvice.push('Consider impact on dependent artifacts.');
        break;
      case 'review':
        actionSpecificAdvice.push('Compare against the "don\'t" list for common issues.');
        actionSpecificAdvice.push('Verify security and performance considerations.');
        break;
      case 'optimize':
        actionSpecificAdvice.push('Focus on performance considerations listed.');
        actionSpecificAdvice.push('Profile before and after changes.');
        break;
      case 'secure':
        actionSpecificAdvice.push('Review all security considerations carefully.');
        actionSpecificAdvice.push('Test with different user roles.');
        break;
      case 'debug':
        actionSpecificAdvice.push('Check common mistakes list first.');
        actionSpecificAdvice.push('Review the "don\'t" list for anti-patterns.');
        break;
    }
  }

  return {
    success: true,
    artifactType: input.artifactType,
    action: input.action || 'create',
    guide,
    actionSpecificAdvice
  };
}

export async function getCodeTemplates(
  _client: ServiceNowClient,
  input: GetCodeTemplatesInput
): Promise<{
  success: boolean;
  pattern: string;
  template: {
    description: string;
    code: string;
    variables: string[];
  } | null;
  relatedPatterns: string[];
}> {
  const templateData = CODE_TEMPLATES[input.pattern] || null;

  // Find related patterns
  const relatedPatterns: string[] = [];
  if (input.pattern.includes('gliderecord')) {
    relatedPatterns.push('null_check', 'error_handling');
  }
  if (input.pattern.includes('business_rule')) {
    relatedPatterns.push('error_handling', 'null_check');
  }
  if (input.pattern.includes('client')) {
    relatedPatterns.push('glideajax_call');
  }

  let code = templateData?.template || '';

  // Apply options
  if (input.options?.table) {
    code = code.replace(/\{\{table\}\}/g, input.options.table);
  }

  return {
    success: true,
    pattern: input.pattern,
    template: templateData ? {
      description: templateData.description,
      code,
      variables: templateData.variables
    } : null,
    relatedPatterns: relatedPatterns.filter(p => p !== input.pattern)
  };
}

