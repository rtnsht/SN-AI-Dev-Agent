import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    add_warning_note: {
                        table: 'sys_hub_action_instance_v2'
                        id: '72e0d082d36242e0af8e7362780494bc'
                    }
                    auto_close_stale_resolved_flow: {
                        table: 'sys_hub_flow'
                        id: '071e55a4d4dc4cdeb78f31bca32926a4'
                    }
                    auto_escalate_unacknowledged_p1_flow: {
                        table: 'sys_hub_flow'
                        id: '09498d7150224d3d90c019cf4bc42b56'
                    }
                    bom_json: {
                        table: 'sys_module'
                        id: '1aceb1a35b3d4df69d03bb16b66c088c'
                    }
                    check_manager_valid: {
                        table: 'sys_hub_flow_logic_instance_v2'
                        id: '9f28d0b8efb1497ca3b799c49b29d807'
                    }
                    check_no_work_notes: {
                        table: 'sys_hub_flow_logic_instance_v2'
                        id: '24ee65474ee54c6c83c372e8789276a3'
                    }
                    check_work_notes: {
                        table: 'sys_hub_action_instance_v2'
                        id: 'aaf803874efa4e5d9ff2c0e97b0247a9'
                    }
                    close_stale_incidents: {
                        table: 'sys_hub_action_instance_v2'
                        id: 'b2c3d4e5f6a748b9c0d1e2f3a4b5c6d7'
                    }
                    daily_midnight_trigger: {
                        table: 'sys_hub_trigger_instance_v2'
                        id: 'a1b2c3d4e5f647a8b9c0d1e2f3a4b5c6'
                    }
                    find_stale_p1_incidents: {
                        table: 'sys_hub_action_instance_v2'
                        id: '34ef5fa9e76b4c449e54e557b2a22351'
                    }
                    lookup_group_manager: {
                        table: 'sys_hub_action_instance_v2'
                        id: '98c72aac27bc4844846853eb245f7a73'
                    }
                    loop_stale_incidents: {
                        table: 'sys_hub_flow_logic_instance_v2'
                        id: 'a4e7b1cfe12a4b138ef7ca854f830b90'
                    }
                    no_manager_warning: {
                        table: 'sys_hub_flow_logic_instance_v2'
                        id: 'db1a84eba0db4d1d812f9a934fdedbc8'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: '7e3c5edc937b4772bf94b1eb8e498866'
                    }
                    reassign_to_manager: {
                        table: 'sys_hub_action_instance_v2'
                        id: '6e9746f353954fa5982cdb4dbdf920c9'
                    }
                    repeat_trigger: {
                        table: 'sys_hub_trigger_instance_v2'
                        id: '1a764ec1710a40148ed09b634482aeb4'
                    }
                }
            }
        }
    }
}
