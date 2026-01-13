/**
 * AutoRemediationOrchestrator
 * Handles automation decisions and runbook execution.
 * Decides between: Direct assignment, Assignment + runbook, Auto-remediation
 * 
 * @class AutoRemediationOrchestrator
 */
var AutoRemediationOrchestrator = Class.create();
AutoRemediationOrchestrator.prototype = {
    
    // Configuration
    AUTO_REMEDIATE_ENABLED: true,
    MAX_CONCURRENT_AUTOMATIONS: 3,
    
    initialize: function(incidentGr) {
        this.incident = incidentGr;
        this.ciSysId = incidentGr.getValue('cmdb_ci') || '';
        this.serviceSysId = incidentGr.getValue('business_service') || '';
    },
    
    /**
     * Main orchestration method
     * @param {Object} patternAnalysis - Result from IncidentPatternAnalyzer
     * @param {Object} assignmentResult - Result from SkillBasedAssignment
     * @returns {Object} Orchestration decision
     */
    orchestrate: function(patternAnalysis, assignmentResult) {
        var result = {
            action: 'ASSIGN_ONLY',
            assignmentGroup: assignmentResult.assignmentGroup,
            assignedTo: assignmentResult.assignedTo,
            automationTriggered: false,
            automationId: null,
            problemCreated: false,
            problemSysId: null,
            workNotes: []
        };
        
        // Check for duplicate automation
        if (this._hasActiveAutomation()) {
            result.workNotes.push('Skipped automation - active automation already running for this CI/Service');
            return result;
        }
        
        // Handle based on recommendation
        switch (patternAnalysis.recommendation) {
            case 'LINK_TO_MAJOR':
                result.action = 'LINK_TO_MAJOR';
                result.workNotes.push('Linked to active Major Incident: ' + 
                    patternAnalysis.relatedMajorIncident.number);
                this._linkToMajorIncident(patternAnalysis.relatedMajorIncident.sysId);
                break;
                
            case 'CREATE_PROBLEM':
                result.action = 'ASSIGN_AND_CREATE_PROBLEM';
                var problem = this._createProblem(patternAnalysis);
                result.problemCreated = true;
                result.problemSysId = problem.sysId;
                result.workNotes.push('Pattern detected (' + patternAnalysis.similarIncidents.length + 
                    ' similar incidents). Created Problem: ' + problem.number);
                break;
                
            case 'AUTO_REMEDIATE':
                var runbook = this._findMatchingRunbook();
                if (runbook && this._shouldAutoRemediate()) {
                    result.action = 'AUTO_REMEDIATE';
                    result.automationTriggered = true;
                    result.automationId = this._executeRunbook(runbook);
                    result.workNotes.push('Auto-remediation triggered: ' + runbook.name);
                    
                    // Don't assign if full auto-remediation
                    if (runbook.fullAuto) {
                        result.assignedTo = null;
                        result.workNotes.push('No human assignment - awaiting automation result');
                    }
                } else {
                    result.action = 'ASSIGN_WITH_SUGGESTION';
                    result.workNotes.push('Suggested runbook available: ' + 
                        (runbook ? runbook.name : 'None found'));
                }
                break;
                
            default:
                result.action = 'ASSIGN_ONLY';
        }
        
        return result;
    },
    
    /**
     * Check if there's already an active automation for this CI/Service
     */
    _hasActiveAutomation: function() {
        // Check for running automation records
        var gr = new GlideRecord('sn_automation_run');
        if (!gr.isValid()) return false; // Table doesn't exist
        
        gr.addQuery('state', 'IN', 'running,pending');
        if (this.ciSysId) {
            gr.addQuery('configuration_item', this.ciSysId);
        }
        gr.setLimit(this.MAX_CONCURRENT_AUTOMATIONS);
        gr.query();
        
        return gr.getRowCount() >= this.MAX_CONCURRENT_AUTOMATIONS;
    },
    
    /**
     * Link incident to Major Incident
     */
    _linkToMajorIncident: function(majorIncSysId) {
        this.incident.parent_incident = majorIncSysId;
        // Don't update here - let the business rule handle it
    },
    
    /**
     * Create Problem record for pattern
     */
    _createProblem: function(patternAnalysis) {
        var gr = new GlideRecord('problem');
        gr.initialize();
        gr.short_description = 'Pattern: ' + patternAnalysis.patternCluster;
        gr.description = 'Auto-created due to pattern detection.\n' +
            'Similar incidents in last 30 minutes: ' + patternAnalysis.similarIncidents.length + '\n' +
            'Pattern type: ' + patternAnalysis.patternType + '\n' +
            'Confidence: ' + patternAnalysis.confidence + '%';
        gr.cmdb_ci = this.ciSysId;
        gr.business_service = this.serviceSysId;
        gr.category = this.incident.getValue('category');
        
        var sysId = gr.insert();
        
        // Link this incident to the problem
        this.incident.problem_id = sysId;
        
        // Link similar incidents
        for (var i = 0; i < patternAnalysis.similarIncidents.length; i++) {
            var incGr = new GlideRecord('incident');
            if (incGr.get(patternAnalysis.similarIncidents[i].sysId)) {
                incGr.problem_id = sysId;
                incGr.update();
            }
        }
        
        return {
            sysId: sysId,
            number: gr.getValue('number')
        };
    },
    
    /**
     * Find matching runbook for this incident type
     */
    _findMatchingRunbook: function() {
        // Placeholder - would query runbook/automation catalog
        var desc = this.incident.getValue('short_description').toLowerCase();
        
        if (desc.indexOf('restart') > -1 || desc.indexOf('service') > -1) {
            return { name: 'Service Restart Runbook', sysId: null, fullAuto: false };
        }
        if (desc.indexOf('disk') > -1 || desc.indexOf('space') > -1) {
            return { name: 'Disk Cleanup Runbook', sysId: null, fullAuto: true };
        }
        if (desc.indexOf('cache') > -1) {
            return { name: 'Cache Clear Runbook', sysId: null, fullAuto: true };
        }
        return null;
    },
    
    /**
     * Determine if auto-remediation should proceed
     */
    _shouldAutoRemediate: function() {
        // Check property/config
        if (!this.AUTO_REMEDIATE_ENABLED) return false;
        
        // Don't auto-remediate high priority without approval
        if (parseInt(this.incident.getValue('priority')) <= 1) return false;
        
        return true;
    },
    
    /**
     * Execute runbook (placeholder for Flow Designer integration)
     */
    _executeRunbook: function(runbook) {
        // Placeholder - would trigger Flow Designer action or Orchestration workflow
        gs.info('AutoRemediation: Would execute runbook ' + runbook.name + 
            ' for incident ' + this.incident.getValue('number'));
        
        // Return mock automation ID
        return gs.generateGUID();
    },
    
    type: 'AutoRemediationOrchestrator'
};

