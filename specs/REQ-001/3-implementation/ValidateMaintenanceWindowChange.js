/**
 * Business Rule: ValidateMaintenanceWindowChange
 * Table: change_request
 * When: before
 * Insert: true
 * Update: true
 * 
 * Description: Validates that mandatory planning fields are completed for Normal Changes
 *              scheduled during a business service's maintenance window.
 * Requirement: REQ-001
 * 
 * Condition: current.type == 'normal'
 */
(function executeRule(current, previous /*null when async*/) {
    
    try {
        var LOG_SOURCE = 'BR:ValidateMaintenanceWindowChange';
        
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
            // Not in maintenance window - no special validation needed
            return;
        }
        
        // In maintenance window - validate planning fields
        var validation = mwUtil.validatePlanningFields(current);
        
        if (!validation.valid) {
            var errorMsg = 'This change is scheduled during a maintenance window (' + 
                windowCheck.windowName + '). Please complete the following required fields: ' + 
                validation.missingFields.join(', ');
            
            gs.addErrorMessage(errorMsg);
            current.setAbortAction(true);
            
            gs.info(LOG_SOURCE + ': Blocked save - missing fields: ' + validation.missingFields.join(', '));
        }
        
    } catch (ex) {
        gs.error('BR:ValidateMaintenanceWindowChange: Error - ' + ex.message);
        // Don't block on error - allow save but log the issue
    }

})(current, previous);

