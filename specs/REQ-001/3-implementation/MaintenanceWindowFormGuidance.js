/**
 * Client Script: MaintenanceWindowFormGuidance
 * Table: change_request
 * Type: onChange
 * Field: cmdb_ci,start_date,end_date
 * 
 * Description: Displays informational guidance when a Normal Change is detected
 *              to be scheduled during a business service's maintenance window.
 * Requirement: REQ-001
 */
function onChange(control, oldValue, newValue, isLoading, isTemplate) {
    try {
        var LOG_PREFIX = '[CS:MaintenanceWindowFormGuidance] ';
        
        // Don't run during form load or for templates
        if (isLoading || isTemplate) {
            return;
        }
        
        // Only process Normal Changes
        var changeType = g_form.getValue('type');
        if (changeType != 'normal') {
            clearMaintenanceWindowMessage();
            return;
        }
        
        // Get required values
        var serviceId = g_form.getValue('cmdb_ci');
        var startDate = g_form.getValue('start_date');
        var endDate = g_form.getValue('end_date');
        
        // Need all three values to check
        if (!serviceId || !startDate || !endDate) {
            clearMaintenanceWindowMessage();
            return;
        }
        
        // Debounce - wait 500ms before making the call
        if (window.mwCheckTimeout) {
            clearTimeout(window.mwCheckTimeout);
        }
        
        window.mwCheckTimeout = setTimeout(function() {
            checkMaintenanceWindow(serviceId, startDate, endDate);
        }, 500);
        
    } catch (ex) {
        console.error(LOG_PREFIX + 'Error: ' + ex.message);
    }
}

/**
 * Check if the change falls within a maintenance window via GlideAjax
 */
function checkMaintenanceWindow(serviceId, startDate, endDate) {
    var ga = new GlideAjax('MaintenanceWindowUtil');
    ga.addParam('sysparm_name', 'checkMaintenanceWindow');
    ga.addParam('sysparm_service_id', serviceId);
    ga.addParam('sysparm_start_date', startDate);
    ga.addParam('sysparm_end_date', endDate);
    
    ga.getXMLAnswer(function(response) {
        try {
            var result = JSON.parse(response);
            
            if (result.success && result.inWindow) {
                showMaintenanceWindowMessage(result.windowName);
            } else {
                clearMaintenanceWindowMessage();
            }
        } catch (ex) {
            console.error('[CS:MaintenanceWindowFormGuidance] Error parsing response: ' + ex.message);
            clearMaintenanceWindowMessage();
        }
    });
}

/**
 * Display the maintenance window guidance message
 */
function showMaintenanceWindowMessage(windowName) {
    // Clear any existing message first
    clearMaintenanceWindowMessage();
    
    var message = '<strong>Maintenance Window Detected</strong><br/>' +
        'This change is scheduled during the maintenance window: <strong>' + windowName + '</strong><br/><br/>' +
        'The following fields are <strong>required</strong> for maintenance window changes:<br/>' +
        '<ul style="margin: 5px 0 0 20px;">' +
        '<li>Implementation Plan</li>' +
        '<li>Backout Plan</li>' +
        '<li>Test Plan</li>' +
        '</ul>';
    
    g_form.addInfoMessage(message);
    
    // Store flag so we can clear it later
    window.mwMessageShown = true;
    
    // Highlight the mandatory fields
    g_form.showFieldMsg('implementation_plan', 'Required for maintenance window changes', 'info');
    g_form.showFieldMsg('backout_plan', 'Required for maintenance window changes', 'info');
    g_form.showFieldMsg('test_plan', 'Required for maintenance window changes', 'info');
}

/**
 * Clear the maintenance window message if shown
 */
function clearMaintenanceWindowMessage() {
    if (window.mwMessageShown) {
        g_form.clearMessages();
        g_form.hideFieldMsg('implementation_plan', true);
        g_form.hideFieldMsg('backout_plan', true);
        g_form.hideFieldMsg('test_plan', true);
        window.mwMessageShown = false;
    }
}

