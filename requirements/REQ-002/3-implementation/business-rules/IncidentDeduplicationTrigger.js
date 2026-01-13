/**
 * Business Rule: Incident Deduplication Trigger
 * 
 * Table: incident
 * When: after insert
 * Order: 500 (run after standard processing)
 * 
 * Triggers the deduplication engine when a new incident is created.
 * The engine will check for duplicates based on configured rules
 * and automatically merge if duplicates are found.
 */

(function executeRule(current, previous /*null when async*/) {
    
    // Skip if this is a duplicate being created programmatically
    if (current.parent_incident) {
        return;
    }
    
    // Skip system-generated or test incidents if needed
    if (current.getValue('sys_created_by') === 'system') {
        return;
    }
    
    try {
        // Initialize and run the deduplication engine
        var dedupeEngine = new IncidentDeduplicationEngine();
        var result = dedupeEngine.orchestrateDedupe(current);
        
        if (result.processed && result.duplicatesFound > 0) {
            gs.info('[DeduplicationBR] Processed incident ' + current.number + 
                   ': Found ' + result.duplicatesFound + ' duplicate(s). ' +
                   'Master: ' + result.masterIncident + 
                   ', Action: ' + result.action);
        }
        
    } catch (e) {
        gs.error('[DeduplicationBR] Error processing incident ' + current.number + ': ' + e.message);
    }
    
})(current, previous);

