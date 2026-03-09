import { Flow, trigger, action, wfa } from '@servicenow/sdk/automation'

export const escalateUnacknowledgedP1Incidents = Flow(
    {
        $id: Now.ID['escalate_p1_flow'],
        name: 'Escalate Unacknowledged P1 Incidents',
        description: 'Runs every 15 minutes. Finds active P1 incidents with no assigned user created 30+ minutes ago and escalates them by setting urgency to 1 and adding a work note.',
    },
    wfa.trigger(trigger.scheduled.repeat, { $id: Now.ID['escalate_p1_trigger'] }, {
        repeat: '0 00:15:00',
    }),
    (_params) => {
        const p1Incidents = wfa.action(action.core.lookUpRecords, { $id: Now.ID['lookup_p1_incidents'] }, {
            table: 'incident',
            conditions: 'priority=1^assigned_toISEMPTY^active=true^sys_created_onRELATIVELT@minute@ago@30^work_notesNOT LIKEEscalated: P1',
            sort_type: 'sort_asc',
            max_results: 500,
        })

        wfa.flowLogic.forEach(wfa.dataPill(p1Incidents.Records, 'array.object'), { $id: Now.ID['foreach_incident'] }, (item) => {
            wfa.action(action.core.updateRecord, { $id: Now.ID['update_incident'] }, {
                table_name: 'incident',
                record: wfa.dataPill(item, 'reference'),
                values: TemplateValue({
                    urgency: '1',
                    work_notes: 'Escalated: P1 incident unacknowledged for 30+ minutes.',
                }),
            })

            wfa.action(action.core.log, { $id: Now.ID['log_escalation'] }, {
                log_level: 'info',
                log_message: `Escalated P1 incident: ${wfa.dataPill(item, 'string')}`,
            })
        })
    }
)