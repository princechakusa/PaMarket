// Publishable anon key only — safe to expose (same value already committed
// as the fallback in js/marketplace-data.js). Every website page loads this
// file directly, so it must be deployed; it was previously gitignored,
// which caused a 404 on every page load in production.
var SUPABASE_URL = 'https://gxgytumhknmnwspxjzxw.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_cf3Z72lUE6PLCb2m42OFLA_znE8JK2r';
(function (root, factory) {
  var config = root && root.PMConfig ? root.PMConfig : factory(root && root.PM_PUBLIC_CONFIG);
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
  if (!root) return;
  root.PMConfig = config;
  root.SUPABASE_URL = config.supabaseUrl;
  root.SUPABASE_ANON_KEY = config.supabasePublishableKey;
})(typeof self !== 'undefined' ? self : this, function (overrides) {
  'use strict';
  overrides = overrides || {};
  return Object.freeze({
    siteOrigin: overrides.siteOrigin || 'https://pamarketzw.com',
    supabaseUrl: overrides.supabaseUrl || SUPABASE_URL,
    supabasePublishableKey: overrides.supabasePublishableKey || SUPABASE_ANON_KEY
  });
});
