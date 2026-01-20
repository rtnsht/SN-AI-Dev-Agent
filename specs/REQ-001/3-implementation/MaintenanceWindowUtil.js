/**
 * Script Include: MaintenanceWindowUtil
 * API Name: global.MaintenanceWindowUtil
 * Client Callable: true
 * 
 * Description: Utility for detecting maintenance window overlaps and validating
 *              planning fields for Normal Changes scheduled during maintenance windows.
 * Requirement: REQ-001
 * 
 * @class MaintenanceWindowUtil
 * @extends AbstractAjaxProcessor
 */
var MaintenanceWindowUtil = Class.create();
MaintenanceWindowUtil.prototype = Object.extendsObject(AbstractAjaxProcessor, {
    
    LOG_SOURCE: 'MaintenanceWindowUtil',
    
    /**
     * Check if dates fall within a business service's maintenance window
     * AJAX callable method
     * 
     * @returns {String} JSON response with inWindow boolean and window info
     */
    checkMaintenanceWindow: function() {
        var serviceId = this.getParameter('sysparm_service_id');
        var startDate = this.getParameter('sysparm_start_date');
        var endDate = this.getParameter('sysparm_end_date');
        
        try {
            var result = this.isInMaintenanceWindow(serviceId, startDate, endDate);
            return JSON.stringify(result);
        } catch (ex) {
            gs.error(this.LOG_SOURCE + ': checkMaintenanceWindow error - ' + ex.message);
            return JSON.stringify({ success: false, inWindow: false, error: ex.message });
        }
    },
    
    /**
     * Check if the given date range overlaps with the service's maintenance window
     * 
     * @param {String} serviceId - sys_id of the cmdb_ci_service
     * @param {String} startDate - Planned start date (GlideDateTime string)
     * @param {String} endDate - Planned end date (GlideDateTime string)
     * @returns {Object} { success, inWindow, windowName, windowStart, windowEnd }
     */
    isInMaintenanceWindow: function(serviceId, startDate, endDate) {
        if (!serviceId || !startDate || !endDate) {
            return { success: true, inWindow: false, reason: 'Missing required parameters' };
        }
        
        // Get the maintenance schedule for this service
        var scheduleId = this._getMaintenanceSchedule(serviceId);
        if (!scheduleId) {
            return { success: true, inWindow: false, reason: 'No maintenance schedule defined' };
        }
        
        // Check if dates overlap with schedule
        var schedule = new GlideSchedule(scheduleId);
        var startGDT = new GlideDateTime(startDate);
        var endGDT = new GlideDateTime(endDate);
        
        // Check if the change window falls within the maintenance schedule
        var inSchedule = schedule.isInSchedule(startGDT);
        
        if (inSchedule) {
            var scheduleInfo = this._getScheduleInfo(scheduleId);
            return {
                success: true,
                inWindow: true,
                windowName: scheduleInfo.name,
                windowScheduleId: scheduleId,
                message: 'This change is scheduled during the maintenance window: ' + scheduleInfo.name
            };
        }
        
        return { success: true, inWindow: false };
    },
    
    /**
     * Validate mandatory planning fields for maintenance window changes
     * 
     * @param {GlideRecord} changeGR - The change_request GlideRecord
     * @returns {Object} { valid, missingFields[] }
     */
    validatePlanningFields: function(changeGR) {
        var missingFields = [];
        var requiredFields = [
            { field: 'implementation_plan', label: 'Implementation Plan' },
            { field: 'backout_plan', label: 'Backout Plan' },
            { field: 'test_plan', label: 'Test Plan' }
        ];
        
        for (var i = 0; i < requiredFields.length; i++) {
            var fieldDef = requiredFields[i];
            var value = changeGR.getValue(fieldDef.field);
            if (!value || value.trim() === '') {
                missingFields.push(fieldDef.label);
            }
        }
        
        return {
            valid: missingFields.length === 0,
            missingFields: missingFields
        };
    },
    
    /**
     * Get the service owner (stakeholder) for notifications
     * 
     * @param {String} serviceId - sys_id of the cmdb_ci_service
     * @returns {Object} { ownerId, ownerName, ownerEmail }
     */
    getServiceOwner: function(serviceId) {
        if (!serviceId) {
            return { success: false, error: 'No service ID provided' };
        }
        
        var serviceGR = new GlideRecord('cmdb_ci_service');
        if (serviceGR.get(serviceId)) {
            var ownerId = serviceGR.getValue('owned_by');
            if (ownerId) {
                var userGR = new GlideRecord('sys_user');
                if (userGR.get(ownerId)) {
                    return {
                        success: true,
                        ownerId: ownerId,
                        ownerName: userGR.getDisplayValue('name'),
                        ownerEmail: userGR.getValue('email')
                    };
                }
            }
        }
        
        return { success: false, error: 'Service owner not found' };
    },
    
    /**
     * Get the maintenance schedule ID for a business service
     * @private
     */
    _getMaintenanceSchedule: function(serviceId) {
        var serviceGR = new GlideRecord('cmdb_ci_service');
        if (serviceGR.get(serviceId)) {
            return serviceGR.getValue('maintenance_schedule');
        }
        return null;
    },
    
    /**
     * Get schedule details
     * @private
     */
    _getScheduleInfo: function(scheduleId) {
        var scheduleGR = new GlideRecord('cmn_schedule');
        if (scheduleGR.get(scheduleId)) {
            return {
                name: scheduleGR.getDisplayValue('name'),
                description: scheduleGR.getValue('description')
            };
        }
        return { name: 'Unknown', description: '' };
    },

    type: 'MaintenanceWindowUtil'
});

