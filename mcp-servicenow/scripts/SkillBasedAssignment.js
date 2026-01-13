/**
 * SkillBasedAssignment
 * Determines optimal assignment group and individual using:
 * - Service ownership from CMDB/service registry
 * - Skill tags and certifications of users
 * - On-call schedules (with PagerDuty integration placeholder)
 * 
 * @class SkillBasedAssignment
 */
var SkillBasedAssignment = Class.create();
SkillBasedAssignment.prototype = {
    
    // Configuration
    PAGERDUTY_ENABLED: false,  // Set to true when PagerDuty is configured
    PAGERDUTY_API_KEY: '',     // Store in sys_properties
    
    initialize: function(incidentGr) {
        this.incident = incidentGr;
        this.ciSysId = incidentGr.getValue('cmdb_ci') || '';
        this.serviceSysId = incidentGr.getValue('business_service') || '';
        this.category = incidentGr.getValue('category') || '';
        this.priority = incidentGr.getValue('priority') || '4';
    },
    
    /**
     * Main method - finds optimal assignment
     * @returns {Object} Assignment recommendation
     */
    findOptimalAssignment: function() {
        var result = {
            assignmentGroup: null,
            assignedTo: null,
            reason: '',
            score: 0
        };
        
        // Step 1: Find candidate groups based on service ownership
        var candidateGroups = this._findCandidateGroups();
        if (candidateGroups.length === 0) {
            result.reason = 'No candidate groups found';
            return result;
        }
        
        // Step 2: Score and rank groups
        var rankedGroups = this._rankGroups(candidateGroups);
        result.assignmentGroup = rankedGroups[0];
        
        // Step 3: Find best individual in the group
        result.assignedTo = this._findBestIndividual(result.assignmentGroup.sysId);
        
        // Step 4: Check on-call if high priority
        if (parseInt(this.priority) <= 2 && this.PAGERDUTY_ENABLED) {
            var onCallUser = this._getOnCallUser(result.assignmentGroup.sysId);
            if (onCallUser) {
                result.assignedTo = onCallUser;
                result.reason = 'Assigned to on-call responder (P' + this.priority + ')';
            }
        }
        
        if (!result.reason) {
            result.reason = 'Skill-based assignment to ' + result.assignmentGroup.name;
        }
        result.score = rankedGroups[0].score;
        
        return result;
    },
    
    /**
     * Find candidate groups from service ownership or category mapping
     */
    _findCandidateGroups: function() {
        var groups = [];
        
        // Try to find from business service support group
        if (this.serviceSysId) {
            var svcGr = new GlideRecord('cmdb_ci_service');
            if (svcGr.get(this.serviceSysId)) {
                var supportGroup = svcGr.getValue('support_group');
                if (supportGroup) {
                    groups.push({
                        sysId: supportGroup,
                        name: svcGr.support_group.getDisplayValue(),
                        source: 'service_ownership',
                        score: 100
                    });
                }
            }
        }
        
        // Try to find from CI support group
        if (this.ciSysId) {
            var ciGr = new GlideRecord('cmdb_ci');
            if (ciGr.get(this.ciSysId)) {
                var ciSupportGroup = ciGr.getValue('support_group');
                if (ciSupportGroup) {
                    groups.push({
                        sysId: ciSupportGroup,
                        name: ciGr.support_group.getDisplayValue(),
                        source: 'ci_ownership',
                        score: 90
                    });
                }
            }
        }
        
        // Fallback to category-based assignment
        if (groups.length === 0) {
            var catGroup = this._getGroupByCategory();
            if (catGroup) {
                groups.push(catGroup);
            }
        }
        
        return groups;
    },
    
    /**
     * Get assignment group based on category
     */
    _getGroupByCategory: function() {
        // Check assignment rules table
        var gr = new GlideRecord('sysrule_assignment');
        gr.addQuery('table', 'incident');
        gr.addActiveQuery();
        gr.orderBy('order');
        gr.query();
        
        while (gr.next()) {
            // Simple category match
            var condition = gr.getValue('conditions') || '';
            if (condition.indexOf('category=' + this.category) > -1) {
                return {
                    sysId: gr.getValue('group'),
                    name: gr.group.getDisplayValue(),
                    source: 'assignment_rule',
                    score: 70
                };
            }
        }
        return null;
    },
    
    /**
     * Rank groups by score
     */
    _rankGroups: function(groups) {
        return groups.sort(function(a, b) {
            return b.score - a.score;
        });
    },
    
    /**
     * Find best individual in group based on skills and workload
     */
    _findBestIndividual: function(groupSysId) {
        var members = [];
        
        var gr = new GlideRecord('sys_user_grmember');
        gr.addQuery('group', groupSysId);
        gr.query();
        
        while (gr.next()) {
            var userSysId = gr.getValue('user');
            var workload = this._getUserWorkload(userSysId);
            var skillScore = this._getUserSkillScore(userSysId);
            
            members.push({
                sysId: userSysId,
                name: gr.user.getDisplayValue(),
                workload: workload,
                skillScore: skillScore,
                totalScore: skillScore - (workload * 5) // Penalize high workload
            });
        }
        
        if (members.length === 0) return null;
        
        // Sort by total score (highest first)
        members.sort(function(a, b) { return b.totalScore - a.totalScore; });
        
        return members[0];
    },
    
    /**
     * Get user's current open incident count
     */
    _getUserWorkload: function(userSysId) {
        var ga = new GlideAggregate('incident');
        ga.addQuery('assigned_to', userSysId);
        ga.addQuery('active', true);
        ga.addAggregate('COUNT');
        ga.query();
        
        if (ga.next()) {
            return parseInt(ga.getAggregate('COUNT')) || 0;
        }
        return 0;
    },
    
    /**
     * Calculate skill score for user (placeholder - extend with actual skills table)
     */
    _getUserSkillScore: function(userSysId) {
        // In a full implementation, query skills/certifications table
        // For now, return base score
        return 50;
    },
    
    /**
     * Get on-call user from PagerDuty (placeholder for REST integration)
     */
    _getOnCallUser: function(groupSysId) {
        if (!this.PAGERDUTY_ENABLED) return null;
        
        // Placeholder for PagerDuty REST call
        // Would use RESTMessageV2 to call PagerDuty API
        gs.info('PagerDuty integration placeholder - would fetch on-call for group');
        return null;
    },
    
    type: 'SkillBasedAssignment'
};

