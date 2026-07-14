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
    search: '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    briefcase: '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>',
    shop: '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 10h18l-2-6H5zM5 10v10h14V10M9 20v-6h6v6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></svg>',
    plus: '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    arrow: '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };

  var FEATURES = {
    property: {
      tag: 'Tool', title: 'Estimate a rent price',
      copy: 'See what similar homes in your suburb are renting for before you list.',
      image: 'img/category-heroes/hero-property.jpg', href: '', action: '',
    },
    vehicles: {
      tag: 'Featured', title: 'Vehicle Rental',
      copy: 'Rent a car by the day, week or month from verified local fleets.',
      image: 'img/category-heroes/hero-vehicles.jpg', href: 'rentals', action: 'Explore rentals',
    },
    jobs: {
      tag: 'Open roles', dynamicTag: 'jobs', title: 'Start your career here',
      copy: 'From graduate trainee to senior roles, new vacancies added daily across Zimbabwe.',
      image: 'img/category-heroes/hero-jobs.jpg', href: 'jobs', action: 'Browse jobs',
    },
    electronics: {
      tag: 'Trust & safety', title: 'Verified sellers only',
      copy: 'Look for the verified badge, ID-checked sellers with a track record.',
      image: 'img/category-heroes/hero-electronics.jpg', href: 'help', action: 'Learn about verification',
    },
    furniture: {
      tag: 'Trending in Harare', title: 'Trending now',
      copy: "Corner sofas and dining sets are this week's most-viewed furniture.",
      image: 'img/category-heroes/hero-furniture.jpg', href: 'browse?cat=furniture', action: 'Browse furniture',
    },
    shops: {
      tag: 'Featured', title: 'Browse all shops',
      copy: 'Verified business storefronts across Zimbabwe.',
      image: 'img/category-heroes/hero-shops.jpg', href: 'browse?shops=1', action: 'Browse shops',
    },
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
    return 'browse?cat=' + catKey + '&sub=' + subKey;
  }

  // Splits a subcat list into left-rail "groups" of ~3 items each, mimicking
  // the reference mega-menu's left-column grouping (e.g. "Mobile Phones",
  // "Accessories", "Tablets", "Other").
  function chunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function buildPhotoFeature(key) {
    var feature = FEATURES[key];
    if (!feature) return '';
    var tagAttrs = feature.dynamicTag === 'jobs' ? ' data-mega-jobs-count aria-live="polite"' : '';
    var content =
      '<img class="mega-photo-img" src="' + feature.image + '" alt="" loading="lazy">' +
      '<span class="mega-photo-shade"></span>' +
      '<span class="mega-photo-copy">' +
        '<span class="mega-photo-tag"' + tagAttrs + '>' + feature.tag + '</span>' +
        '<span class="mega-photo-title">' + feature.title + '</span>' +
        '<span class="mega-photo-sub">' + feature.copy + '</span>' +
        (feature.action ? '<span class="mega-photo-link">' + feature.action + ICONS.arrow + '</span>' : '') +
      '</span>';
    return feature.href
      ? '<a class="mega-photo" href="' + feature.href + '">' + content + '</a>'
      : '<div class="mega-photo mega-photo-info">' + content + '</div>';
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
    var featured = '<div class="mega-photo-wrap">' + buildPhotoFeature(entry.cat) + '</div>';
    return (
      '<div class="mega-inner">' +
        '<div class="mega-rail">' + rail + '</div>' +
        '<div class="mega-content">' +
          '<div class="mega-content-head">' +
            '<span class="mega-content-title" id="megaTitle-' + entry.cat + '">' + groups[0][0][1] + '</span>' +
            '<a href="browse?cat=' + entry.cat + '" class="mega-viewall">View All ' + entry.label + ' →</a>' +
          '</div>' +
          '<div class="mega-panels">' + panels + '</div>' +
        '</div>' +
        featured +
      '</div>'
    );
  }

  function buildSimpleMega(entry) {
    if (entry.jobs) {
      return (
        '<div class="mega-simple">' +
          '<div class="mega-simple-links">' +
            '<a href="jobs" class="mega-simple-card">' +
              '<div class="mega-simple-ic">' + ICONS.search + '</div>' +
              '<div><div class="mega-simple-title">Find a Job</div><div class="mega-simple-sub">Browse live vacancies across Zimbabwe</div></div>' +
            '</a>' +
            '<a href="jobs#hire" class="mega-simple-card">' +
              '<div class="mega-simple-ic">' + ICONS.briefcase + '</div>' +
              '<div><div class="mega-simple-title">Hire Talent</div><div class="mega-simple-sub">Post a job and reach candidates for free</div></div>' +
            '</a>' +
          '</div>' +
          '<div class="mega-photo-wrap">' + buildPhotoFeature('jobs') + '</div>' +
        '</div>'
      );
    }
    return (
      '<div class="mega-simple">' +
        '<div class="mega-simple-links">' +
          '<a href="browse?shops=1" class="mega-simple-card">' +
            '<div class="mega-simple-ic">' + ICONS.shop + '</div>' +
            '<div><div class="mega-simple-title">Browse All Shops</div><div class="mega-simple-sub">Verified business storefronts near you</div></div>' +
          '</a>' +
          '<a href="advertise" class="mega-simple-card">' +
            '<div class="mega-simple-ic">' + ICONS.plus + '</div>' +
            '<div><div class="mega-simple-title">Open Your Shop</div><div class="mega-simple-sub">Free storefront, product catalog & inbox</div></div>' +
          '</a>' +
        '</div>' +
        '<div class="mega-photo-wrap">' + buildPhotoFeature('shops') + '</div>' +
      '</div>'
    );
  }

  function ensureDisplayFont() {
    if (document.querySelector('link[href*="family=Fraunces"]')) return;
    var font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap';
    document.head.appendChild(font);
  }

  function injectStyles() {
    if (document.getElementById('navDdStyles')) return;
    var style = document.createElement('style');
    style.id = 'navDdStyles';
    style.textContent =
      '.nav-dd-menu{display:none;position:fixed;background:#fff;border:1px solid #E6DFD1;border-radius:14px;box-shadow:0 20px 50px rgba(11,28,77,.22);z-index:1000;overflow:hidden}' +
      '.nav-dd-menu.dd-show{display:block}' +
      '.mega-inner{display:grid;grid-template-columns:190px minmax(300px,1fr) 300px;width:min(900px,calc(100vw - 32px));min-width:0}' +
      '.mega-rail{background:#F7F4EE;border-right:1px solid #E6DFD1;padding:10px}' +
      '.mega-rail-item{padding:11px 14px;font-size:13.5px;font-weight:700;color:#151A2E;border-radius:9px;cursor:pointer;transition:all .12s}' +
      '.mega-rail-item:hover{background:#fff}' +
      '.mega-rail-item.on{background:#fff;color:#1A3A8F;box-shadow:0 1px 4px rgba(11,28,77,.08)}' +
      '.mega-content{min-width:0;padding:20px 24px}' +
      '.mega-content-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #E6DFD1}' +
      '.mega-content-title{font-size:14.5px;font-weight:800;color:#151A2E}' +
      '.mega-viewall{font-size:12.5px;font-weight:700;color:#B9791E;white-space:nowrap}' +
      '.mega-viewall:hover{text-decoration:underline}' +
      '.mega-panels{position:relative}' +
      '.mega-panel{display:none;column-count:2;column-gap:20px}' +
      '.mega-panel.on{display:block}' +
      '.mega-link{display:block;padding:8px 0;font-size:13.5px;color:#5B6478;font-weight:500;break-inside:avoid}' +
      '.mega-link:hover{color:#1A3A8F;text-decoration:underline}' +
      '.mega-photo-wrap{padding:14px 14px 14px 0;display:flex;min-width:0}' +
      '.mega-photo{position:relative;display:flex;align-items:flex-end;width:100%;min-height:230px;border-radius:12px;overflow:hidden;background:#0B1C4D;color:#fff;isolation:isolate}' +
      '.mega-photo-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .3s ease}' +
      '.mega-photo-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,28,77,.15) 0%,rgba(11,28,77,.42) 36%,rgba(11,28,77,.82) 70%,rgba(11,28,77,.94) 100%)}' +
      '.mega-photo-copy{position:relative;z-index:1;display:flex;flex-direction:column;align-items:flex-start;padding:20px;width:100%}' +
      '.mega-photo-tag{font-size:10.5px;line-height:1.2;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#B9791E;margin-bottom:7px}' +
      '.mega-photo-title{font-family:\'Fraunces\',Georgia,serif;font-size:21px;line-height:1.12;font-weight:700;letter-spacing:-.02em;color:#fff}' +
      '.mega-photo-sub{font-size:11.5px;line-height:1.5;color:#E4E8F3;margin-top:7px}' +
      '.mega-photo-link{display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-size:11.5px;font-weight:800;color:#fff}' +
      '.mega-photo:hover .mega-photo-img{transform:scale(1.035)}' +
      '.mega-photo:hover .mega-photo-link{text-decoration:underline}' +
      '.mega-photo-info{cursor:default}' +
      '.mega-photo-info:hover .mega-photo-img{transform:none}' +
      '.mega-simple{padding:14px;display:grid;grid-template-columns:minmax(320px,1fr) 286px;gap:14px;width:min(650px,calc(100vw - 32px))}' +
      '.mega-simple-links{display:flex;flex-direction:column;gap:4px;align-self:center}' +
      '.mega-simple-card{display:flex;align-items:center;gap:14px;padding:12px;border-radius:10px;transition:background .12s}' +
      '.mega-simple-card:hover{background:#F7F4EE}' +
      '.mega-simple-ic{width:40px;height:40px;border-radius:10px;background:#EEF2FF;color:#1A3A8F;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.mega-simple-title{font-size:14px;font-weight:700;color:#151A2E}' +
      '.mega-simple-sub{font-size:12px;color:#9298A8;margin-top:2px}' +
      '.mega-simple .mega-photo-wrap{padding:0}' +
      '.mega-simple .mega-photo{min-height:210px}' +
      '@media(max-width:980px),(hover:none),(pointer:coarse){.nav-dd-menu{display:none!important}}' +
      '@media(prefers-reduced-motion:reduce){.mega-photo-img{transition:none}}';
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

  function hydrateJobsCount() {
    var targets = document.querySelectorAll('[data-mega-jobs-count]');
    if (!targets.length || !global.PM || typeof global.PM.fetchListingCount !== 'function') return;
    global.PM.fetchListingCount('jobs').then(function (value) {
      var count = Number(value);
      if (!isFinite(count) || count < 0) return;
      count = Math.floor(count);
      var label = count.toLocaleString() + ' open role' + (count === 1 ? '' : 's');
      targets.forEach(function (target) { target.textContent = label; });
    }).catch(function () {
      // Keep the honest, non-numeric "Open roles" fallback on request errors.
    });
  }

  function initDropdowns() {
    var nav = document.querySelector('.cat-nav-w');
    if (!nav) return;
    if (global.matchMedia && !global.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    ensureDisplayFont();
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
        if (window.innerWidth <= 980) return;
        cancelClose();
        closeAll();
        var r = link.getBoundingClientRect();
        menu.style.maxWidth = Math.max(0, window.innerWidth - 32) + 'px';
        menu.style.left = '16px';
        menu.style.top = (r.bottom + 4) + 'px';
        menu.classList.add('dd-show');
        // Measure after display:block, then clamp both edges to a 16px gutter.
        var mw = menu.offsetWidth;
        var maxLeft = Math.max(16, window.innerWidth - mw - 16);
        menu.style.left = Math.max(16, Math.min(r.left, maxLeft)) + 'px';
      }

      link.addEventListener('mouseenter', openMenu);
      link.addEventListener('mouseleave', scheduleCloseAll);
      menu.addEventListener('mouseenter', cancelClose);
      menu.addEventListener('mouseleave', scheduleCloseAll);
    });

    hydrateJobsCount();
    window.addEventListener('scroll', closeAll, { passive: true });
    window.addEventListener('resize', closeAll, { passive: true });
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
