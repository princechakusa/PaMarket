(function (root, factory) {
  var api = factory(root && root.PMConfig);
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('../supabase-config.js'));
  if (root) root.PMUrls = api;
})(typeof self !== 'undefined' ? self : this, function (config) {
  'use strict';
  var origin = (config && config.siteOrigin || 'https://pamarketzw.com').replace(/\/$/, '');
  function slugify(text) {
    return String(text || 'listing').toLowerCase().normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '') || 'listing';
  }
  function entityPath(prefix, label, id) { return prefix + '/' + slugify(label) + '-' + id; }
  function listingPath(item) { return entityPath('l', item.title, item.id); }
  function businessPath(item) { return entityPath('b', item.name, item.id); }
  function rentalTitle(item) {
    var brand = item.rental_brands && item.rental_brands.label || '';
    return ((brand + ' ' + (item.model || '')).trim() + (item.year ? ' ' + item.year : '')).trim() || 'Rental Vehicle';
  }
  function rentalPath(item) { return entityPath('r', rentalTitle(item), item.id); }
  function absolute(path) { return origin + '/' + String(path || '').replace(/^\//, ''); }
  function query(path, params) {
    var values = [];
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value !== undefined && value !== null && value !== '') values.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    return path + (values.length ? '?' + values.join('&') : '');
  }
  return Object.freeze({
    origin: origin, slugify: slugify, query: query, absolute: absolute,
    listingPath: listingPath, listingUrl: function (x) { return absolute(listingPath(x)); },
    businessPath: businessPath, businessUrl: function (x) { return absolute(businessPath(x)); },
    rentalTitle: rentalTitle, rentalPath: rentalPath, rentalUrl: function (x) { return absolute(rentalPath(x)); },
    profilePath: function (id) { return query('profile', { id: id }); }
  });
});
