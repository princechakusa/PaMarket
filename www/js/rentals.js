/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE — VEHICLE RENTALS (Customer-facing)
 * Pages: RentalListings, RentalVehicleDetail, RentalCompanyProfile, RentalFavorites
 */
'use strict';
(function (H) {
  const esc  = (s) => H.escHtml(s);
  const fmt  = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // ── Shared rental state ──────────────────────────────────────────────────
  H._rental = H._rental || {};
  const R = H._rental;
  R.browse      = R.browse      || [];
  R.featured    = R.featured    || [];
  R.favIds      = R.favIds      || new Set();
  R.detailCache = R.detailCache || {};
  R.compCache   = R.compCache   || {};
  R.filters     = R.filters     || { cat: null, city: null, trans: null, fuel: null, avail: false };
  R.page        = 0;
  R.hasMore     = true;
  R._loading    = false;

  // ── Icon library ─────────────────────────────────────────────────────────
  const I = {
    car:      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2M7 17h10"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M5 9l2-4h10l2 4"/></svg>',
    loc:      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    eye:      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    heart:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    heartF:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="#1A3A8F" stroke="#1A3A8F" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    star:     '<svg viewBox="0 0 24 24" width="13" height="13" fill="#F5A623" stroke="#F5A623" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    starO:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#D4D4D8" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    starOn:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="#F5A623" stroke="#F5A623" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    chat:     '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    phone:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.19 12.6 19.79 19.79 0 0 1 1.12 3.93A2 2 0 0 1 3.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z"/></svg>',
    wa:       '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 0C5.364 0 0 5.372 0 11.994c0 2.116.554 4.1 1.524 5.822L.057 24l6.304-1.654A11.978 11.978 0 0 0 11.99 24C18.626 24 24 18.628 24 12.006 24 5.372 18.626 0 11.99 0zm.01 21.818a9.886 9.886 0 0 1-5.031-1.375l-.361-.214-3.741.981.999-3.648-.235-.374A9.82 9.82 0 0 1 2.18 12c0-5.418 4.412-9.824 9.82-9.824 5.418 0 9.824 4.406 9.824 9.824 0 5.418-4.406 9.818-9.824 9.818z"/></svg>',
    gear:     '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    fuel:     '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 22V3a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v4h1a4 4 0 0 1 4 4v2a2 2 0 0 0 4 0V7l-3-3"/><path d="M3 11h10"/></svg>',
    flag:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    share:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    filter:   '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>',
    check:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    seats:    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    verified: '<svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:middle;flex-shrink:0"><path fill="#00A0E9" d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.78-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12z"/><path d="M9.6 12.3l1.9 1.9 4.1-5.1" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bldg:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
  };

  const BRAND_LABELS = {
    toyota:'Toyota', honda:'Honda', nissan:'Nissan', mercedes:'Mercedes-Benz',
    bmw:'BMW', ford:'Ford', isuzu:'Isuzu', hyundai:'Hyundai', kia:'Kia',
    vw:'Volkswagen', mitsubishi:'Mitsubishi', suzuki:'Suzuki', mazda:'Mazda', other:'Other'
  };
  const CAT_LABELS = {
    suv:'SUV', sedan:'Sedan', pickup:'Pickup', minibus:'Minibus',
    luxury:'Luxury', bus:'Bus', motorbike:'Motorbike', other:'Other'
  };

  function brandLabel(slug)  { return BRAND_LABELS[slug]  || slug || ''; }
  function catLabel(slug)    { return CAT_LABELS[slug]     || slug || ''; }
  function rateLabel(r)      { return r ? '$' + fmt(r) + '/day' : 'Rate on request'; }
  function availBadge(avail) {
    return avail
      ? '<span style="font-size:10px;font-weight:800;color:#166534;background:#DCFCE7;border-radius:20px;padding:2px 7px">Available</span>'
      : '<span style="font-size:10px;font-weight:800;color:#9A3412;background:#FEE2E2;border-radius:20px;padding:2px 7px">Unavailable</span>';
  }

  // ── Listing browse card ───────────────────────────────────────────────────
  function _browseCard(v) {
    const lid    = esc(v.id);
    const saved  = R.favIds.has(v.id);
    const img    = v.cover_url
      ? `<img src="${esc(v.cover_url)}" alt="${esc((brandLabel(v.brand_slug) + ' ' + (v.model || '')).trim())}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94A3B8">${I.car}</div>`;
    return `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;overflow:hidden;position:relative" onclick="H._rental.openDetail('${lid}')">
      <div style="position:relative;width:100%;height:160px;background:#EEF2FB;overflow:hidden">
        ${img}
        ${v.is_featured ? '<div style="position:absolute;top:8px;left:8px;background:#F5A623;color:#fff;font-size:10px;font-weight:800;border-radius:20px;padding:2px 8px">Featured</div>' : ''}
        <button onclick="event.stopPropagation();H._rental.toggleFav('${lid}')" aria-label="${saved ? 'Remove from saved' : 'Save'}" style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;border:none;background:rgba(255,255,255,.9);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">${saved ? I.heartF : I.heart}</button>
      </div>
      <div style="padding:12px">
        <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:2px">${esc(brandLabel(v.brand_slug) + ' ' + (v.model || ''))} <span style="font-weight:500;color:var(--sub)">${v.year || ''}</span></div>
        <div style="font-size:16px;font-weight:800;color:#1A3A8F;margin-bottom:6px">${rateLabel(v.daily_rate)}</div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${availBadge(v.is_available)}
          <span style="font-size:11.5px;color:var(--sub);display:flex;align-items:center;gap:3px">${I.loc}${esc(v.city || '')}</span>
          ${v.transmission ? `<span style="font-size:11px;color:var(--sub);display:flex;align-items:center;gap:3px">${I.gear}${esc(v.transmission)}</span>` : ''}
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--sub);display:flex;align-items:center;gap:4px">${I.bldg}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.company_name || '')}</span></div>
      </div>
    </div>`;
  }

  // ── Featured carousel card (wider horizontal card) ────────────────────────
  function _featCard(v) {
    const lid = esc(v.id);
    const img = v.cover_url
      ? `<img src="${esc(v.cover_url)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94A3B8">${I.car}</div>`;
    return `<div onclick="H._rental.openDetail('${lid}')" style="flex-shrink:0;width:220px;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;overflow:hidden;cursor:pointer">
      <div style="width:220px;height:120px;background:#EEF2FB;overflow:hidden">${img}</div>
      <div style="padding:10px">
        <div style="font-size:13px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(brandLabel(v.brand_slug) + ' ' + (v.model || ''))}</div>
        <div style="font-size:14px;font-weight:800;color:#1A3A8F;margin-top:2px">${rateLabel(v.daily_rate)}</div>
        <div style="font-size:11px;color:var(--sub);margin-top:4px;display:flex;align-items:center;gap:3px">${I.loc}${esc(v.city || '')}</div>
      </div>
    </div>`;
  }

  // ── Filter chip bar ───────────────────────────────────────────────────────
  function _filterChip(label, active, onclick) {
    return `<button onclick="${onclick}" style="flex-shrink:0;padding:7px 13px;border-radius:20px;border:1.5px solid ${active ? '#1A3A8F' : 'var(--border,#E8ECF4)'};background:${active ? '#1A3A8F' : 'var(--card,#fff)'};color:${active ? '#fff' : 'var(--text)'};font-size:12.5px;font-weight:${active ? '700' : '500'};cursor:pointer;white-space:nowrap;font-family:inherit">${label}</button>`;
  }

  function _filterBar() {
    const f = R.filters;
    const cats   = [['All',''],['SUV','suv'],['Sedan','sedan'],['Pickup','pickup'],['Minibus','minibus'],['Luxury','luxury'],['Motorbike','motorbike']];
    const cities = ['All Zimbabwe','Harare','Bulawayo','Mutare','Gweru','Masvingo','Victoria Falls'];
    const trans  = [['Any',''],['Manual','Manual'],['Automatic','Automatic'],['CVT','CVT']];
    const fuels  = [['Any',''],['Petrol','Petrol'],['Diesel','Diesel'],['Hybrid','Hybrid'],['Electric','Electric']];

    const catChips  = cats.map(([l,v])  => _filterChip(l, f.cat   === (v||null),   `H._rental.setFilter('cat','${v || ''}')`)).join('');
    const cityChips = cities.map(c      => _filterChip(c, (f.city  === c || (!f.city && c==='All Zimbabwe')), `H._rental.setFilter('city','${esc(c)}')`)).join('');
    const transChips= trans.map(([l,v]) => _filterChip(l, f.trans  === (v||null),   `H._rental.setFilter('trans','${v || ''}')`)).join('');
    const fuelChips = fuels.map(([l,v]) => _filterChip(l, f.fuel   === (v||null),   `H._rental.setFilter('fuel','${v || ''}')`)).join('');

    return `<div style="background:var(--card,#fff);border-bottom:1px solid var(--border,#E8ECF4);padding:10px 0 0">
      <div style="display:flex;gap:8px;overflow-x:auto;padding:0 16px 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch">${catChips}</div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding:0 16px 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch">${cityChips}</div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding:0 16px 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch">${transChips}${fuelChips}
        ${_filterChip('Available now', !!f.avail, "H._rental.setFilter('avail','')")}
      </div>
    </div>`;
  }

  // ── Skeleton cards ────────────────────────────────────────────────────────
  function _skelCards(n) {
    const c = `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;overflow:hidden">
      <div class="skel" style="width:100%;height:160px;border-radius:0"></div>
      <div style="padding:12px"><div class="skel skel-line w80" style="margin-bottom:8px"></div><div class="skel skel-line w50"></div></div>
    </div>`;
    return Array(n || 6).fill(c).join('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalListings — browse & search
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalListings = function () {
    const featHtml = R.featured.length
      ? `<div style="padding:14px 0 6px"><div style="font-size:13px;font-weight:700;color:var(--sub);padding:0 16px 8px;text-transform:uppercase;letter-spacing:.5px">Featured</div><div style="display:flex;gap:12px;overflow-x:auto;padding:0 16px 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch">${R.featured.map(_featCard).join('')}</div></div>`
      : '';

    const gridHtml = R.browse.length
      ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px">${R.browse.map(_browseCard).join('')}</div>`
      : (!R._loading ? H.emptyState('No vehicles found', 'Try adjusting your filters.', 'Clear Filters', "H._rental.clearFilters()") : '');

    const skels = R._loading && !R.browse.length
      ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px">${_skelCards(6)}</div>`
      : '';

    const countBadge = R.browse.length
      ? `<div style="font-size:12px;color:var(--sub);padding:8px 16px 0">${R.browse.length}${R.hasMore ? '+' : ''} vehicle${R.browse.length === 1 ? '' : 's'}</div>`
      : '';

    return `<div class="page active" id="rentalListingsPage">
      <div style="position:sticky;top:0;z-index:20;background:var(--bg,#F0F4FF)">
        <div style="background:#1A3A8F;padding:0 12px 0">
          <div style="display:flex;align-items:center;gap:8px;padding:10px 0">
            <button class="back" onclick="H.goBack()" style="color:#fff" aria-label="Back"><svg viewBox="0 0 24 24" width="22" height="22"><polyline points="15 18 9 12 15 6" stroke="#fff" stroke-width="2.5" fill="none"/></svg></button>
            <div style="flex:1;background:rgba(255,255,255,.15);border-radius:10px;display:flex;align-items:center;gap:8px;padding:0 12px">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input id="rentalSearch" placeholder="Search rentals…" autocomplete="off" oninput="H._rental.onSearch(this.value)" style="flex:1;border:none;outline:none;padding:11px 0;font-size:14px;background:transparent;color:#fff;caret-color:#F5A623;font-family:inherit">
            </div>
            <button onclick="H.openInner('RentalFavorites')" style="color:#fff;background:rgba(255,255,255,.15);border:none;border-radius:10px;padding:9px 12px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;font-family:inherit">${I.heart}Saved</button>
          </div>
        </div>
        ${_filterBar()}
      </div>
      ${featHtml}
      ${countBadge}
      ${skels}
      ${gridHtml}
      ${R._loading && R.browse.length ? `<div style="text-align:center;padding:20px"><div class="skel" style="width:120px;height:36px;border-radius:20px;margin:0 auto"></div></div>` : ''}
      ${!R._loading && R.hasMore && R.browse.length ? `<div style="padding:16px;text-align:center"><button onclick="H._rental.loadMore()" class="btn-sec" style="min-width:160px">Load more</button></div>` : ''}
      <div style="height:90px"></div>
    </div>`;
  };

  H.pages.RentalListings_after = function () {
    if (!R.browse.length && !R._loading) H._rental.loadBrowse(true);
    window._rentalSearchTimer = null;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalVehicleDetail
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalVehicleDetail = function (params) {
    const id  = params && params.id;
    const det = id && R.detailCache[id];

    if (!det) {
      return `<div class="page active" id="rvdPage" data-id="${esc(id || '')}">
        <div class="det-topbar" style="background:#1A3A8F">
          <button class="back" onclick="H.goBack()" style="color:#fff" aria-label="Back"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" stroke="#fff" stroke-width="2.5" fill="none"/></svg></button>
          <div class="det-topbar-title" style="color:#fff">Vehicle Detail</div>
          <div style="width:34px"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px">${_skelCards(4)}</div>
      </div>`;
    }

    const d      = det;
    const u      = H.currentUser();
    const saved  = R.favIds.has(id);
    const photos = d.media || [];
    const specs  = d.specs || {};
    const feats  = d.features || [];
    const comp   = d.company || {};

    const photoHtml = photos.length
      ? `<img src="${esc(photos[0].url)}" id="rvdPhotoImg" data-photos="${esc(JSON.stringify(photos.map(m => m.url)))}" onclick="H.openPhotoViewer(JSON.parse(this.dataset.photos),0)" style="cursor:zoom-in;position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
      : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#EEF2FB;color:#94A3B8"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2M7 17h10"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M5 9l2-4h10l2 4"/></svg></div>`;

    const specRow = (icon, label, val) => val
      ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border,#E8ECF4)"><span style="color:var(--sub)">${icon}</span><span style="font-size:13px;color:var(--sub);flex:1">${label}</span><span style="font-size:13px;font-weight:700;color:var(--text)">${esc(String(val))}</span></div>`
      : '';

    const specsHtml = [
      specRow(I.gear,     'Transmission',  specs.transmission),
      specRow(I.fuel,     'Fuel type',     specs.fuel_type),
      specRow(I.car,      'Drive type',    specs.drive_type),
      specRow(I.seats,    'Seats',         specs.seats),
      specRow(I.calendar, 'Year',          d.year),
      specRow(I.eye,      'Mileage',       specs.mileage_km ? fmt(specs.mileage_km) + ' km' : null),
    ].filter(Boolean).join('');

    const pricingHtml = [
      d.daily_rate   ? `<div style="padding:12px;background:var(--card,#fff);border-radius:12px;border:1px solid var(--border,#E8ECF4)"><div style="font-size:11px;font-weight:600;color:var(--sub);text-transform:uppercase;letter-spacing:.5px">Daily</div><div style="font-size:20px;font-weight:800;color:#1A3A8F;margin-top:4px">$${fmt(d.daily_rate)}</div></div>` : '',
      d.weekly_rate  ? `<div style="padding:12px;background:var(--card,#fff);border-radius:12px;border:1px solid var(--border,#E8ECF4)"><div style="font-size:11px;font-weight:600;color:var(--sub);text-transform:uppercase;letter-spacing:.5px">Weekly</div><div style="font-size:20px;font-weight:800;color:#1A3A8F;margin-top:4px">$${fmt(d.weekly_rate)}</div></div>` : '',
      d.monthly_rate ? `<div style="padding:12px;background:var(--card,#fff);border-radius:12px;border:1px solid var(--border,#E8ECF4)"><div style="font-size:11px;font-weight:600;color:var(--sub);text-transform:uppercase;letter-spacing:.5px">Monthly</div><div style="font-size:20px;font-weight:800;color:#1A3A8F;margin-top:4px">$${fmt(d.monthly_rate)}</div></div>` : '',
    ].filter(Boolean).join('');

    const termsHtml = (d.deposit || d.min_rental_days || d.driver_rate)
      ? `<div class="det-section"><div class="det-sec-title">Rental Terms</div>
          <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:2px 14px">
            ${d.deposit        ? specRow(I.calendar, 'Security deposit', '$' + fmt(d.deposit)) : ''}
            ${d.min_rental_days? specRow(I.calendar, 'Minimum rental',   d.min_rental_days + ' day' + (d.min_rental_days===1?'':'s')) : ''}
            ${d.driver_rate    ? specRow(I.seats,    'Driver rate',       '$' + fmt(d.driver_rate) + '/day') : ''}
          </div></div>`
      : '';

    const featuresHtml = feats.length
      ? `<div class="det-section"><div class="det-sec-title">Features & Extras</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">${feats.map(f => `<span style="padding:6px 12px;background:#EEF2FB;border-radius:20px;font-size:12px;font-weight:600;color:#1A3A8F;display:flex;align-items:center;gap:4px">${I.check}${esc(f.feature)}</span>`).join('')}</div></div>`
      : '';

    const avgRating  = comp.avg_rating ? Number(comp.avg_rating).toFixed(1) : null;
    const starsFill  = avgRating ? Math.round(Number(avgRating)) : 0;
    const starsHtml  = [1,2,3,4,5].map(n => `<svg viewBox="0 0 24 24" width="11" height="11" fill="${n<=starsFill?'#F5A623':'none'}" stroke="${n<=starsFill?'#F5A623':'#D4D4D8'}" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('');

    const compCard = `<div onclick="H.openInner('RentalCompanyProfile',{id:'${esc(comp.id || '')}'})" style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center;cursor:pointer">
      <div style="width:48px;height:48px;border-radius:12px;background:#EEF2FB;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#1A3A8F">
        ${comp.logo_url ? `<img src="${esc(comp.logo_url)}" style="width:100%;height:100%;object-fit:cover">` : I.bldg}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:5px">${esc(comp.name || '')}${comp.is_verified ? I.verified : ''}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:3px">${starsHtml}<span style="font-size:12px;color:var(--sub)">${avgRating || '—'} · ${comp.review_count || 0} review${(comp.review_count||0)===1?'':'s'}</span></div>
        <div style="font-size:12px;color:var(--sub);margin-top:2px">${comp.fleet_count || 0} vehicle${(comp.fleet_count||0)===1?'':'s'} in fleet</div>
      </div>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94A3B8" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;

    const ctaBar = u
      ? `<div style="position:fixed;bottom:0;left:0;right:0;z-index:30;background:var(--card,#fff);border-top:1px solid var(--border,#E8ECF4);padding:12px 16px;padding-bottom:calc(12px + var(--safe-bottom,0px));display:flex;gap:10px">
          <button onclick="H._rental.chatCompany('${esc(id)}')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:13px;border-radius:12px;border:none;background:#1A3A8F;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">${I.chat}Chat</button>
          ${comp.whatsapp ? `<button onclick="H._rental.waCompany('${esc(id)}')" style="width:52px;display:flex;align-items:center;justify-content:center;border-radius:12px;border:none;background:#25D366;color:#fff;cursor:pointer;font-family:inherit">${I.wa}</button>` : ''}
          ${comp.phone    ? `<button onclick="H._rental.callCompany('${esc(id)}')" style="width:52px;display:flex;align-items:center;justify-content:center;border-radius:12px;border:1.5px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);cursor:pointer;font-family:inherit">${I.phone}</button>` : ''}
        </div>`
      : `<div style="position:fixed;bottom:0;left:0;right:0;z-index:30;background:var(--card,#fff);border-top:1px solid var(--border,#E8ECF4);padding:12px 16px;padding-bottom:calc(12px + var(--safe-bottom,0px))">
          <button onclick="H.requireAuth('Sign in to contact this company')" style="width:100%;padding:13px;border-radius:12px;border:none;background:#1A3A8F;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">${I.chat} Sign in to Contact</button>
        </div>`;

    return `<div class="page active det-page" id="rvdPage" data-id="${esc(id)}">
      <div class="det-photo-wrap" id="rvdPhoto" style="position:relative;width:100%;aspect-ratio:16/9;min-height:200px;background:#EEF2FB;overflow:hidden">
        ${photoHtml}
        ${photos.length > 1 ? `<div class="photo-dots">${photos.map((_,i)=>`<div class="pdot ${i===0?'on':''}" onclick="H._rental._setPhoto(${i})"></div>`).join('')}</div><div class="photo-counter" id="rvdPhotoCount">1 / ${photos.length}</div>` : ''}
        <div class="det-topbar" style="background:transparent">
          <button class="det-icon-btn" onclick="H.goBack()" aria-label="Back"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" stroke="#fff" stroke-width="2.5" fill="none"/></svg></button>
          <div style="flex:1"></div>
          <button class="det-icon-btn" onclick="H._rental.shareVehicle('${esc(id)}')" aria-label="Share">${I.share}</button>
          <button class="det-icon-btn${saved?' saved':''}" data-rvd-save="${esc(id)}" onclick="H._rental.toggleFav('${esc(id)}')" aria-label="${saved?'Unsave':'Save'}">${saved ? I.heartF : I.heart}</button>
        </div>
      </div>

      <div style="padding:16px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px">
          <div>
            <div style="font-size:20px;font-weight:800;color:var(--text)">${esc(brandLabel(d.brand_slug) + ' ' + (d.model || ''))} <span style="font-weight:500;color:var(--sub);font-size:16px">${d.year || ''}</span></div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              ${availBadge(d.is_available)}
              <span style="font-size:12px;color:var(--sub);display:flex;align-items:center;gap:3px">${I.loc}${esc(d.city || '')}, ${esc(d.province || '')}</span>
            </div>
          </div>
          <button onclick="H._rental.reportVehicle('${esc(id)}')" style="background:none;border:none;color:var(--sub);cursor:pointer;padding:4px;flex-shrink:0">${I.flag}</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;margin-bottom:16px">${pricingHtml}</div>

        ${specsHtml ? `<div class="det-section"><div class="det-sec-title">Specifications</div><div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:2px 14px">${specsHtml}</div></div>` : ''}
        ${featuresHtml}
        ${d.description ? `<div class="det-section"><div class="det-sec-title">Description</div><div style="font-size:14px;color:var(--text);line-height:1.65;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:14px">${esc(d.description)}</div></div>` : ''}
        ${termsHtml}

        <div class="det-section"><div class="det-sec-title">Listed by</div>${compCard}</div>

        <button onclick="H._rental.reportVehicle('${esc(id)}')" style="background:none;border:none;color:var(--sub);font-size:13px;cursor:pointer;padding:8px 0;display:flex;align-items:center;gap:6px;font-family:inherit">${I.flag}Report this listing</button>
      </div>

      <div style="height:90px"></div>
      ${ctaBar}
    </div>`;
  };

  H.pages.RentalVehicleDetail_after = function (params) {
    const id = params && params.id;
    if (!id) return;
    H._rental.loadDetail(id);
    H._rental._incrementView(id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalCompanyProfile
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalCompanyProfile = function (params) {
    const id   = params && params.id;
    const comp = id && R.compCache[id];

    if (!comp) {
      return `<div class="page active" id="rcpPage" data-id="${esc(id || '')}">
        ${H.innerTopbar('Company Profile')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px">${_skelCards(4)}</div>
      </div>`;
    }

    const avgRating  = comp.avg_rating ? Number(comp.avg_rating).toFixed(1) : null;
    const starsFill  = avgRating ? Math.round(Number(avgRating)) : 0;
    const bigStars   = [1,2,3,4,5].map(n => `<svg viewBox="0 0 24 24" width="16" height="16" fill="${n<=starsFill?'#F5A623':'none'}" stroke="${n<=starsFill?'#F5A623':'#D4D4D8'}" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('');

    const fleet = (comp.fleet || []).slice(0, 8);
    const fleetHtml = fleet.length
      ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${fleet.map(_browseCard).join('')}</div>`
      : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:20px 0">No active vehicles</div>`;

    const reviews = comp.reviews || [];
    const reviewsHtml = reviews.length
      ? reviews.map(rv => {
          const rStars = [1,2,3,4,5].map(n=>`<svg viewBox="0 0 24 24" width="12" height="12" fill="${n<=rv.rating?'#F5A623':'none'}" stroke="${n<=rv.rating?'#F5A623':'#D4D4D8'}" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('');
          return `<div style="border-bottom:1px solid var(--border,#E8ECF4);padding:12px 0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <div style="width:32px;height:32px;border-radius:50%;background:#EEF2FB;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#1A3A8F;flex-shrink:0">${esc((rv.reviewer_name || '?').charAt(0).toUpperCase())}</div>
              <div><div style="font-size:13px;font-weight:700;color:var(--text)">${esc(rv.reviewer_name || 'Anonymous')}</div><div style="display:flex;gap:2px">${rStars}</div></div>
              <div style="margin-left:auto;font-size:11px;color:var(--sub)">${rv.created_at ? H.timeAgo(new Date(rv.created_at).getTime()) : ''}</div>
            </div>
            ${rv.body ? `<div style="font-size:13px;color:var(--text);line-height:1.55;padding-left:40px">${esc(rv.body)}</div>` : ''}
          </div>`;
        }).join('')
      : '<div style="text-align:center;color:var(--sub);font-size:13px;padding:20px 0">No reviews yet</div>';

    const u = H.currentUser();
    const myReview = reviews.find(r => u && r.reviewer_id === u.id);
    const writeReviewBtn = u && !myReview
      ? `<button onclick="H._rental.writeReview('${esc(id)}')" class="btn-sec" style="margin-bottom:14px">Write a Review</button>`
      : '';

    const stat = (val, label) => `<div style="text-align:center"><div style="font-size:20px;font-weight:800;color:#1A3A8F">${esc(String(val))}</div><div style="font-size:11.5px;color:var(--sub);margin-top:2px">${label}</div></div>`;

    return `<div class="page active" id="rcpPage" data-id="${esc(id)}">
      ${H.innerTopbar(esc(comp.name || 'Company Profile'))}
      <div style="background:var(--card,#fff);padding:16px;border-bottom:1px solid var(--border,#E8ECF4)">
        <div style="display:flex;gap:14px;align-items:flex-start">
          <div style="width:64px;height:64px;border-radius:16px;background:#EEF2FB;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#1A3A8F">
            ${comp.logo_url ? `<img src="${esc(comp.logo_url)}" style="width:100%;height:100%;object-fit:cover">` : I.bldg}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:18px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap">${esc(comp.name || '')}${comp.is_verified ? I.verified : ''}</div>
            <div style="display:flex;align-items:center;gap:4px;margin-top:4px">${bigStars}<span style="font-size:13px;font-weight:700;color:var(--text);margin-left:2px">${avgRating || '—'}</span><span style="font-size:12px;color:var(--sub)">(${comp.review_count || 0} reviews)</span></div>
            ${comp.bio ? `<div style="font-size:13px;color:var(--sub);margin-top:6px;line-height:1.5">${esc(comp.bio)}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:16px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border,#E8ECF4)">
          ${stat(comp.fleet_count || 0, 'Vehicles')}
          ${stat(avgRating || '—', 'Rating')}
          ${stat(comp.review_count || 0, 'Reviews')}
        </div>
      </div>

      <div class="inner-content" style="padding-bottom:24px">
        ${comp.phone || comp.whatsapp
          ? `<div style="display:flex;gap:10px;margin-bottom:16px">
              ${comp.phone    ? `<button onclick="H._rental._callDirect('${esc(comp.phone)}')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:12px;border-radius:12px;border:1.5px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">${I.phone}Call</button>` : ''}
              ${comp.whatsapp ? `<button onclick="H._rental._waDirect('${esc(comp.whatsapp)}','${esc(comp.name||'')}')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:12px;border-radius:12px;border:none;background:#25D366;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">${I.wa}WhatsApp</button>` : ''}
            </div>`
          : ''}

        <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:12px">Fleet (${comp.fleet_count || 0})</div>
        ${fleetHtml}

        <div style="font-size:14px;font-weight:800;color:var(--text);margin:20px 0 4px">Reviews</div>
        ${writeReviewBtn}
        <div style="background:var(--card,#fff);border-radius:14px;border:1px solid var(--border,#E8ECF4);padding:2px 14px">${reviewsHtml}</div>
      </div>
    </div>`;
  };

  H.pages.RentalCompanyProfile_after = function (params) {
    const id = params && params.id;
    if (id && !R.compCache[id]) H._rental.loadCompany(id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalFavorites
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalFavorites = function () {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">
        ${H.innerTopbar('Saved Rentals')}
        ${H.emptyState('Sign in to view saved rentals', 'Save vehicles you like while browsing.', 'Sign In', "H.requireAuth('Sign in to view saved rentals')")}
      </div>`;
    }

    const favs = R._favListings || [];
    const content = favs.length
      ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px">${favs.map(_browseCard).join('')}</div>`
      : (!R._favLoading ? H.emptyState('No saved rentals yet', 'Tap the heart icon on any vehicle to save it here.', 'Browse Rentals', "H.goBack()") : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px">${_skelCards(4)}</div>`);

    return `<div class="page active">
      ${H.innerTopbar('Saved Rentals')}
      ${content}
      <div style="height:30px"></div>
    </div>`;
  };

  H.pages.RentalFavorites_after = function () {
    const u = H.currentUser();
    if (!u) return;
    H._rental.loadFavorites();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Data loaders
  // ─────────────────────────────────────────────────────────────────────────
  R.loadBrowse = async function (reset) {
    if (R._loading) return;
    const sb = window.supabase; if (!sb) return;
    if (reset) { R.page = 0; R.browse = []; R.featured = []; R.hasMore = true; }
    R._loading = true;
    H.renderPage('RentalListings', H._currentParams || {});
    try {
      const f = R.filters;
      const { data, error } = await sb.rpc('rental_search_listings', {
        p_category_slug:  f.cat   || null,
        p_city:           (f.city && f.city !== 'All Zimbabwe') ? f.city : null,
        p_transmission:   f.trans || null,
        p_fuel_type:      f.fuel  || null,
        p_available_only: !!f.avail,
        p_featured_first: true,
        p_limit:          21,
        p_offset:         R.page * 20,
      });
      if (error) throw error;
      const rows = data || [];
      const feat = rows.filter(r => r.is_featured && R.page === 0);
      R.featured = feat;
      const rest = reset ? rows.filter(r => !r.is_featured) : rows;
      R.browse   = reset ? rest : [...R.browse, ...rest];
      R.hasMore  = rows.length === 21;
      if (R.hasMore) R.browse = R.browse.slice(0, 20);
    } catch (e) {
      console.warn('rental browse:', e);
      H.toast('Could not load vehicles. Try again.', 4000, true);
    }
    R._loading = false;
    if (H.currentPageName === 'RentalListings') H.renderPage('RentalListings', {});
  };

  R.loadMore = function () {
    if (R._loading || !R.hasMore) return;
    R.page++;
    R.loadBrowse(false);
  };

  R.loadDetail = async function (id) {
    if (R.detailCache[id] && R.detailCache[id]._full) return;
    const sb = window.supabase; if (!sb) return;
    try {
      const [lstRes, mediaRes, specsRes, featRes, compRes] = await Promise.all([
        sb.from('rental_vehicle_listings').select('id,model,year,daily_rate,weekly_rate,monthly_rate,deposit,min_rental_days,driver_rate,description,is_available,company_id,brand_id,location_id').eq('id', id).single(),
        sb.from('rental_vehicle_media').select('url,sort_order,is_cover').eq('listing_id', id).order('sort_order'),
        sb.from('rental_vehicle_specs').select('transmission,fuel_type,drive_type,seats,doors,mileage_km').eq('listing_id', id).single(),
        sb.from('rental_vehicle_features').select('feature').eq('listing_id', id).limit(30),
        null,
      ]);
      if (lstRes.error) throw lstRes.error;

      const lst = lstRes.data;
      const companyId = lst.company_id;

      const [brandRes, locRes, companyRes] = await Promise.all([
        sb.from('rental_brands').select('slug,label').eq('id', lst.brand_id).single(),
        sb.from('rental_locations').select('city,province').eq('id', lst.location_id).single(),
        sb.from('rental_companies')
          .select('id,avg_rating,review_count,fleet_count,status,business_id')
          .eq('id', companyId).single(),
      ]);

      let compBiz = {};
      if (companyRes.data && !companyRes.error) {
        const bizRes = await sb.from('businesses').select('name,phone,whatsapp,owner_user_id').eq('id', companyRes.data.business_id).single();
        const profRes= await sb.from('rental_company_profiles').select('logo_url,cover_url,bio').eq('company_id', companyId).single();
        compBiz = {
          id:           companyId,
          name:         bizRes.data && bizRes.data.name,
          phone:        bizRes.data && bizRes.data.phone,
          whatsapp:     bizRes.data && bizRes.data.whatsapp,
          owner_user_id:bizRes.data && bizRes.data.owner_user_id,
          logo_url:     profRes.data && profRes.data.logo_url,
          bio:          profRes.data && profRes.data.bio,
          avg_rating:   companyRes.data.avg_rating,
          review_count: companyRes.data.review_count,
          fleet_count:  companyRes.data.fleet_count,
          is_verified:  companyRes.data.status === 'active',
        };
      }

      R.detailCache[id] = {
        ...lst,
        brand_slug:  brandRes.data && brandRes.data.slug,
        brand_label: brandRes.data && brandRes.data.label,
        city:        locRes.data && locRes.data.city,
        province:    locRes.data && locRes.data.province,
        media:       (mediaRes.data || []),
        specs:       specsRes.data || {},
        features:    featRes.data  || [],
        company:     compBiz,
        _full:       true,
      };
    } catch (e) {
      console.warn('rental detail:', e);
      H.toast('Could not load vehicle details.', 4000, true);
    }
    if (H.currentPageName === 'RentalVehicleDetail') H.renderPage('RentalVehicleDetail', { id });
  };

  R.loadCompany = async function (id) {
    const sb = window.supabase; if (!sb) return;
    try {
      const [rcRes, bizRes, profRes, reviewRes, fleetRes] = await Promise.all([
        sb.from('rental_companies').select('id,avg_rating,review_count,fleet_count,business_id').eq('id', id).single(),
        null, null, null, null,
      ]);
      if (rcRes.error) throw rcRes.error;
      const rc = rcRes.data;

      const [bRes, pRes, rvRes, flRes] = await Promise.all([
        sb.from('businesses').select('name,phone,whatsapp,owner_user_id').eq('id', rc.business_id).single(),
        sb.from('rental_company_profiles').select('logo_url,cover_url,bio').eq('company_id', id).single(),
        sb.from('rental_reviews').select('id,rating,body,created_at,reviewer_id').eq('company_id', id).eq('status','published').order('created_at', {ascending:false}).limit(10),
        sb.rpc('rental_search_listings', { p_available_only: false, p_limit: 8, p_offset: 0 }),
      ]);

      const reviewerIds = (rvRes.data || []).map(r => r.reviewer_id).filter(Boolean);
      let reviewerNames = {};
      if (reviewerIds.length) {
        const namesRes = await sb.from('profiles').select('id,full_name,username').in('id', reviewerIds);
        (namesRes.data || []).forEach(p => { reviewerNames[p.id] = p.full_name || p.username || 'User'; });
      }

      R.compCache[id] = {
        id,
        name:         bRes.data && bRes.data.name,
        phone:        bRes.data && bRes.data.phone,
        whatsapp:     bRes.data && bRes.data.whatsapp,
        owner_user_id:bRes.data && bRes.data.owner_user_id,
        logo_url:     pRes.data && pRes.data.logo_url,
        bio:          pRes.data && pRes.data.bio,
        avg_rating:   rc.avg_rating,
        review_count: rc.review_count,
        fleet_count:  rc.fleet_count,
        is_verified:  true,
        reviews:      (rvRes.data || []).map(r => ({ ...r, reviewer_name: reviewerNames[r.reviewer_id] })),
        fleet:        (flRes.data || []).filter(v => v.company_name === (bRes.data && bRes.data.name)),
      };
    } catch (e) {
      console.warn('rental company:', e);
      H.toast('Could not load company profile.', 4000, true);
    }
    if (H.currentPageName === 'RentalCompanyProfile') H.renderPage('RentalCompanyProfile', { id });
  };

  R.loadFavorites = async function () {
    const u = H.currentUser(); if (!u) return;
    const sb = window.supabase; if (!sb) return;
    R._favLoading = true;
    if (H.currentPageName === 'RentalFavorites') H.renderPage('RentalFavorites', {});
    try {
      const { data: favRows, error } = await sb.from('rental_favorites').select('listing_id').eq('user_id', u.id).order('created_at', {ascending:false}).limit(60);
      if (error) throw error;
      const ids = (favRows || []).map(r => r.listing_id);
      R.favIds = new Set(ids);
      if (!ids.length) { R._favListings = []; R._favLoading = false; if (H.currentPageName === 'RentalFavorites') H.renderPage('RentalFavorites', {}); return; }
      const { data: listings } = await sb.rpc('rental_search_listings', { p_limit: 60, p_offset: 0 });
      R._favListings = (listings || []).filter(l => ids.includes(l.id));
    } catch (e) {
      console.warn('rental favorites:', e);
    }
    R._favLoading = false;
    if (H.currentPageName === 'RentalFavorites') H.renderPage('RentalFavorites', {});
  };

  R._incrementView = async function (id) {
    window._rentalViewed = window._rentalViewed || new Set();
    if (window._rentalViewed.has(id)) return;
    window._rentalViewed.add(id);
    const sb = window.supabase; if (!sb) return;
    try { await sb.rpc('rental_increment_view', { p_listing_id: id }); } catch (e) { }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // User actions
  // ─────────────────────────────────────────────────────────────────────────
  R.toggleFav = async function (id) {
    const u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to save vehicles'); return; }
    const sb = window.supabase; if (!sb) return;
    const wasSaved = R.favIds.has(id);
    if (wasSaved) { R.favIds.delete(id); } else { R.favIds.add(id); }
    const saveBtns = document.querySelectorAll(`[data-rvd-save="${id}"]`);
    saveBtns.forEach(btn => { btn.innerHTML = R.favIds.has(id) ? I.heartF : I.heart; });
    try {
      if (wasSaved) {
        await sb.from('rental_favorites').delete().eq('user_id', u.id).eq('listing_id', id);
        H.toast('Removed from saved');
      } else {
        await sb.from('rental_favorites').insert({ user_id: u.id, listing_id: id });
        H.toast('Saved to favourites');
      }
    } catch (e) {
      if (wasSaved) { R.favIds.add(id); } else { R.favIds.delete(id); }
      H.toast('Could not update saved list', 4000, true);
    }
  };

  R.setFilter = function (key, val) {
    if (key === 'avail') {
      R.filters.avail = !R.filters.avail;
    } else {
      R.filters[key] = val || null;
    }
    R.loadBrowse(true);
  };

  R.clearFilters = function () {
    R.filters = { cat: null, city: null, trans: null, fuel: null, avail: false };
    R.loadBrowse(true);
  };

  R.onSearch = function (q) {
    clearTimeout(window._rentalSearchTimer);
    window._rentalSearchTimer = setTimeout(() => {
      // Full-text search — reload with query (server-side)
      R._searchQuery = q;
      R.loadBrowse(true);
    }, 420);
  };

  R.openDetail = function (id) {
    if (!R.detailCache[id]) {
      const preview = R.browse.find(v => v.id === id) || R.featured.find(v => v.id === id);
      if (preview) {
        R.detailCache[id] = {
          id:           preview.id,
          model:        preview.model,
          year:         preview.year,
          daily_rate:   preview.daily_rate,
          is_available: preview.is_available,
          city:         preview.city,
          brand_slug:   preview.brand_slug,
          cover_url:    preview.cover_url,
          company:      { name: preview.company_name },
          media:        preview.cover_url ? [{ url: preview.cover_url, is_cover: true }] : [],
          specs:        {},
          features:     [],
          _full:        false,
        };
      }
    }
    H.openInner('RentalVehicleDetail', { id });
  };

  R.chatCompany = async function (listingId) {
    const u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to contact this company'); return; }
    const det = R.detailCache[listingId];
    if (!det || !det.company || !det.company.owner_user_id) {
      H.toast('Company contact info not loaded yet. Please wait.'); return;
    }
    const ownerId = det.company.owner_user_id;
    if (ownerId === u.id) { H.toast('This is your own listing.'); return; }

    const sb = window.supabase;
    if (sb) {
      try {
        await sb.from('rental_activity_logs').insert({
          listing_id:  listingId,
          company_id:  det.company.id,
          user_id:     u.id,
          event_type:  'chat_open',
        });
      } catch (e) {}
    }
    H.startChatWith(ownerId, listingId);
  };

  R.waCompany = function (listingId) {
    const det = R.detailCache[listingId];
    if (!det || !det.company) return;
    R._waDirect(det.company.whatsapp, det.company.name, det);
  };

  R._waDirect = function (phone, name, det) {
    if (!phone) { H.toast('No WhatsApp number available'); return; }
    const clean = String(phone).replace(/[^\d+]/g, '');
    const model = det ? esc(brandLabel(det.brand_slug) + ' ' + (det.model || '')) : '';
    const txt   = encodeURIComponent('Hi ' + (name || '') + '! I saw your ' + model + ' rental on PaMarket Zimbabwe. Is it available?');
    window.open('https://wa.me/' + clean.replace('+','') + '?text=' + txt, '_blank');
  };

  R.callCompany = function (listingId) {
    const det = R.detailCache[listingId];
    if (!det || !det.company || !det.company.phone) { H.toast('No phone number available'); return; }
    R._callDirect(det.company.phone);
  };

  R._callDirect = function (phone) {
    if (!phone) { H.toast('No phone number available'); return; }
    const clean = String(phone).replace(/\s+/g,'');
    if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      location.href = 'tel:' + clean;
    } else {
      if (navigator.clipboard) navigator.clipboard.writeText(clean).catch(() => {});
      H.toast('Number copied: ' + clean);
    }
  };

  R.shareVehicle = function (id) {
    const det = R.detailCache[id];
    const title = det ? brandLabel(det.brand_slug) + ' ' + (det.model || '') + ' for Rent' : 'Vehicle Rental on PaMarket';
    const url   = window.location.origin + window.location.pathname + '?rental=' + id;
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => H.toast('Link copied!')).catch(() => H.toast('Copy the URL from your address bar'));
    } else {
      H.toast('Share: ' + url, 6000);
    }
  };

  R.reportVehicle = function (id) {
    if (!H.currentUser()) { H.requireAuth('Sign in to report'); return; }
    const reasons = ['Misleading description','Wrong category','Prohibited vehicle','Fake or fraudulent listing','Offensive content','Duplicate listing','Other'];
    H.modal({
      title: 'Report this listing',
      body: `<select class="fi" id="rlReportReason" style="width:100%;margin-bottom:8px">${reasons.map(r => `<option>${r}</option>`).join('')}</select><textarea class="fi" id="rlReportNote" rows="3" placeholder="Additional details (optional)" style="width:100%;margin-top:4px"></textarea>`,
      confirmText: 'Submit Report',
      onConfirm: async () => {
        const sb = window.supabase; if (!sb) return;
        const u = H.currentUser(); if (!u) return;
        const reason = document.getElementById('rlReportReason')?.value || reasons[0];
        try {
          await sb.from('rental_reports').insert({ listing_id: id, reporter_id: u.id, reason, notes: document.getElementById('rlReportNote')?.value || '' });
          H.toast('Report submitted. We will review it shortly.');
        } catch (e) {
          if (e.code === '23505') { H.toast('You have already reported this listing.'); }
          else { H.toast('Could not submit report. Try again.', 4000, true); }
        }
      }
    });
  };

  R.writeReview = function (companyId) {
    const u = H.currentUser(); if (!u) { H.requireAuth('Sign in to write a review'); return; }
    let selectedRating = 0;
    const starBtn = (n) => `<button id="rvStar${n}" onclick="H._rental._setReviewStar(${n})" style="background:none;border:none;cursor:pointer;padding:2px">${[1,2,3,4,5].map(i=>`<svg viewBox="0 0 24 24" width="28" height="28" fill="${i<=n?'#F5A623':'none'}" stroke="${i<=n?'#F5A623':'#D4D4D8'}" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('')}</button>`;
    H.modal({
      title: 'Write a Review',
      body: `<div id="rvStarRow" style="display:flex;gap:4px;justify-content:center;margin-bottom:12px">${[1,2,3,4,5].map(n=>`<button onclick="H._rental._setReviewStar(${n})" style="background:none;border:none;cursor:pointer;padding:2px">${I.starO}</button>`).join('')}</div><textarea class="fi" id="rvReviewBody" rows="3" placeholder="Share your experience (optional)" style="width:100%"></textarea>`,
      confirmText: 'Submit Review',
      onConfirm: async () => {
        if (!window._rvRating || window._rvRating < 1) { H.toast('Please select a star rating'); return; }
        const sb = window.supabase; if (!sb) return;
        try {
          await sb.from('rental_reviews').insert({ company_id: companyId, reviewer_id: u.id, rating: window._rvRating, body: document.getElementById('rvReviewBody')?.value || '', status: 'published' });
          H.toast('Review submitted. Thank you!');
          delete R.compCache[companyId];
          window._rvRating = 0;
        } catch (e) {
          if (e.code === '23505') { H.toast('You have already reviewed this company.'); }
          else { H.toast('Could not submit review. Try again.', 4000, true); }
        }
      }
    });
  };

  R._setReviewStar = function (n) {
    window._rvRating = n;
    const row = document.getElementById('rvStarRow');
    if (!row) return;
    row.innerHTML = [1,2,3,4,5].map(i => `<button onclick="H._rental._setReviewStar(${i})" style="background:none;border:none;cursor:pointer;padding:2px"><svg viewBox="0 0 24 24" width="28" height="28" fill="${i<=n?'#F5A623':'none'}" stroke="${i<=n?'#F5A623':'#D4D4D8'}" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>`).join('');
  };

  R._setPhoto = function (idx) {
    const img = document.getElementById('rvdPhotoImg'); if (!img) return;
    const photos = JSON.parse(img.dataset.photos || '[]');
    if (!photos[idx]) return;
    img.src = photos[idx];
    const dots = document.querySelectorAll('#rvdPhoto .pdot');
    dots.forEach((d, i) => d.classList.toggle('on', i === idx));
    const counter = document.getElementById('rvdPhotoCount');
    if (counter) counter.textContent = (idx + 1) + ' / ' + photos.length;
  };

})(window.H);
