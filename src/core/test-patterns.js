/**
 * Test Case Pattern Library
 * Reusable patterns for generating positive, negative, integration, and security test cases.
 */

export const POSITIVE_PATTERNS = [
  {
    name: 'Happy Path',
    appliesTo: (req) => true,
    generatePreconditions: ({ requirement }) => [
      'User is logged in with appropriate role',
      'Target record exists in expected state'
    ],
    generateSteps: ({ requirement, artifacts }) => {
      const desc = requirement.description || requirement.Requirement || 'requirement';
      return [
        { action: `Navigate to the relevant form/list`, expected: 'Page loads successfully' },
        { action: `Perform the primary action: ${desc}`, expected: 'Action completes without errors' },
        { action: 'Verify the result', expected: 'Expected outcome is achieved' }
      ];
    },
    generateExpectedResults: ({ requirement }) => [
      'Operation completes successfully',
      'Record state matches expected values',
      'No errors in system logs'
    ]
  },
  {
    name: 'Boundary Valid Input',
    appliesTo: (req, artifacts) => artifacts.some(a =>
      ['business_rule', 'client_script', 'ui_policy'].includes(a.type)),
    generatePreconditions: () => ['Form is in edit mode', 'All required fields are visible'],
    generateSteps: ({ artifacts }) => {
      const fieldArtifact = artifacts.find(a => a.type === 'client_script' || a.type === 'ui_policy');
      const name = fieldArtifact?.name || 'form logic';
      return [
        { action: 'Enter minimum valid value in constrained fields', expected: 'Value is accepted' },
        { action: 'Enter maximum valid value in constrained fields', expected: 'Value is accepted' },
        { action: `Save the record to trigger ${name}`, expected: 'Record saves successfully' }
      ];
    },
    generateExpectedResults: () => [
      'Boundary values are accepted without validation errors',
      'Business logic executes correctly at boundaries'
    ]
  },
  {
    name: 'Multi-Role Access',
    appliesTo: (req, artifacts) => true,
    generatePreconditions: () => ['Test users exist for each required role'],
    generateSteps: ({ requirement }) => {
      const desc = requirement.description || requirement.Requirement || 'feature';
      return [
        { action: `Log in as authorized role and perform: ${desc}`, expected: 'Action succeeds' },
        { action: 'Verify data is visible and editable as expected', expected: 'Correct access level' }
      ];
    },
    generateExpectedResults: () => [
      'Authorized users can perform the operation',
      'Data visibility matches role permissions'
    ]
  }
];

export const NEGATIVE_PATTERNS = [
  {
    name: 'Null/Empty Input',
    type: 'error_handling',
    priority: 'high',
    appliesTo: (artifact) => ['business_rule', 'script_include', 'client_script'].includes(artifact.type),
    generatePreconditions: ({ artifact }) => [`${artifact.name} is deployed and active`],
    generateSteps: ({ artifact }) => [
      { action: `Trigger ${artifact.name} with null/empty required fields`, expected: 'Graceful error handling' },
      { action: 'Check system logs for unhandled exceptions', expected: 'No stack traces or unhandled errors' }
    ],
    generateExpectedResults: ({ artifact }) => [
      `${artifact.name} handles null/empty input without crashing`,
      'Appropriate error message is shown or logged'
    ]
  },
  {
    name: 'Invalid Data Type',
    type: 'error_handling',
    priority: 'medium',
    appliesTo: (artifact) => ['business_rule', 'script_include'].includes(artifact.type),
    generatePreconditions: ({ artifact }) => [`${artifact.name} is deployed and active`],
    generateSteps: ({ artifact }) => [
      { action: `Pass string where number expected to ${artifact.name}`, expected: 'Type error handled gracefully' },
      { action: 'Pass number where string expected', expected: 'Coercion or error message' }
    ],
    generateExpectedResults: () => [
      'Script does not throw unhandled TypeError',
      'Invalid input is rejected with clear message'
    ]
  },
  {
    name: 'Unauthorized Access',
    type: 'security',
    priority: 'high',
    appliesTo: (artifact) => true,
    generatePreconditions: ({ artifact }) => [
      `${artifact.name} is deployed and active`,
      'Test user exists WITHOUT required role'
    ],
    generateSteps: ({ artifact }) => [
      { action: `Log in as unauthorized user`, expected: 'Limited access' },
      { action: `Attempt to trigger ${artifact.name}`, expected: 'Access denied or artifact does not fire' }
    ],
    generateExpectedResults: ({ artifact }) => [
      `${artifact.name} does not execute for unauthorized users`,
      'No data leakage occurs'
    ]
  },
  {
    name: 'Conflicting Conditions',
    type: 'error_handling',
    priority: 'medium',
    appliesTo: (artifact) => ['business_rule', 'ui_policy'].includes(artifact.type),
    generatePreconditions: ({ artifact }) => [
      `${artifact.name} is deployed and active`,
      'Record has conflicting field values'
    ],
    generateSteps: ({ artifact }) => [
      { action: 'Set fields to create conflicting conditions', expected: 'No infinite loop or crash' },
      { action: `Verify ${artifact.name} handles the conflict`, expected: 'Deterministic outcome' }
    ],
    generateExpectedResults: () => [
      'System resolves conflicts without errors',
      'No infinite loops between business rules'
    ]
  },
  {
    name: 'Concurrent Update',
    type: 'error_handling',
    priority: 'medium',
    appliesTo: (artifact) => ['business_rule', 'script_include'].includes(artifact.type),
    generatePreconditions: ({ artifact }) => [
      `${artifact.name} is deployed and active`,
      'Two browser sessions are open to the same record'
    ],
    generateSteps: ({ artifact }) => [
      { action: 'Edit the same record in two sessions simultaneously', expected: 'Concurrency handled' },
      { action: `Both save — verify ${artifact.name} behavior`, expected: 'No data corruption' }
    ],
    generateExpectedResults: () => [
      'Record update conflict is detected or handled gracefully',
      'No data loss or corruption from concurrent edits'
    ]
  }
];

