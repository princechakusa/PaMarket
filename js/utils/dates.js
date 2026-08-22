(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PMDates = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function timeAgo(iso, now) {
    var date = new Date(iso), diff = Math.max(0, ((now == null ? Date.now() : now) - date.getTime()) / 1000);
    if (diff < 3600) return Math.max(1, Math.floor(diff / 60)) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
    return date.toLocaleDateString();
  }
  function longDate(value) { return new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  function monthYear(value) { return new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
  return Object.freeze({ timeAgo: timeAgo, longDate: longDate, monthYear: monthYear });
});
