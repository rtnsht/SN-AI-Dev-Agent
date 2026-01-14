/**
 * RegionLookupUtil - Script Include
 * 
 * Provides reusable methods for looking up a user's region based on their location.
 * Used by both client scripts (via GlideAjax) and business rules.
 * 
 * @requirement INC-SIMPLE-002 - Auto-populate Region from Caller Location
 */
var RegionLookupUtil = Class.create();
RegionLookupUtil.prototype = Object.extendsObject(AbstractAjaxProcessor, {

    /**
     * Get region for a user (callable from client via GlideAjax)
     * @param {string} sysparm_user_id - User sys_id passed from client
     * @returns {string} Region value or empty string
     */
    getRegionForUserAjax: function() {
        var userId = this.getParameter('sysparm_user_id');
        if (!userId) {
            return '';
        }
        return this._getRegionForUser(userId);
    },

    /**
     * Get region for a user (server-side call)
     * @param {string} userSysId - User sys_id
     * @returns {string} Region value or empty string
     */
    getRegionForUser: function(userSysId) {
        return this._getRegionForUser(userSysId);
    },

    /**
     * Get region for a location (server-side call)
     * @param {string} locationSysId - Location sys_id
     * @returns {string} Region value or empty string
     */
    getRegionForLocation: function(locationSysId) {
        return this._getRegionForLocation(locationSysId);
    },

    /**
     * Internal: Get region for a user
     * @private
     */
    _getRegionForUser: function(userSysId) {
        if (!userSysId) {
            return '';
        }

        // Get user's location
        var userGr = new GlideRecord('sys_user');
        if (!userGr.get(userSysId)) {
            return '';
        }

        var locationId = userGr.getValue('location');
        if (!locationId) {
            return '';
        }

        return this._getRegionForLocation(locationId);
    },

    /**
     * Internal: Get region for a location
     * @private
     */
    _getRegionForLocation: function(locationSysId) {
        if (!locationSysId) {
            return '';
        }

        var locGr = new GlideRecord('cmn_location');
        if (!locGr.get(locationSysId)) {
            return '';
        }

        return locGr.getValue('u_region') || '';
    },

    type: 'RegionLookupUtil'
});

