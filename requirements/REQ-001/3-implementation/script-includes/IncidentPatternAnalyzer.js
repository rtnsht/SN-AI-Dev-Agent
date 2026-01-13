/**
 * IncidentPatternAnalyzer
 * Analyzes CI/service, historical incidents, current open/major incidents, 
 * and problem records to classify incidents into pattern clusters.
 * 
 * @class IncidentPatternAnalyzer
 */
var IncidentPatternAnalyzer = Class.create();
IncidentPatternAnalyzer.prototype = {
    
    // Configuration
    PATTERN_THRESHOLD: 5,           // Number of similar incidents to trigger pattern
    PATTERN_WINDOW_MINUTES: 30,     // Time window for pattern detection
    
    initialize: function(incidentGr) {
        this.incident = incidentGr;
        this.ciSysId = incidentGr.getValue('cmdb_ci') || '';
        this.serviceSysId = incidentGr.getValue('business_service') || '';
        this.category = incidentGr.getValue('category') || '';
        this.subcategory = incidentGr.getValue('subcategory') || '';
        this.shortDesc = incidentGr.getValue('short_description') || '';
    },
    
    /**
     * Main analysis method - returns pattern classification
     * @returns {Object} Pattern analysis result
     */
    analyze: function() {
        var result = {
            patternDetected: false,
            patternType: '',
            patternCluster: '',
            similarIncidents: [],
            relatedProblem: null,
            relatedMajorIncident: null,
            confidence: 0,
            recommendation: 'ASSIGN_ONLY'
        };
        
        // Check for active Major Incident on same CI/Service
        result.relatedMajorIncident = this._findActiveMajorIncident();
        if (result.relatedMajorIncident) {
            result.recommendation = 'LINK_TO_MAJOR';
            return result;
        }
        
        // Find similar incidents in time window
        result.similarIncidents = this._findSimilarIncidents();
        
        // Check if pattern threshold exceeded
        if (result.similarIncidents.length >= this.PATTERN_THRESHOLD) {
            result.patternDetected = true;
            result.patternType = this._classifyPattern();
            result.patternCluster = this._generateClusterName();
            result.confidence = this._calculateConfidence(result.similarIncidents.length);
            
            // Check for existing problem
            result.relatedProblem = this._findRelatedProblem();
            
            if (!result.relatedProblem) {
                result.recommendation = 'CREATE_PROBLEM';
            }
        }
        
        // Analyze for auto-remediation potential
        result.recommendation = this._determineRecommendation(result);
        
        return result;
    },
    
    /**
     * Find active Major Incidents affecting same CI/Service
     */
    _findActiveMajorIncident: function() {
        if (!this.ciSysId && !this.serviceSysId) return null;
        
        var gr = new GlideRecord('incident');
        gr.addQuery('major_incident_state', 'accepted');
        gr.addQuery('active', true);
        
        var qc = gr.addQuery('cmdb_ci', this.ciSysId);
        if (this.serviceSysId) {
            qc.addOrCondition('business_service', this.serviceSysId);
        }
        gr.setLimit(1);
        gr.query();
        
        if (gr.next()) {
            return {
                sysId: gr.getUniqueValue(),
                number: gr.getValue('number'),
                shortDescription: gr.getValue('short_description')
            };
        }
        return null;
    },
    
    /**
     * Find similar incidents within the pattern window
     */
    _findSimilarIncidents: function() {
        var incidents = [];
        var windowStart = new GlideDateTime();
        windowStart.addSeconds(-this.PATTERN_WINDOW_MINUTES * 60);
        
        var gr = new GlideRecord('incident');
        gr.addQuery('sys_created_on', '>=', windowStart);
        gr.addQuery('sys_id', '!=', this.incident.getUniqueValue());
        
        // Match on CI or Service
        if (this.ciSysId) {
            gr.addQuery('cmdb_ci', this.ciSysId);
        } else if (this.serviceSysId) {
            gr.addQuery('business_service', this.serviceSysId);
        } else {
            // Match on category if no CI/Service
            gr.addQuery('category', this.category);
            gr.addQuery('subcategory', this.subcategory);
        }
        
        gr.query();
        while (gr.next()) {
            incidents.push({
                sysId: gr.getUniqueValue(),
                number: gr.getValue('number'),
                shortDescription: gr.getValue('short_description'),
                createdOn: gr.getValue('sys_created_on')
            });
        }
        return incidents;
    },
    
    /**
     * Find related Problem record
     */
    _findRelatedProblem: function() {
        var gr = new GlideRecord('problem');
        gr.addQuery('active', true);
        if (this.ciSysId) {
            gr.addQuery('cmdb_ci', this.ciSysId);
        }
        gr.setLimit(1);
        gr.query();
        
        if (gr.next()) {
            return {
                sysId: gr.getUniqueValue(),
                number: gr.getValue('number')
            };
        }
        return null;
    },
    
    _classifyPattern: function() {
        // Simple keyword-based classification
        var desc = this.shortDesc.toLowerCase();
        if (desc.indexOf('timeout') > -1 || desc.indexOf('slow') > -1) return 'PERFORMANCE';
        if (desc.indexOf('error') > -1 || desc.indexOf('fail') > -1) return 'ERROR';
        if (desc.indexOf('down') > -1 || desc.indexOf('unavailable') > -1) return 'OUTAGE';
        if (desc.indexOf('access') > -1 || desc.indexOf('permission') > -1) return 'ACCESS';
        return 'GENERAL';
    },
    
    _generateClusterName: function() {
        var ciName = this.incident.cmdb_ci.getDisplayValue() || 'Unknown CI';
        return this._classifyPattern() + ' on ' + ciName + ' (' + new GlideDateTime().getDate() + ')';
    },
    
    _calculateConfidence: function(count) {
        return Math.min(100, Math.round((count / this.PATTERN_THRESHOLD) * 50) + 50);
    },
    
    _determineRecommendation: function(result) {
        if (result.relatedMajorIncident) return 'LINK_TO_MAJOR';
        if (result.patternDetected && !result.relatedProblem) return 'CREATE_PROBLEM';
        if (result.patternDetected) return 'AUTO_REMEDIATE';
        return 'ASSIGN_ONLY';
    },
    
    type: 'IncidentPatternAnalyzer'
};

