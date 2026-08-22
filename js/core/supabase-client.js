// Shared browser transport boundary. It does not own or mutate auth/session state.
(function (root, factory) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var api = isNode ? null : factory(root && root.PMConfig);
  if (isNode) module.exports = factory;
  if (root && api) root.PMSupabaseClient = api;
})(typeof self !== 'undefined' ? self : this, function (config) {
  'use strict';
  if (!config || !config.supabaseUrl || !config.supabasePublishableKey) throw new Error('PaMarket public Supabase configuration is unavailable');
  var url = config.supabaseUrl.replace(/\/$/, ''), key = config.supabasePublishableKey;
  var client = Object.freeze({
    url: url, publishableKey: key,
    restUrl: function (path) { return url + '/rest/v1/' + String(path || '').replace(/^\//, ''); },
    authUrl: function (path) { return url + '/auth/v1/' + String(path || '').replace(/^\//, ''); },
    functionsUrl: function (path) { return url + '/functions/v1/' + String(path || '').replace(/^\//, ''); },
    headers: function (accessToken, extra) { return Object.assign({ apikey: key, Authorization: 'Bearer ' + (accessToken || key) }, extra || {}); }
  });
  return Object.freeze({ get: function () { return client; } });
});
