/**
 * Business Rule: Incident Assignment Orchestrator
 * 
 * Table: incident
 * When: before
 * Insert: true
 * Update: true
 * Order: 50
 * Condition: current.assignment_group.nil() || current.assignment_group.changes()
 * 
 * Description: Triggers the Dynamic Service-Aware, Skill-Based, Predictive 
 * Assignment & Auto-Remediation engine on incident creation/update.
 */
(function executeRule(current, previous /*null when async*/) {
    
    // Skip if already processed or system update
    if (current.getValue('sys_mod_count') > 0 && !current.assignment_group.changes()) {
        return;
    }
    
    // Skip if manually assigned
    if (gs.getSession().getClientData('manual_assignment') === 'true') {
        return;
    }
    
    try {
        // Step 1: Analyze incident patterns
        var patternAnalyzer = new IncidentPatternAnalyzer(current);
        var patternResult = patternAnalyzer.analyze();
        
        // Step 2: Find optimal assignment
        var skillAssigner = new SkillBasedAssignment(current);
        var assignmentResult = skillAssigner.findOptimalAssignment();
        
        // Step 3: Orchestrate the response
        var orchestrator = new AutoRemediationOrchestrator(current);
        var decision = orchestrator.orchestrate(patternResult, assignmentResult);
        
        // Apply assignment
        if (decision.assignmentGroup && decision.assignmentGroup.sysId) {
            current.assignment_group = decision.assignmentGroup.sysId;
        }
        if (decision.assignedTo && decision.assignedTo.sysId) {
            current.assigned_to = decision.assignedTo.sysId;
        }
        
        // Apply problem linkage if created
        if (decision.problemSysId) {
            current.problem_id = decision.problemSysId;
        }
        
        // Add work notes
        if (decision.workNotes && decision.workNotes.length > 0) {
            var notes = '[Assignment Orchestrator]\n';
            notes += 'Action: ' + decision.action + '\n';
            notes += decision.workNotes.join('\n');
            
            if (assignmentResult.reason) {
                notes += '\nReason: ' + assignmentResult.reason;
            }
            
            current.work_notes = notes;
        }
        
        // Log for debugging
        gs.info('IncidentAssignmentOrchestrator: ' + current.getValue('number') + 
            ' - Action: ' + decision.action + 
            ' - Group: ' + (decision.assignmentGroup ? decision.assignmentGroup.name : 'None'));
        
    } catch (e) {
        gs.error('IncidentAssignmentOrchestrator Error: ' + e.message);
    }
    
})(current, previous);

