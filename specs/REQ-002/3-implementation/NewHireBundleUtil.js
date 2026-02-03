/**
 * Script Include: NewHireBundleUtil
 * API Name: global.NewHireBundleUtil
 * Client Callable: false
 * 
 * Description: Utility functions for New Hire Equipment Bundle orchestration.
 * Provides methods to create fulfillment tasks, check completion status,
 * and retrieve hiring manager information.
 * 
 * Requirement: REQ-002
 * 
 * @class NewHireBundleUtil
 */
var NewHireBundleUtil = Class.create();
NewHireBundleUtil.prototype = {
    
    // ========================================
    // CONSTANTS
    // ========================================
    LOG_SOURCE: 'NewHireBundleUtil',
    
    // Task definitions for the bundle
    TASK_DEFINITIONS: [
        {
            short_description: 'Laptop Provisioning',
            assignment_group: 'Hardware Team',
            description: 'Provision laptop for new hire',
            order: 100
        },
        {
            short_description: 'Access Provisioning',
            assignment_group: 'IT Security',
            description: 'Set up system access and accounts for new hire',
            order: 200
        },
        {
            short_description: 'Welcome Kit Delivery',
            assignment_group: 'Facilities',
            description: 'Prepare and deliver welcome kit to new hire workspace',
            order: 300
        }
    ],
    
    /**
     * Initialize the NewHireBundleUtil
     */
    initialize: function() {
        this._debug = gs.getProperty('newhire.bundle.debug', 'false') == 'true';
    },

    // ========================================
    // PUBLIC METHODS
    // ========================================
    
    /**
     * Create all fulfillment tasks for a New Hire Bundle RITM
     * 
     * @param {String} ritmSysId - The sys_id of the Requested Item
     * @returns {Object} Result with created task sys_ids
     */
    createFulfillmentTasks: function(ritmSysId) {
        try {
            this._log('Creating fulfillment tasks for RITM: ' + ritmSysId);
            
            var ritm = new GlideRecord('sc_req_item');
            if (!ritm.get(ritmSysId)) {
                return this._error('RITM not found: ' + ritmSysId);
            }
            
            var createdTasks = [];
            
            for (var i = 0; i < this.TASK_DEFINITIONS.length; i++) {
                var taskDef = this.TASK_DEFINITIONS[i];
                var taskSysId = this._createCatalogTask(ritm, taskDef);
                
                if (taskSysId) {
                    createdTasks.push({
                        sys_id: taskSysId,
                        short_description: taskDef.short_description
                    });
                } else {
                    // Rollback: delete any created tasks
                    this._rollbackTasks(createdTasks);
                    return this._error('Failed to create task: ' + taskDef.short_description);
                }
            }
            
            this._log('Created ' + createdTasks.length + ' fulfillment tasks');
            return this._success('All fulfillment tasks created', createdTasks);
            
        } catch (ex) {
            return this._error('Error creating fulfillment tasks: ' + ex.message);
        }
    },
    
    /**
     * Check if all child tasks for a RITM are complete
     * 
     * @param {String} ritmSysId - The sys_id of the Requested Item
     * @returns {Boolean} True if all tasks are closed complete
     */
    areAllTasksComplete: function(ritmSysId) {
        var status = this.getChildTaskStatus(ritmSysId);
        return status.allComplete;
    },
    
    /**
     * Get status of all child catalog tasks for a RITM
     * 
     * @param {String} ritmSysId - The sys_id of the Requested Item
     * @returns {Object} Status object with task details
     */
    getChildTaskStatus: function(ritmSysId) {
        var tasks = [];
        var allComplete = true;
        var totalTasks = 0;
        var completedTasks = 0;
        
        var taskGr = new GlideRecord('sc_task');
        taskGr.addQuery('request_item', ritmSysId);
        taskGr.query();
        
        while (taskGr.next()) {
            totalTasks++;
            var isComplete = (taskGr.state == 3); // Closed Complete
            
            if (isComplete) {
                completedTasks++;
            } else {
                allComplete = false;
            }
            
            tasks.push({
                sys_id: taskGr.getUniqueValue(),
                number: taskGr.number.toString(),
                short_description: taskGr.short_description.toString(),
                state: taskGr.state.getDisplayValue(),
                isComplete: isComplete
            });
        }
        
        return {
            allComplete: allComplete && totalTasks > 0,
            totalTasks: totalTasks,
            completedTasks: completedTasks,
            tasks: tasks
        };
    },
    
    /**
     * Get the hiring manager for a RITM from variables or custom field
     * 
     * @param {String} ritmSysId - The sys_id of the Requested Item
     * @returns {String} sys_id of the hiring manager user, or null
     */
    getHiringManager: function(ritmSysId) {
        var ritm = new GlideRecord('sc_req_item');
        if (!ritm.get(ritmSysId)) {
            return null;
        }
        
        // First check the custom field
        if (ritm.u_hiring_manager && !ritm.u_hiring_manager.nil()) {
            return ritm.u_hiring_manager.toString();
        }
        
        // Fall back to checking catalog item variables
        var vars = ritm.variables;
        if (vars.hiring_manager && !vars.hiring_manager.nil()) {
            return vars.hiring_manager.toString();
        }
        
        // Default to requester if no hiring manager specified
        this._log('No hiring manager found, defaulting to requester');
        return ritm.request.requested_for.toString();
    },

    /**
     * Close the RITM as complete
     *
     * @param {String} ritmSysId - The sys_id of the Requested Item
     * @returns {Object} Result object
     */
    closeRITMComplete: function(ritmSysId) {
        try {
            var ritm = new GlideRecord('sc_req_item');
            if (!ritm.get(ritmSysId)) {
                return this._error('RITM not found: ' + ritmSysId);
            }

            ritm.state = 3; // Closed Complete
            ritm.close_notes = 'All fulfillment tasks completed. Bundle delivered successfully.';
            ritm.update();

            this._log('RITM closed complete: ' + ritmSysId);
            return this._success('RITM closed complete');

        } catch (ex) {
            return this._error('Error closing RITM: ' + ex.message);
        }
    },

    // ========================================
    // PRIVATE METHODS
    // ========================================

    /**
     * Create a single catalog task
     * @private
     */
    _createCatalogTask: function(ritm, taskDef) {
        var task = new GlideRecord('sc_task');
        task.initialize();
        task.request_item = ritm.sys_id;
        task.short_description = taskDef.short_description;
        task.description = taskDef.description + '\n\nNew Hire: ' +
            (ritm.variables.new_hire_name || 'Not specified') +
            '\nStart Date: ' + (ritm.variables.start_date || 'Not specified');
        task.assignment_group.setDisplayValue(taskDef.assignment_group);
        task.order = taskDef.order;
        task.state = 1; // Open

        var taskSysId = task.insert();

        if (taskSysId) {
            this._log('Created task: ' + taskDef.short_description + ' (' + taskSysId + ')');
        }

        return taskSysId;
    },

    /**
     * Rollback created tasks on failure
     * @private
     */
    _rollbackTasks: function(createdTasks) {
        this._log('Rolling back ' + createdTasks.length + ' tasks');

        for (var i = 0; i < createdTasks.length; i++) {
            var task = new GlideRecord('sc_task');
            if (task.get(createdTasks[i].sys_id)) {
                task.deleteRecord();
            }
        }
    },

    _success: function(message, data) {
        return { success: true, message: message, data: data || null };
    },

    _error: function(message) {
        gs.error(this.LOG_SOURCE + ': ' + message);
        return { success: false, message: message };
    },

    _log: function(message) {
        if (this._debug) {
            gs.info(this.LOG_SOURCE + ': ' + message);
        }
    },

    type: 'NewHireBundleUtil'
};

