/**
 * CallerRegionLookup - Client Script (onChange)
 * 
 * When the Caller field changes, automatically looks up and populates
 * the Region field based on the Caller's Location.
 * 
 * @requirement INC-SIMPLE-002 - Auto-populate Region from Caller Location
 * 
 * Configuration:
 *   Table: incident
 *   Type: onChange
 *   Field name: caller_id
 *   Active: true
 */
function onChange(control, oldValue, newValue, isLoading, isTemplate) {
    // Don't run on form load or template
    if (isLoading || isTemplate) {
        return;
    }

    // If caller is cleared, optionally clear region too
    if (!newValue) {
        // Uncomment if you want to clear region when caller is cleared:
        // g_form.setValue('u_region', '');
        return;
    }

    // Only auto-populate if region is currently empty
    var currentRegion = g_form.getValue('u_region');
    if (currentRegion && currentRegion !== '') {
        // Region already set, don't overwrite
        return;
    }

    // Call server to get region for this user
    var ga = new GlideAjax('RegionLookupUtil');
    ga.addParam('sysparm_name', 'getRegionForUserAjax');
    ga.addParam('sysparm_user_id', newValue);
    ga.getXMLAnswer(function(answer) {
        if (answer && answer !== '') {
            g_form.setValue('u_region', answer);
        }
    });
}

