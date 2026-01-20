/**
 * Business Rule: NotifyMaintenanceWindowStakeholders
 * Table: change_request
 * When: after
 * Insert: true
 * Update: true
 * 
 * Description: Fires notification events at key lifecycle points for Normal Changes
 *              scheduled during a business service's maintenance window.
 * Requirement: REQ-001
 * 
 * Events fired:
 *   - mw.change.created: On insert when in maintenance window
 *   - mw.change.approved: When state changes to Approved
 *   - mw.change.started: When state changes to Implement
 *   - mw.change.closed: When state changes to Closed
 * 
 * Condition: current.type == 'normal'
 */
(function executeRule(current, previous /*null when async*/) {
    
    try {
        var LOG_SOURCE = 'BR:NotifyMaintenanceWindowStakeholders';
        
        // Guard: Only process Normal Changes
        if (current.getValue('type') != 'normal') {
            return;
        }
        
        // Guard: Must have a business service and dates
        var serviceId = current.getValue('cmdb_ci');
        var startDate = current.getValue('start_date');
        var endDate = current.getValue('end_date');
        
        if (!serviceId || !startDate || !endDate) {
            return;
        }
        
        // Check if change is in maintenance window
        var mwUtil = new MaintenanceWindowUtil();
        var windowCheck = mwUtil.isInMaintenanceWindow(serviceId, startDate, endDate);
        
        if (!windowCheck.success || !windowCheck.inWindow) {
            return; // Not in maintenance window - no notifications
        }
        
        // Get service owner for notification target
        var ownerInfo = mwUtil.getServiceOwner(serviceId);
        var recipientId = ownerInfo.success ? ownerInfo.ownerId : '';
        
        // Determine which event to fire based on operation and state change
        var eventName = null;
        var currentState = current.getValue('state');
        var previousState = previous ? previous.getValue('state') : null;
        
        if (current.operation() == 'insert') {
            // New change created in maintenance window
            eventName = 'mw.change.created';
            gs.info(LOG_SOURCE + ': Firing mw.change.created for ' + current.getValue('number'));
            
        } else if (current.operation() == 'update' && currentState != previousState) {
            // State changed - check for specific transitions
            
            // State values: -5=New, -4=Assess, -3=Authorize, -2=Scheduled, -1=Implement, 0=Review, 3=Closed, 4=Cancelled
            
            if (currentState == '-3') {
                // Authorized/Approved
                eventName = 'mw.change.approved';
                gs.info(LOG_SOURCE + ': Firing mw.change.approved for ' + current.getValue('number'));
                
            } else if (currentState == '-1') {
                // Implement
                eventName = 'mw.change.started';
                gs.info(LOG_SOURCE + ': Firing mw.change.started for ' + current.getValue('number'));
                
            } else if (currentState == '3') {
                // Closed
                eventName = 'mw.change.closed';
                gs.info(LOG_SOURCE + ': Firing mw.change.closed for ' + current.getValue('number'));
            }
        }
        
        // Fire the event if we have one
        if (eventName) {
            gs.eventQueue(eventName, current, recipientId, windowCheck.windowName);
            gs.info(LOG_SOURCE + ': Event queued - ' + eventName + ' for change ' + current.getValue('number'));
        }
        
    } catch (ex) {
        gs.error('BR:NotifyMaintenanceWindowStakeholders: Error - ' + ex.message);
    }

})(current, previous);

