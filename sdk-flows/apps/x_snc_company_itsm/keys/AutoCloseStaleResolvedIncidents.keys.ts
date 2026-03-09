import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    auto_close_daily_trigger: {
                        table: 'sys_hub_trigger_instance_v2'
                        id: 'b1e2d3c4a5f6078912345678abcdef01'
                    }
                    auto_close_stale_resolved_flow: {
                        table: 'sys_hub_flow'
                        id: 'a3f7c2d1e4b8091f6a2e3d4c5b6f7890'
                    }
                    auto_close_update_incidents: {
                        table: 'sys_hub_action_instance_v2'
                        id: 'c9d8e7f6a5b4c3d2e1f0123456789abc'
                    }
                    bom_json: {
                        table: 'sys_module'
                        id: '1aceb1a35b3d4df69d03bb16b66c088c'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: '7e3c5edc937b4772bf94b1eb8e498866'
                    }
                }
            }
        }
    }
}
