/**
 * DuplicateMergeProcessor
 * 
 * Handles the merge behavior for duplicate incidents.
 * - Selects the master incident (oldest open P1-P3 with assignment group)
 * - Links children to master via parent_incident field
 * - Aggregates important fields (callers, locations) into master
 * - Optionally closes duplicates with appropriate resolution
 * 
 * @class DuplicateMergeProcessor
 */
var DuplicateMergeProcessor = Class.create();
DuplicateMergeProcessor.prototype = {
    
    DUPLICATE_STATE: '6',           // Resolved
    DUPLICATE_CLOSE_CODE: 'Duplicate',
    LOG_PREFIX: '[MergeProcessor] ',
    
    initialize: function() {
        this.aggregatedData = {
            callers: [],
            locations: [],
            affectedUsers: [],
            workNotes: []
        };
    },
    
    /**
     * Main entry point - process a set of duplicate incidents
     * @param {Array} candidateSysIds - Array of incident sys_ids (including potential master)
     * @param {String} triggerIncidentSysId - The incident that triggered this check
     * @returns {Object} Result of merge operation
     */
    processDuplicates: function(candidateSysIds, triggerIncidentSysId) {
        var result = {
            masterSysId: null,
            childrenCount: 0,
            action: 'none'
        };
        
        if (candidateSysIds.length < 2) {
            return result;
        }
        
        // Load all candidate incidents
        var incidents = this._loadIncidents(candidateSysIds);
        
        // Select master incident
        var master = this.selectMasterIncident(incidents);
        if (!master) {
            gs.warn(this.LOG_PREFIX + 'Could not determine master incident');
            return result;
        }
        
        result.masterSysId = master.sys_id;
        gs.info(this.LOG_PREFIX + 'Selected master incident: ' + master.number);
        
        // Get children (all except master)
        var children = incidents.filter(function(inc) {
            return inc.sys_id !== master.sys_id;
        });
        
        if (children.length === 0) {
            return result;
        }
        
        // Merge children to master
        this.mergeToMaster(master, children);
        
        // Aggregate fields from children
        this.aggregateFields(master, children);
        
        // Get auto-close setting from the rule that matched
        var autoClose = this._shouldAutoClose();
        
        if (autoClose) {
            this.closeDuplicates(children, master);
            result.action = 'merged_and_closed';
        } else {
            result.action = 'merged';
        }
        
        result.childrenCount = children.length;
        
        return result;
    },
    
    /**
     * Select the master incident from a set of candidates
     * Criteria: Oldest open P1-P3 with non-empty assignment group
     * @param {Array} incidents - Array of incident objects
     * @returns {Object} The selected master incident
     */
    selectMasterIncident: function(incidents) {
        // Filter to open incidents (states 1-5)
        var openIncidents = incidents.filter(function(inc) {
            var state = parseInt(inc.state);
            return state >= 1 && state <= 5;
        });
        
        if (openIncidents.length === 0) {
            openIncidents = incidents; // Fallback to all if none open
        }
        
        // Prefer P1-P3 with assignment group
        var prioritized = openIncidents.filter(function(inc) {
            var priority = parseInt(inc.priority);
            return priority >= 1 && priority <= 3 && inc.assignment_group;
        });
        
        var pool = prioritized.length > 0 ? prioritized : openIncidents;
        
        // Sort by created date (oldest first)
        pool.sort(function(a, b) {
            return new GlideDateTime(a.sys_created_on).compareTo(new GlideDateTime(b.sys_created_on));
        });
        
        return pool[0] || null;
    },
    
    /**
     * Link child incidents to master
     * @param {Object} master - Master incident object
     * @param {Array} children - Array of child incident objects
     */
    mergeToMaster: function(master, children) {
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            
            var childGr = new GlideRecord('incident');
            if (childGr.get(child.sys_id)) {
                // Set parent reference
                childGr.setValue('parent_incident', master.sys_id);
                
                // Add work note about duplicate
                var workNote = '[Automated] This incident has been identified as a duplicate.\\n' +
                              'Master Incident: ' + master.number + '\\n' +
                              'Reason: Matched deduplication rule criteria.\\n' +
                              'Please refer to the master incident for updates.';
                childGr.work_notes = workNote;
                
                childGr.setWorkflow(false); // Prevent triggering additional business rules
                childGr.update();
                
                gs.info(this.LOG_PREFIX + 'Linked ' + child.number + ' to master ' + master.number);
            }
        }
    },
    
    /**
     * Aggregate important fields from children to master
     * Stores in a custom JSON field or adds as a work note
     * @param {Object} master - Master incident object
     * @param {Array} children - Array of child incident objects
     */
    aggregateFields: function(master, children) {
        var aggregation = {
            related_incidents: [],
            callers: [],
            locations: [],
            affected_users_count: 0
        };

        // Collect data from children
        for (var i = 0; i < children.length; i++) {
            var child = children[i];

            aggregation.related_incidents.push({
                number: child.number,
                sys_id: child.sys_id,
                caller: child.caller_id_display || child.caller_id
            });

            if (child.caller_id && aggregation.callers.indexOf(child.caller_id) === -1) {
                aggregation.callers.push(child.caller_id);
            }

            if (child.location && aggregation.locations.indexOf(child.location) === -1) {
                aggregation.locations.push(child.location);
            }
        }

        aggregation.affected_users_count = aggregation.callers.length;

        // Update master with aggregated data
        var masterGr = new GlideRecord('incident');
        if (masterGr.get(master.sys_id)) {
            // Add work note with aggregation summary
            var summaryNote = '[Automated] Duplicate Aggregation Summary:\\n' +
                             'Related Incidents: ' + aggregation.related_incidents.length + '\\n' +
                             'Affected Users: ' + aggregation.affected_users_count + '\\n' +
                             'Locations: ' + aggregation.locations.length + '\\n\\n' +
                             'Related Incident Numbers: ' +
                             aggregation.related_incidents.map(function(r) { return r.number; }).join(', ');

            masterGr.work_notes = summaryNote;

            // Store JSON in a custom field if it exists
            if (masterGr.isValidField('u_duplicate_aggregation')) {
                masterGr.setValue('u_duplicate_aggregation', JSON.stringify(aggregation));
            }

            masterGr.setWorkflow(false);
            masterGr.update();

            gs.info(this.LOG_PREFIX + 'Aggregated data from ' + children.length + ' duplicates to master');
        }
    },

    /**
     * Close duplicate incidents with appropriate resolution
     * @param {Array} children - Array of child incident objects to close
     * @param {Object} master - Master incident for reference
     */
    closeDuplicates: function(children, master) {
        for (var i = 0; i < children.length; i++) {
            var child = children[i];

            var childGr = new GlideRecord('incident');
            if (childGr.get(child.sys_id)) {
                childGr.setValue('state', this.DUPLICATE_STATE);
                childGr.setValue('close_code', this.DUPLICATE_CLOSE_CODE);
                childGr.setValue('close_notes',
                    'Automatically closed as duplicate of ' + master.number);

                childGr.setWorkflow(false);
                childGr.update();

                gs.info(this.LOG_PREFIX + 'Closed duplicate: ' + child.number);
            }
        }
    },

    /**
     * Load incident records by sys_ids
     * @param {Array} sysIds - Array of incident sys_ids
     * @returns {Array} Array of incident objects
     */
    _loadIncidents: function(sysIds) {
        var incidents = [];
        var gr = new GlideRecord('incident');
        gr.addQuery('sys_id', 'IN', sysIds.join(','));
        gr.query();

        while (gr.next()) {
            incidents.push({
                sys_id: gr.getUniqueValue(),
                number: gr.getValue('number'),
                state: gr.getValue('state'),
                priority: gr.getValue('priority'),
                assignment_group: gr.getValue('assignment_group'),
                caller_id: gr.getValue('caller_id'),
                caller_id_display: gr.getDisplayValue('caller_id'),
                location: gr.getValue('location'),
                sys_created_on: gr.getValue('sys_created_on'),
                short_description: gr.getValue('short_description')
            });
        }

        return incidents;
    },

    /**
     * Check if auto-close is enabled (based on most recent matching rule)
     * @returns {Boolean} True if duplicates should be auto-closed
     */
    _shouldAutoClose: function() {
        // Check system property or default to false
        var prop = gs.getProperty('x_snc_dedupe.auto_close_duplicates', 'false');
        return prop === 'true';
    },

    type: 'DuplicateMergeProcessor'
};

