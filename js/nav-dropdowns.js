// Shared mega-menu hover navigation for the top category nav.
// Uses the real app category/subcategory taxonomy (www/js/attributes.js, www/js/app.js)
// so dropdown contents match what's actually in the app, not invented labels.
//
// Menus render into document.body as position:fixed and are positioned via
// getBoundingClientRect() on open, because .cat-nav-w uses overflow-x:auto for
// horizontal scrolling, which clips any in-flow/absolutely-positioned child.
(function (global) {
  var SUBCATS = {
    property: [
      ['houses', 'Houses'],
      ['flats', 'Flats & Apartments'],
      ['cottages', 'Cottages & Garden Flats'],
      ['townhouses', 'Townhouses & Clusters'],
      ['stands', 'Stands & Land'],
      ['commercial', 'Commercial & Office'],
      ['student', 'Student Accommodation'],
    ],
    vehicles: [
      ['cars', 'Cars'],
      ['bakkies', 'Bakkies & Trucks'],
      ['suvs', 'SUVs & 4x4'],
      ['kombis', 'Kombis & Buses'],
      ['motorbikes', 'Motorbikes'],
      ['trailers', 'Trailers'],
      ['parts', 'Spares & Parts'],
      ['tyres', 'Tyres & Rims'],
    ],
    electronics: [
      ['phones', 'Phones & Tablets'],
      ['computers', 'Laptops & Computers'],
      ['tvs', 'TVs & Monitors'],
      ['audio', 'Audio & Sound'],
      ['cameras', 'Cameras'],
      ['gaming', 'Gaming'],
      ['accessories', 'Accessories'],
    ],
    furniture: [
      ['sofas', 'Sofas & Lounge'],
      ['beds', 'Beds & Bedroom'],
      ['dining', 'Dining & Kitchen'],
      ['office', 'Office Furniture'],
      ['outdoor', 'Garden & Outdoor'],
      ['wardrobes', 'Wardrobes & Storage'],
      ['curtains', 'Curtains & Blinds'],
      ['rugs', 'Rugs & Carpets'],
      ['lighting', 'Lighting & Fans'],
      ['decor', 'Home Décor'],
    ],
  };

  var ICONS = {
    property: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    vehicles: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 17H5v-5l2-6h10l2 6v5z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
    electronics: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
    furniture: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="10" width="18" height="8" rx="2"/><rect x="5" y="7" width="3" height="3" rx="1"/><rect x="16" y="7" width="3" height="3" rx="1"/></svg>',
  };

  var CONFIG = [
    { label: 'Property', cat: 'property' },
    { label: 'Vehicles', cat: 'vehicles' },
    { label: 'Jobs', jobs: true },
    { label: 'Electronics', cat: 'electronics' },
    { label: 'Furniture', cat: 'furniture' },
    { label: 'Shops', shops: true },
  ];

  function subcatUrl(catKey, subKey) {
    return 'browse.html?cat=' + catKey + '&sub=' + subKey;
  }

  // Splits a subcat list into left-rail "groups" of ~3 items each, mimicking
  // the reference mega-menu's left-column grouping (e.g. "Mobile Phones",
  // "Accessories", "Tablets", "Other").
  function chunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function buildCategoryMega(entry) {
    var subs = SUBCATS[entry.cat] || [];
    var groups = chunk(subs, 3);
    var rail = groups
      .map(function (g, i) {
        var groupLabel = g[0][1];
        return (
          '<div class="mega-rail-item' + (i === 0 ? ' on' : '') + '" data-group="' + i + '">' + groupLabel + '</div>'
        );
      })
      .join('');
    var panels = groups
      .map(function (g, i) {
        var links = g
          .map(function (s) {
            return '<a href="' + subcatUrl(entry.cat, s[0]) + '" class="mega-link">' + s[1] + '</a>';
          })
          .join('');
        return '<div class="mega-panel' + (i === 0 ? ' on' : '') + '" data-panel="' + i + '">' + links + '</div>';
      })
      .join('');
    var featured = entry.cat === 'vehicles'
      ? '<a href="rentals.html" class="mega-featured">' +
          '<span class="mega-featured-ic">🔑</span>' +
          '<span><span class="mega-featured-title">Vehicle Rental</span>' +
          '<span class="mega-featured-sub">Rent a car by the day, week or month</span></span>' +
        '</a>'
      : '';
    return (
      '<div class="mega-inner">' +
        '<div class="mega-rail">' + rail + '</div>' +
        '<div class="mega-content">' +
          '<div class="mega-content-head">' +
            '<span class="mega-content-title" id="megaTitle-' + entry.cat + '">' + groups[0][0][1] + '</span>' +
            '<a href="browse.html?cat=' + entry.cat + '" class="mega-viewall">View All ' + entry.label + ' →</a>' +
          '</div>' +
          '<div class="mega-panels">' + panels + '</div>' +
          featured +
        '</div>' +
      '</div>'
    );
  }

  function buildSimpleMega(entry) {
    if (entry.jobs) {
      return (
        '<div class="mega-simple">' +
          '<a href="jobs.html" class="mega-simple-card">' +
            '<div class="mega-simple-ic">🔍</div>' +
            '<div><div class="mega-simple-title">Find a Job</div><div class="mega-simple-sub">Browse live vacancies across Zimbabwe</div></div>' +
          '</a>' +
          '<a href="jobs.html#hire" class="mega-simple-card">' +
            '<div class="mega-simple-ic">💼</div>' +
            '<div><div class="mega-simple-title">Hire Talent</div><div class="mega-simple-sub">Post a job and reach candidates for free</div></div>' +
          '</a>' +
        '</div>'
      );
    }
    return (
      '<div class="mega-simple">' +
        '<a href="browse.html?shops=1" class="mega-simple-card">' +
          '<div class="mega-simple-ic">🏬</div>' +
          '<div><div class="mega-simple-title">Browse All Shops</div><div class="mega-simple-sub">Verified business storefronts near you</div></div>' +
        '</a>' +
        '<a href="advertise.html" class="mega-simple-card">' +
          '<div class="mega-simple-ic">➕</div>' +
          '<div><div class="mega-simple-title">Open Your Shop</div><div class="mega-simple-sub">Free storefront, product catalog & inbox</div></div>' +
        '</a>' +
      '</div>'
    );
  }

  function injectStyles() {
    if (document.getElementById('navDdStyles')) return;
    var style = document.createElement('style');
    style.id = 'navDdStyles';
    style.textContent =
      '.nav-dd-menu{display:none;position:fixed;background:#fff;border:1px solid #E2E8F0;border-radius:14px;box-shadow:0 20px 50px rgba(15,36,96,.2);z-index:1000;overflow:hidden}' +
      '.nav-dd-menu.dd-show{display:block}' +
      '.mega-inner{display:flex;min-width:560px}' +
      '.mega-rail{width:200px;background:#F8FAFC;border-right:1px solid #E2E8F0;padding:10px}' +
      '.mega-rail-item{padding:11px 14px;font-size:13.5px;font-weight:700;color:#0F172A;border-radius:9px;cursor:pointer;transition:all .12s}' +
      '.mega-rail-item:hover{background:#fff}' +
      '.mega-rail-item.on{background:#fff;color:#1A3A8F;box-shadow:0 1px 4px rgba(15,36,96,.08)}' +
      '.mega-content{flex:1;padding:20px 24px}' +
      '.mega-content-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #E2E8F0}' +
      '.mega-content-title{font-size:14.5px;font-weight:800;color:#0F172A}' +
      '.mega-viewall{font-size:12.5px;font-weight:700;color:#C5871A}' +
      '.mega-viewall:hover{text-decoration:underline}' +
      '.mega-panels{position:relative}' +
      '.mega-panel{display:none;column-count:2;column-gap:20px}' +
      '.mega-panel.on{display:block}' +
      '.mega-link{display:block;padding:8px 0;font-size:13.5px;color:#475569;font-weight:500;break-inside:avoid}' +
      '.mega-link:hover{color:#1A3A8F;text-decoration:underline}' +
      '.mega-featured{display:flex;align-items:center;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid #E2E8F0}' +
      '.mega-featured-ic{font-size:20px;width:36px;height:36px;border-radius:9px;background:#FBF4E6;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.mega-featured-title{display:block;font-size:13.5px;font-weight:800;color:#C5871A}' +
      '.mega-featured-sub{display:block;font-size:11.5px;color:#94A3B8;margin-top:1px}' +
      '.mega-featured:hover .mega-featured-title{text-decoration:underline}' +
      '.mega-simple{padding:14px;min-width:340px;display:flex;flex-direction:column;gap:4px}' +
      '.mega-simple-card{display:flex;align-items:center;gap:14px;padding:12px;border-radius:10px;transition:background .12s}' +
      '.mega-simple-card:hover{background:#F8FAFC}' +
      '.mega-simple-ic{font-size:22px;width:40px;height:40px;border-radius:10px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.mega-simple-title{font-size:14px;font-weight:700;color:#0F172A}' +
      '.mega-simple-sub{font-size:12px;color:#94A3B8;margin-top:2px}';
    document.head.appendChild(style);
  }

  function wireCategoryMega(menu) {
    var rail = menu.querySelectorAll('.mega-rail-item');
    var panels = menu.querySelectorAll('.mega-panel');
    var titleEl = menu.querySelector('.mega-content-title');
    rail.forEach(function (item) {
      item.addEventListener('mouseenter', function () {
        var idx = item.getAttribute('data-group');
        rail.forEach(function (r) { r.classList.remove('on'); });
        panels.forEach(function (p) { p.classList.remove('on'); });
        item.classList.add('on');
        var panel = menu.querySelector('.mega-panel[data-panel="' + idx + '"]');
        if (panel) panel.classList.add('on');
        if (titleEl) titleEl.textContent = item.textContent;
      });
    });
  }

  function initDropdowns() {
    var nav = document.querySelector('.cat-nav-w');
    if (!nav) return;
    injectStyles();

    var allMenus = [];
    var closeTimer = null;

    function closeAll() {
      allMenus.forEach(function (m) { m.classList.remove('dd-show'); });
    }
    function scheduleCloseAll() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(closeAll, 150);
    }
    function cancelClose() {
      clearTimeout(closeTimer);
    }

    CONFIG.forEach(function (entry) {
      var link = Array.prototype.find.call(nav.querySelectorAll('.cnav'), function (a) {
        return a.textContent.trim() === entry.label;
      });
      if (!link) return;

      var menu = document.createElement('div');
      menu.className = 'nav-dd-menu';
      var isSimple = entry.jobs || entry.shops;
      menu.innerHTML = isSimple ? buildSimpleMega(entry) : buildCategoryMega(entry);
      document.body.appendChild(menu);
      allMenus.push(menu);
      if (!isSimple) wireCategoryMega(menu);

      function openMenu() {
        cancelClose();
        closeAll();
        var r = link.getBoundingClientRect();
        menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 590) + 'px';
        menu.style.top = (r.bottom + 4) + 'px';
        menu.classList.add('dd-show');
        // re-clamp after becoming visible (offsetWidth is 0 while display:none)
        var mw = menu.offsetWidth;
        if (r.left + mw > window.innerWidth - 16) {
          menu.style.left = (window.innerWidth - mw - 16) + 'px';
        }
      }

      link.addEventListener('mouseenter', openMenu);
      link.addEventListener('mouseleave', scheduleCloseAll);
      menu.addEventListener('mouseenter', cancelClose);
      menu.addEventListener('mouseleave', scheduleCloseAll);
    });

    window.addEventListener('scroll', closeAll, { passive: true });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-dd-menu') && !e.target.closest('.cnav')) closeAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDropdowns);
  } else {
    initDropdowns();
  }
})(window);
