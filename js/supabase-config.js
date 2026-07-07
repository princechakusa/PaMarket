// Publishable anon key only — safe to expose (same value already committed
// as the fallback in js/marketplace-data.js). Every website page loads this
// file directly, so it must be deployed; it was previously gitignored,
// which caused a 404 on every page load in production.
window.SUPABASE_URL = 'https://gxgytumhknmnwspxjzxw.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_cf3Z72lUE6PLCb2m42OFLA_znE8JK2r';