export const INTEGRATION_PATTERNS = [
  {
    name: 'Data Flow End-to-End',
    appliesTo: (integration) => true,
    generatePreconditions: ({ integration }) => [
      `${integration.system || integration.System} is accessible`,
      'Network connectivity is available'
    ],
    generateSteps: ({ integration }) => {
      const system = integration.system || integration.System;
      const direction = (integration.direction || integration.Direction || 'bidirectional').toLowerCase();
      if (direction === 'inbound') {
        return [
          { action: `Send data from ${system} to ServiceNow`, expected: 'Data received correctly' },
          { action: 'Verify record created/updated in ServiceNow', expected: 'Data matches source' }
        ];
      } else if (direction === 'outbound') {
        return [
          { action: `Trigger outbound call to ${system}`, expected: 'Request sent successfully' },
          { action: `Verify data received by ${system}`, expected: 'Payload is correct' }
        ];
      }
      return [
        { action: `Exchange data between ServiceNow and ${system}`, expected: 'Bidirectional sync works' }
      ];
    },
    generateExpectedResults: ({ integration }) => [
      `Integration with ${integration.system || integration.System} completes successfully`,
      'Data integrity is maintained across systems'
    ]
  },
  {
    name: 'Integration Failure Handling',
    appliesTo: (integration) => true,
    generatePreconditions: ({ integration }) => [
      `${integration.system || integration.System} endpoint is configured`,
      'Simulate network timeout or error response'
    ],
    generateSteps: ({ integration }) => {
      const system = integration.system || integration.System;
      return [
        { action: `Simulate ${system} being unavailable`, expected: 'Error handled gracefully' },
        { action: 'Check retry logic and error logging', expected: 'Appropriate retry/fallback behavior' },
        { action: 'Verify no data loss from failed integration', expected: 'Data is preserved or queued' }
      ];
    },
    generateExpectedResults: () => [
      'Integration failure does not crash the system',
      'Error is logged with sufficient detail for debugging',
      'Data is not lost — retry or queue mechanism works'
    ]
  }
];

export const SECURITY_PATTERNS = [
  {
    name: 'ACL Verification — Role-Based Access',
    appliesTo: ({ roles }) => roles.length > 0,
    generatePreconditions: ({ roles }) => [
      ...roles.map(r => `Test user exists with role: ${r.role}`),
      'Test user exists WITHOUT any of the required roles'
    ],
    generateSteps: ({ roles, acls }) => {
      const steps = [];
      roles.forEach(r => {
        steps.push({
          action: `Log in as ${r.role} and access protected resources`,
          expected: `Access level: ${r.accessLevel || 'as defined'}`
        });
      });
      steps.push({
        action: 'Log in as user without required roles',
        expected: 'Access denied — no data visible'
      });
      return steps;
    },
    generateExpectedResults: ({ roles }) => [
      'Each role has exactly the access level defined in the design',
      'Unauthorized users cannot view, create, or modify protected records'
    ]
  },
  {
    name: 'PII/Sensitive Data Exposure Check',
    appliesTo: ({ artifacts }) => artifacts.length > 0,
    generatePreconditions: () => [
      'All scripted artifacts are deployed',
      'System logs are accessible'
    ],
    generateSteps: ({ artifacts }) => [
      { action: 'Trigger all scripted artifacts in sequence', expected: 'Normal execution' },
      { action: 'Review system logs (syslog) for sensitive data', expected: 'No PII in logs' },
      { action: 'Check g_scratchpad values passed to client', expected: 'No secrets or PII' },
      { action: 'Review REST responses for data leakage', expected: 'Only expected fields returned' }
    ],
    generateExpectedResults: () => [
      'No passwords, SSNs, or sensitive PII in system logs',
      'g_scratchpad does not contain secrets',
      'REST API responses include only designed fields'
    ]
  },
  {
    name: 'BLOCK-Tier Pattern Validation',
    appliesTo: ({ artifacts }) => artifacts.some(a =>
      ['business_rule', 'script_include', 'client_script'].includes(a.type)),
    generatePreconditions: ({ artifacts }) => [
      'All scripted artifacts are deployed',
      'Script content is accessible for review'
    ],
    generateSteps: ({ artifacts }) => {
      const scripted = artifacts.filter(a =>
        ['business_rule', 'script_include', 'client_script'].includes(a.type));
      return [
        { action: `Review ${scripted.length} script(s) for eval()/new Function()`, expected: 'None found' },
        { action: 'Check for Packages.java.* usage', expected: 'None found' },
        { action: 'Check for hardcoded credentials or setBasicAuth()', expected: 'None found' },
        { action: 'Check for innerHTML assignment', expected: 'None found — uses textContent or g_form' },
        { action: 'Check for current.update() in business rules', expected: 'None found in before rules' },
        { action: 'Check for GlideRecord in client scripts', expected: 'Uses GlideAjax instead' }
      ];
    },
    generateExpectedResults: () => [
      'Zero BLOCK-tier violations found in any deployed script',
      'All scripts comply with VAPT code standards'
    ]
  }
];
