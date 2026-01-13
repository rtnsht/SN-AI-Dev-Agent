/**
 * IncidentDeduplicationEngine
 * 
 * Server-side engine for detecting duplicate incidents based on configurable rules.
 * Queries the u_incident_dedupe_rule table for matching criteria.
 * 
 * @class IncidentDeduplicationEngine
 */
var IncidentDeduplicationEngine = Class.create();
IncidentDeduplicationEngine.prototype = {
    
    initialize: function() {
        this.LOG_PREFIX = '[DedupeEngine] ';
    },
    
    /**
     * Main entry point - orchestrates the deduplication process
     * @param {GlideRecord} incidentGr - The incident to check for duplicates
     * @returns {Object} Result containing master incident and duplicate count
     */
    orchestrateDedupe: function(incidentGr) {
        var result = {
            processed: false,
            duplicatesFound: 0,
            masterIncident: null,
            action: 'none'
        };
        
        // Skip if this incident is already marked as a duplicate
        if (incidentGr.getValue('parent_incident')) {
            gs.debug(this.LOG_PREFIX + 'Skipping - already linked to parent: ' + incidentGr.getValue('parent_incident'));
            return result;
        }
        
        // Find duplicate candidates
        var candidates = this.findDuplicateCandidates(incidentGr);
        
        if (candidates.length === 0) {
            gs.debug(this.LOG_PREFIX + 'No duplicates found for incident: ' + incidentGr.getValue('number'));
            return result;
        }
        
        gs.info(this.LOG_PREFIX + 'Found ' + candidates.length + ' duplicate candidates for ' + incidentGr.getValue('number'));
        
        // Include current incident in the pool for master selection
        candidates.push(incidentGr.getUniqueValue());
        
        // Delegate to merge processor
        var mergeProcessor = new DuplicateMergeProcessor();
        var mergeResult = mergeProcessor.processDuplicates(candidates, incidentGr.getUniqueValue());
        
        result.processed = true;
        result.duplicatesFound = candidates.length - 1;
        result.masterIncident = mergeResult.masterSysId;
        result.action = mergeResult.action;
        
        return result;
    },
    
    /**
     * Find duplicate candidates based on active dedup rules
     * @param {GlideRecord} incidentGr - The incident to find duplicates for
     * @returns {Array} Array of sys_ids of duplicate candidates
     */
    findDuplicateCandidates: function(incidentGr) {
        var candidates = [];
        var rules = this._getActiveRules();
        
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            var ruleMatches = this._evaluateRule(incidentGr, rule);
            
            // Merge results, avoiding duplicates
            for (var j = 0; j < ruleMatches.length; j++) {
                if (candidates.indexOf(ruleMatches[j]) === -1) {
                    candidates.push(ruleMatches[j]);
                }
            }
        }
        
        return candidates;
    },
    
    /**
     * Get all active deduplication rules, ordered by priority
     * @returns {Array} Array of rule objects
     */
    _getActiveRules: function() {
        var rules = [];
        var ruleGr = new GlideRecord('u_incident_dedupe_rule');
        ruleGr.addQuery('u_active', true);
        ruleGr.orderBy('u_priority');
        ruleGr.query();
        
        while (ruleGr.next()) {
            rules.push({
                sysId: ruleGr.getUniqueValue(),
                name: ruleGr.getValue('u_name'),
                matchFields: ruleGr.getValue('u_match_fields'),
                timeWindowMinutes: parseInt(ruleGr.getValue('u_time_window_minutes')) || 30,
                normalizeDescription: ruleGr.getValue('u_normalize_description') == '1',
                autoClose: ruleGr.getValue('u_auto_close_duplicates') == '1',
                priority: parseInt(ruleGr.getValue('u_priority')) || 100
            });
        }
        
        return rules;
    },
    
    /**
     * Evaluate a single rule against an incident
     * @param {GlideRecord} incidentGr - The incident to evaluate
     * @param {Object} rule - The rule configuration
     * @returns {Array} Array of matching incident sys_ids
     */
    _evaluateRule: function(incidentGr, rule) {
        var matches = [];
        var matchFields = (rule.matchFields || '').split(',');
        
        if (matchFields.length === 0 || matchFields[0] === '') {
            return matches;
        }
        
        // Build query for duplicates
        var dupGr = new GlideRecord('incident');
        dupGr.addQuery('sys_id', '!=', incidentGr.getUniqueValue());
        dupGr.addQuery('state', 'NOT IN', '6,7,8'); // Exclude Resolved, Closed, Cancelled
        dupGr.addQuery('parent_incident', ''); // Not already a duplicate
        
        // Add time window filter
        var timeAgo = new GlideDateTime();
        timeAgo.addSeconds(-rule.timeWindowMinutes * 60);
        dupGr.addQuery('sys_created_on', '>=', timeAgo);
        
        // Add match field conditions
        for (var i = 0; i < matchFields.length; i++) {
            var field = matchFields[i].trim();
            if (!field) continue;
            
            var value = incidentGr.getValue(field);
            
            if (field === 'short_description' && rule.normalizeDescription) {
                // Use normalized comparison - handled separately
                continue;
            }
            
            if (value) {
                dupGr.addQuery(field, value);
            }
        }
        
        dupGr.query();
        
        while (dupGr.next()) {
            // Additional check for normalized short_description if needed
            if (matchFields.indexOf('short_description') > -1 && rule.normalizeDescription) {
                if (!this._matchNormalizedDescription(incidentGr, dupGr)) {
                    continue;
                }
            }
            matches.push(dupGr.getUniqueValue());
        }
        
        return matches;
    },
    
    /**
     * Compare normalized short descriptions
     * @param {GlideRecord} inc1 - First incident
     * @param {GlideRecord} inc2 - Second incident
     * @returns {Boolean} True if descriptions match after normalization
     */
    _matchNormalizedDescription: function(inc1, inc2) {
        var desc1 = this.normalizeText(inc1.getValue('short_description') || '');
        var desc2 = this.normalizeText(inc2.getValue('short_description') || '');

        // Check for high similarity (allow small differences)
        return this._calculateSimilarity(desc1, desc2) >= 0.85;
    },

    /**
     * Normalize text for comparison
     * - Lowercase
     * - Remove special characters
     * - Remove common noise words
     * - Trim whitespace
     * @param {String} text - Text to normalize
     * @returns {String} Normalized text
     */
    normalizeText: function(text) {
        if (!text) return '';

        var normalized = text.toLowerCase();

        // Remove special characters and extra spaces
        normalized = normalized.replace(/[^a-z0-9\\s]/g, ' ');
        normalized = normalized.replace(/\\s+/g, ' ').trim();

        // Remove common noise words
        var noiseWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'been',
                          'be', 'have', 'has', 'had', 'do', 'does', 'did',
                          'will', 'would', 'could', 'should', 'may', 'might',
                          'must', 'shall', 'can', 'need', 'dare', 'ought',
                          'used', 'to', 'of', 'in', 'for', 'on', 'with',
                          'at', 'by', 'from', 'as', 'into', 'through',
                          'during', 'before', 'after', 'above', 'below',
                          'between', 'under', 'again', 'further', 'then',
                          'once', 'here', 'there', 'when', 'where', 'why',
                          'how', 'all', 'each', 'few', 'more', 'most',
                          'other', 'some', 'such', 'no', 'nor', 'not',
                          'only', 'own', 'same', 'so', 'than', 'too',
                          'very', 'just', 'but', 'and', 'or', 'if'];

        var words = normalized.split(' ');
        var filtered = [];
        for (var i = 0; i < words.length; i++) {
            if (noiseWords.indexOf(words[i]) === -1 && words[i].length > 1) {
                filtered.push(words[i]);
            }
        }

        return filtered.join(' ');
    },

    /**
     * Calculate similarity between two strings (Jaccard similarity)
     * @param {String} str1 - First string
     * @param {String} str2 - Second string
     * @returns {Number} Similarity score 0-1
     */
    _calculateSimilarity: function(str1, str2) {
        if (!str1 && !str2) return 1;
        if (!str1 || !str2) return 0;

        var set1 = str1.split(' ');
        var set2 = str2.split(' ');

        var intersection = 0;
        var union = set1.length;

        for (var i = 0; i < set2.length; i++) {
            if (set1.indexOf(set2[i]) > -1) {
                intersection++;
            } else {
                union++;
            }
        }

        return union > 0 ? intersection / union : 0;
    },

    type: 'IncidentDeduplicationEngine'
};

