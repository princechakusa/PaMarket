(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PMFormat = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function money(value, currency) { var number = Number(value) || 0; return (currency === 'ZWG' ? 'ZWG ' : '$') + number.toLocaleString(); }
  function initials(name, fallback) {
    fallback = fallback || 'U';
    return String(name || fallback).trim().split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0); }).join('').toUpperCase() || fallback;
  }
  function location(parts, fallback) { return (parts || []).filter(Boolean).join(', ') || fallback || 'Zimbabwe'; }
  return Object.freeze({ money: money, initials: initials, location: location });
});
