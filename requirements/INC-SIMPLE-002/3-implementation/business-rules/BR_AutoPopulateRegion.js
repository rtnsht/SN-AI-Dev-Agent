/**
 * BR_AutoPopulateRegion - Business Rule
 * 
 * Server-side fallback to ensure Region is populated on incident insert.
 * This handles cases where the client script didn't run (API calls, imports, etc.)
 * 
 * @requirement INC-SIMPLE-002 - Auto-populate Region from Caller Location
 * 
 * Configuration:
 *   Table: incident
 *   When: before
 *   Insert: true
 *   Update: false
 *   Delete: false
 *   Query: false
 *   Active: true
 *   Condition: caller_id is not empty AND u_region is empty
 *              caller_idISNOTEMPTY^u_regionISEMPTY
 */
(function executeRule(current, previous /*null when async*/) {

    // Double-check conditions (belt and suspenders)
    if (!current.caller_id || current.u_region) {
        return;
    }

    // Use the utility to get region
    var util = new RegionLookupUtil();
    var region = util.getRegionForUser(current.caller_id.toString());

    if (region) {
        current.u_region = region;
        gs.debug('BR_AutoPopulateRegion: Set region to "' + region + '" for incident');
    }

})(current, previous);

