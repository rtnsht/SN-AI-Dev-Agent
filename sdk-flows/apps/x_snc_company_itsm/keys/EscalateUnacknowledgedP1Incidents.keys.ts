import '@servicenow/sdk/global'
declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    escalate_p1_flow: { table: 'sys_hub_flow'; id: 'f1e2d3c4b5a6978817263544f5e6d7c8' }
                    escalate_p1_trigger: { table: 'sys_hub_trigger_instance_v2'; id: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d' }
                    lookup_p1_incidents: { table: 'sys_hub_action_instance_v2'; id: '3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e' }
                    foreach_incident: { table: 'sys_hub_flow_logic_instance_v2'; id: '4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f' }
                    update_incident: { table: 'sys_hub_action_instance_v2'; id: '5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a' }
                    log_escalation: { table: 'sys_hub_action_instance_v2'; id: '6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b' }
                    bom_json: { table: 'sys_module'; id: '1aceb1a35b3d4df69d03bb16b66c088c' }
                    package_json: { table: 'sys_module'; id: '7e3c5edc937b4772bf94b1eb8e498866' }
                }
            }
        }
    }
}