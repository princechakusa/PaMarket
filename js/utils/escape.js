(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PMEscape = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function html(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) { return entities[character]; }); }
  return Object.freeze({ html: html, attribute: html });
});
