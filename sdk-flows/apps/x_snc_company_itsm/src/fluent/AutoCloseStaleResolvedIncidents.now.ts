import { Flow, trigger, action, wfa } from '@servicenow/sdk/automation'

export const autoCloseStaleResolvedIncidents = Flow(
    {
        $id: Now.ID['auto_close_stale_resolved_flow'],
        name: 'Auto Close Stale Resolved Incidents',
        description: 'Runs daily at midnight to close Resolved incidents (incident_state=6) that have not been updated in 7+ days. Adds work note before closing.',
    },
    wfa.trigger(trigger.scheduled.daily, { $id: Now.ID['auto_close_daily_trigger'] }, {
        time: '00:00:00',
    }),
    (_params) => {
        wfa.action(action.core.updateMultipleRecords, { $id: Now.ID['auto_close_update_incidents'] }, {
            table_name: 'incident',
            conditions: 'incident_state=6^sys_updated_onRELATIVELT@dayofweek@ago@7',
            sort_type: 'sort_asc',
            field_values: TemplateValue({
                work_notes: 'Auto-closed due to inactivity',
                incident_state: '7',
                state: '7',
                active: 'false',
                close_code: 'Closed/Resolved by Caller',
            }),
        })
    }
)