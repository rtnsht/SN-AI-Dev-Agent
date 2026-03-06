import { Flow, trigger, action, wfa } from '@servicenow/sdk/automation'

export const autoEscalateUnacknowledgedP1 = Flow(
    {
        $id: Now.ID['auto_escalate_unacknowledged_p1_flow'],
        name: 'AutoEscalateUnacknowledgedP1',
        description:
            'Runs every 5 minutes. Finds P1 incidents assigned 30+ minutes ago with no work notes and reassigns to assignment group manager.',
    },
    wfa.trigger(
        trigger.scheduled.repeat,
        { $id: Now.ID['repeat_trigger'] },
        {
            repeat: '0 00:05:00',
        }
    ),
    (_params) => {
        const staleIncidents = wfa.action(
            action.core.lookUpRecords,
            { $id: Now.ID['find_stale_p1_incidents'] },
            {
                table: 'incident',
                conditions:
                    'priority=1^active=true^assigned_toISNOTEMPTY^assignment_groupISNOTEMPTY^sys_updated_onRELATIVELT@minute@ago@30',
                sort_type: 'sort_asc',
                max_results: 500,
            }
        )

        wfa.flowLogic.forEach(
            wfa.dataPill(staleIncidents.Records, 'array.object'),
            { $id: Now.ID['loop_stale_incidents'] },
            (item) => {
                const journalCheck = wfa.action(
                    action.core.lookUpRecords,
                    { $id: Now.ID['check_work_notes'] },
                    {
                        table: 'sys_journal_field',
                        conditions: `element_id=${wfa.dataPill(item.sys_id, 'string')}^element=work_notes^name=incident^sys_created_on>javascript:gs.minutesAgoStart(30)`,
                        sort_type: 'sort_asc',
                        max_results: 1,
                    }
                )

                wfa.flowLogic.if(
                    {
                        $id: Now.ID['check_no_work_notes'],
                        condition: `${wfa.dataPill(journalCheck.Count, 'string')}=0`,
                        annotation: 'No work notes found in last 30 minutes',
                    },
                    () => {
                        const groupLookup = wfa.action(
                            action.core.lookUpRecord,
                            { $id: Now.ID['lookup_group_manager'] },
                            {
                                table: 'sys_user_group',
                                conditions: `sys_id=${wfa.dataPill(item.assignment_group, 'string')}`,
                                sort_type: 'sort_asc',
                                if_multiple_records_are_found_action: 'use_first_record',
                            }
                        )

                        wfa.flowLogic.if(
                            {
                                $id: Now.ID['check_manager_valid'],
                                condition: `${wfa.dataPill(groupLookup.Record.manager, 'string')}ISNOTEMPTY^${wfa.dataPill(groupLookup.Record.manager, 'string')}!=${wfa.dataPill(item.assigned_to, 'string')}`,
                                annotation: 'Manager exists and is not current assignee',
                            },
                            () => {
                                wfa.action(
                                    action.core.updateRecord,
                                    { $id: Now.ID['reassign_to_manager'] },
                                    {
                                        table_name: 'incident',
                                        record: wfa.dataPill(item, 'reference'),
                                        values: {
                                            assigned_to: `${wfa.dataPill(groupLookup.Record.manager, 'string')}`,
                                            work_notes:
                                                'Auto-escalated: P1 incident unacknowledged for 30+ minutes. Reassigned to group manager.',
                                        },
                                    }
                                )
                            }
                        )

                        wfa.flowLogic.else(
                            { $id: Now.ID['no_manager_warning'] },
                            () => {
                                wfa.action(
                                    action.core.updateRecord,
                                    { $id: Now.ID['add_warning_note'] },
                                    {
                                        table_name: 'incident',
                                        record: wfa.dataPill(item, 'reference'),
                                        values: {
                                            work_notes:
                                                'Auto-escalation skipped: No manager defined for assignment group. Please update the group manager to enable auto-escalation.',
                                        },
                                    }
                                )
                            }
                        )
                    }
                )
            }
        )
    }
)