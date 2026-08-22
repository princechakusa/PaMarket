(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PMValidation = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function requiredString(value) { return typeof value === 'string' && value.trim().length > 0; }
  function email(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }
  function phone(value) { return /^\+?[0-9][0-9\s().-]{6,19}$/.test(String(value || '').trim()); }
  function publicUrl(value) { try { var parsed = new URL(value); return parsed.protocol === 'https:' || parsed.protocol === 'http:'; } catch (_) { return false; } }
  function numberInRange(value, min, max) { var number = Number(value); return Number.isFinite(number) && number >= min && number <= max; }
  return Object.freeze({ requiredString: requiredString, email: email, phone: phone, publicUrl: publicUrl, numberInRange: numberInRange });
});
