/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Category-specific listing attributes: collected at posting time and shown as
 * a clean Overview/spec table + quick-facts row on the detail page (Dubizzle-style).
 */
'use strict';
(function (H) {

  // Small inline icons for the quick-facts row.
  var IC = {
    bed:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5"/><path d="M2 17h20M5 10V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/></svg>',
    bath:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12V5a2 2 0 0 1 2-2 2 2 0 0 1 2 2"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M4 12v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3"/></svg>',
    area:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v4M3 9h4M15 21v-4M21 15h-4"/></svg>',
    cal:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14l4-4M5 19a9 9 0 1 1 14 0z"/></svg>',
    fuel:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><path d="M4 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/><path d="M14 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.5L18 6"/></svg>',
    tag:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
  };

  // Field schema per category. Each field:
  //   key, label, type ('select'|'number'|'text'|'chips'), options?, unit?,
  //   quick? (show in the icon facts row), icon? (key into IC), suffix? for facts.
  H.CATEGORY_ATTRS = {
    vehicles: [
      { key:'rentalType',   label:'Listing Type',  type:'select', options:['For Sale','For Hire'] },
      { key:'make',         label:'Make',          type:'text',   placeholder:'e.g. Toyota' },
      { key:'model',        label:'Model',         type:'text',   placeholder:'e.g. Hilux' },
      { key:'year',         label:'Year',          type:'number', quick:true, icon:'cal' },
      { key:'mileage',      label:'Mileage',       type:'number', unit:'km', quick:true, icon:'gauge', suffix:'km' },
      { key:'fuel',         label:'Fuel',          type:'select', options:['Petrol','Diesel','Hybrid','Electric'], quick:true, icon:'fuel' },
      { key:'transmission', label:'Transmission',  type:'select', options:['Manual','Automatic'] },
      { key:'bodyType',     label:'Body Type',     type:'select', options:['Sedan','Hatchback','SUV','Double Cab','Single Cab','Van','Bus','Truck','Motorbike','Other'] },
      { key:'condition',    label:'Condition',     type:'select', options:['Brand New','Used','For Parts'] },
      { key:'color',        label:'Colour',        type:'text',   placeholder:'e.g. Silver' },
      { key:'features',     label:'Features',      type:'chips',  options:['Air Conditioning','Power Steering','Electric Windows','Leather Seats','Alloy Wheels','Reverse Camera','Sunroof','Bluetooth','ABS','Airbags','Tow Bar','Mag Wheels'] }
    ],
    property: [
      { key:'rentalType',   label:'Listing Type',  type:'select', options:['For Rent','For Sale'] },
      { key:'propType',     label:'Property Type',  type:'select', options:['Apartment / Flat','House','Townhouse','Cottage','Stand / Land','Commercial','Office'] },
      { key:'beds',         label:'Bedrooms',      type:'select', options:['Studio','1','2','3','4','5','6+'], quick:true, icon:'bed' },
      { key:'baths',        label:'Bathrooms',     type:'select', options:['1','2','3','4','5+'], quick:true, icon:'bath' },
      { key:'size',         label:'Size',          type:'number', unit:'m²', quick:true, icon:'area', suffix:'m²' },
      { key:'furnishing',   label:'Furnishing',    type:'select', options:['Furnished','Unfurnished','Part Furnished'] },
      { key:'features',     label:'Amenities',     type:'chips',  options:['Borehole','Solar Power','Durawall','Electric Fence','Garage','Garden','Swimming Pool','Air Conditioning','Built-in Wardrobes','Prepaid Water','Tiled Floors','Ceiling','Staff Quarters','Tarred Road','Water Tank','CCTV'] }
    ],
    rooms: [
      { key:'roomType',     label:'Room Type',     type:'select', options:['Single Room','Shared Room','Cottage','Full House Share','Self-Contained'] },
      { key:'furnishing',   label:'Furnishing',    type:'select', options:['Furnished','Unfurnished','Part Furnished'] },
      { key:'gender',       label:'Suitable For',  type:'select', options:['Anyone','Males Only','Females Only','Couples'] },
      { key:'features',     label:'Included',      type:'chips',  options:['Water','Electricity','WiFi','Borehole','Solar Power','Own Bathroom','Kitchen Access','Parking','Prepaid Meter','Furnished'] }
    ],
    electronics: [
      { key:'etype',        label:'Type',          type:'select', options:['Phone','Laptop','Desktop','Tablet','TV','Audio','Camera','Gaming','Accessory','Other'], quick:true, icon:'tag' },
      { key:'brand',        label:'Brand',         type:'text',   placeholder:'e.g. Samsung', quick:true },
      { key:'condition',    label:'Condition',     type:'select', options:['Brand New','Used','Refurbished','For Parts'] },
      { key:'storage',      label:'Storage / RAM', type:'text',   placeholder:'e.g. 128GB / 8GB' },
      { key:'warranty',     label:'Warranty',      type:'select', options:['Yes','No'] }
    ],
    furniture: [
      { key:'ftype',        label:'Type',          type:'select', options:['Sofa / Lounge','Bed','Wardrobe','Table','Chairs','Kitchen Unit','Office','Outdoor','Other'] },
      { key:'condition',    label:'Condition',     type:'select', options:['Brand New','Used'] },
      { key:'material',     label:'Material',       type:'text',   placeholder:'e.g. Wood, Leather' }
    ],
    fashion: [
      { key:'ftype',        label:'Type',          type:'select', options:['Clothing','Shoes','Bags','Watches','Jewellery','Accessories'] },
      { key:'gender',       label:'For',           type:'select', options:['Women','Men','Unisex','Kids'] },
      { key:'size',         label:'Size',          type:'text',   placeholder:'e.g. M, UK 8' },
      { key:'condition',    label:'Condition',     type:'select', options:['Brand New','Used'] },
      { key:'brand',        label:'Brand',         type:'text',   placeholder:'optional' }
    ],
    agriculture: [
      { key:'atype',        label:'Type',          type:'select', options:['Livestock','Crops / Produce','Seeds','Equipment','Irrigation','Fertiliser / Feed','Other'] },
      { key:'condition',    label:'Condition',     type:'select', options:['New','Used','Live'] },
      { key:'quantity',     label:'Quantity',      type:'text',   placeholder:'e.g. 50 bales, 10 herd' }
    ],
    pets: [
      { key:'ptype',        label:'Type',          type:'select', options:['Dog','Cat','Bird','Fish','Rabbit','Livestock','Other'] },
      { key:'breed',        label:'Breed',         type:'text',   placeholder:'e.g. Boerboel' },
      { key:'age',          label:'Age',           type:'text',   placeholder:'e.g. 3 months' },
      { key:'gender',       label:'Gender',        type:'select', options:['Male','Female'] },
      { key:'features',     label:'Health',        type:'chips',  options:['Vaccinated','Dewormed','Trained','Papers / Pedigree'] }
    ],
    kids: [
      { key:'ktype',        label:'Type',          type:'select', options:['Clothing','Toys','Prams / Strollers','Cots / Beds','Car Seats','School','Other'] },
      { key:'condition',    label:'Condition',     type:'select', options:['Brand New','Used'] },
      { key:'ageGroup',     label:'Age Group',     type:'select', options:['0-6 months','6-12 months','1-2 years','3-5 years','6-9 years','10+ years'] }
    ],
    services: [
      { key:'stype',        label:'Service Type',  type:'text',   placeholder:'e.g. Plumbing, Tutoring' },
      { key:'availability', label:'Availability',  type:'select', options:['Full-time','Part-time','Weekends','On Call'] },
      { key:'priceBasis',   label:'Pricing',       type:'select', options:['Per Hour','Per Day','Per Job','Negotiable'] }
    ]
  };

  // All possible attribute keys (used to lift attrs onto the listing + persist).
  H.ATTR_KEYS = (function () {
    var s = {};
    Object.keys(H.CATEGORY_ATTRS).forEach(function (cat) {
      H.CATEGORY_ATTRS[cat].forEach(function (f) { s[f.key] = 1; });
    });
    return Object.keys(s);
  })();

  H.attrSchema = function (cat) { return H.CATEGORY_ATTRS[cat] || null; };

  // ---- Posting: render the dynamic fields for a category ----
  H.renderAttrFields = function (cat, vals) {
    var schema = H.CATEGORY_ATTRS[cat];
    if (!schema) return '';
    vals = vals || {};
    var html = '<div class="fg"><div class="fl">Details</div><div class="attr-grid">';
    schema.forEach(function (f) {
      var v = vals[f.key];
      html += '<div class="attr-field' + (f.type === 'chips' ? ' attr-field-full' : '') + '">';
      html += '<label class="attr-lbl">' + H.escHtml(f.label) + (f.unit ? ' (' + f.unit + ')' : '') + '</label>';
      if (f.type === 'select') {
        html += '<select class="fi attr-in" data-attr="' + f.key + '"><option value="">Select…</option>'
          + f.options.map(function (o) { return '<option' + (String(v) === o ? ' selected' : '') + '>' + H.escHtml(o) + '</option>'; }).join('')
          + '</select>';
      } else if (f.type === 'number') {
        html += '<input class="fi attr-in" type="number" inputmode="numeric" data-attr="' + f.key + '" value="' + (v != null ? H.escHtml(v) : '') + '" placeholder="' + H.escHtml(f.placeholder || '0') + '">';
      } else if (f.type === 'chips') {
        var sel = Array.isArray(v) ? v : [];
        html += '<div class="attr-chips" data-attr="' + f.key + '">'
          + f.options.map(function (o) {
            var on = sel.indexOf(o) !== -1;
            return '<button type="button" class="attr-chip' + (on ? ' on' : '') + '" data-val="' + H.escHtml(o) + '" onclick="H._post.toggleChip(this)">' + H.escHtml(o) + '</button>';
          }).join('')
          + '</div>';
      } else {
        html += '<input class="fi attr-in" type="text" data-attr="' + f.key + '" value="' + (v != null ? H.escHtml(v) : '') + '" placeholder="' + H.escHtml(f.placeholder || '') + '">';
      }
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  };

  // ---- Posting: read the current values out of the DOM ----
  H.readAttrFields = function (root) {
    var out = {};
    (root || document).querySelectorAll('.attr-in[data-attr]').forEach(function (el) {
      var k = el.getAttribute('data-attr');
      var val = (el.value || '').trim();
      if (val !== '') out[k] = el.type === 'number' ? Number(val) : val;
    });
    (root || document).querySelectorAll('.attr-chips[data-attr]').forEach(function (box) {
      var k = box.getAttribute('data-attr');
      var on = Array.prototype.slice.call(box.querySelectorAll('.attr-chip.on')).map(function (b) { return b.getAttribute('data-val'); });
      if (on.length) out[k] = on;
    });
    return out;
  };

  // ---- Detail: quick-facts row (bed / bath / size / year / km …) ----
  H.attrQuickFactsHtml = function (l) {
    var cat = l && l.cat; var schema = H.CATEGORY_ATTRS[cat];
    var src = (l && l.attrs) || l || {};
    if (!schema) return '';
    var facts = [];
    schema.forEach(function (f) {
      if (!f.quick) return;
      var v = src[f.key];
      if (v == null || v === '') return;
      var label = (f.key === 'beds' && v === 'Studio') ? 'Studio'
        : (f.suffix ? Number(v).toLocaleString() + ' ' + f.suffix : v);
      var icon = IC[f.icon] || IC.tag;
      facts.push('<div class="qf-item">' + icon + '<span>' + H.escHtml(String(label)) + (f.key === 'beds' && v !== 'Studio' ? ' Bed' + (String(v) === '1' ? '' : 's') : '') + (f.key === 'baths' ? ' Bath' + (String(v) === '1' ? '' : 's') : '') + '</span></div>');
    });
    return facts.length ? '<div class="det-quickfacts">' + facts.join('') + '</div>' : '';
  };

  // ---- Detail: the Overview spec table ----
  H.attrOverviewHtml = function (l) {
    var cat = l && l.cat; var schema = H.CATEGORY_ATTRS[cat];
    var src = (l && l.attrs) || l || {};
    if (!schema) return '';
    var rows = [];
    schema.forEach(function (f) {
      if (f.type === 'chips') return; // amenities render separately
      var v = src[f.key];
      if (v == null || v === '') return;
      var disp = f.suffix ? (Number(v).toLocaleString() + ' ' + f.suffix) : v;
      rows.push('<div class="ov-row"><span class="ov-k">' + H.escHtml(f.label) + '</span><span class="ov-v">' + H.escHtml(String(disp)) + '</span></div>');
    });
    if (!rows.length) return '';
    var title = (cat === 'vehicles') ? 'Car Overview' : (cat === 'property' || cat === 'rooms') ? 'Property Overview' : 'Overview';
    return '<div class="det-section"><div class="det-sec-title">' + title + '</div><div class="ov-table">' + rows.join('') + '</div></div>';
  };

  // ---- Detail: amenities / features chips ----
  H.attrAmenitiesHtml = function (l) {
    var cat = l && l.cat; var schema = H.CATEGORY_ATTRS[cat];
    var src = (l && l.attrs) || l || {};
    if (!schema) return '';
    var field = schema.filter(function (f) { return f.type === 'chips'; })[0];
    if (!field) return '';
    var vals = src[field.key];
    if (!Array.isArray(vals) || !vals.length) return '';
    return '<div class="det-section"><div class="det-sec-title">' + H.escHtml(field.label) + '</div><div class="amenity-wrap">'
      + vals.map(function (v) { return '<span class="amenity-chip">' + H.escHtml(v) + '</span>'; }).join('')
      + '</div></div>';
  };

  // Pull the saved attribute keys off a listing into a single object (for cloud jsonb).
  H.collectAttrs = function (l) {
    var o = {};
    if (l && l.attrs && typeof l.attrs === 'object') return l.attrs;
    H.ATTR_KEYS.forEach(function (k) { if (l && l[k] != null && l[k] !== '') o[k] = l[k]; });
    return o;
  };

  // Apply a stored attrs object back onto a listing (top-level + .attrs) so both
  // the detail Overview and the Browse filters can read them.
  H.applyAttrs = function (l, attrs) {
    if (!l || !attrs || typeof attrs !== 'object') return;
    l.attrs = attrs;
    Object.keys(attrs).forEach(function (k) { if (l[k] == null) l[k] = attrs[k]; });
  };

})(window.H);
