/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const { escHtml, fmtPrice } = H;

  const IC = {
    bolt:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    star:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
    wa:      '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
    mail:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    phone:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>',
    ads:     '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>',
    img:     '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  };

  // Module-level selection state (avoids quoting issues in onclick attrs)
  let _selIndex     = 0;
  let _selBoostType = 'Sponsored Listing';
  let _myListings   = [];

  // ─── ENTRY: "What do you want to advertise?" ─────────────────────────────────
  pages.Ads = function () {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Advertisements')}
        ${H.emptyState('Sign in to continue', 'Create a free account to advertise on PaMarket', 'Sign In', 'H.authPage()')}
      </div>`;
    }

    const cats = [
      { id:'listing',     emoji:'📋', title:'A specific listing',    desc:'Boost or feature one of your existing ads' },
      { id:'property',    emoji:'🏠', title:'Property',              desc:'Homes, land, rentals and commercial spaces' },
      { id:'vehicles',    emoji:'🚗', title:'Vehicles',              desc:'Cars, trucks, motorbikes and more' },
      { id:'electronics', emoji:'📱', title:'Electronics & Gadgets', desc:'Phones, laptops and appliances' },
      { id:'business',    emoji:'💼', title:'Business / Services',   desc:'Promote your services to active buyers' },
      { id:'jobs',        emoji:'👔', title:'Jobs',                  desc:'Find the best talent for your company' },
      { id:'other',       emoji:'📦', title:'Other',                 desc:'Everything else' },
    ];

    return `<div class="page active">${H.innerTopbar('Advertisements')}

      <div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);padding:24px 20px 22px;text-align:center">
        <div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:6px">Pa<span style="color:#F5A623">Market</span> for Business</div>
        <div style="font-size:14px;color:rgba(255,255,255,.8);line-height:1.5">Reach active buyers across all 10 provinces of Zimbabwe</div>
      </div>

      <div style="padding:16px 16px 80px">
        <div style="font-size:19px;font-weight:900;color:var(--text);margin-bottom:4px">What do you want to advertise?</div>
        <div style="font-size:13px;color:var(--sub);margin-bottom:18px">Choose a category to get started</div>

        ${cats.map(c => `
          <div onclick="H._adv.pickCategory('${c.id}')"
              style="display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px;cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:46px;height:46px;background:var(--bg);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">${c.emoji}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:700;color:var(--text)">${c.title}</div>
              <div style="font-size:12px;color:var(--sub);margin-top:2px;line-height:1.4">${c.desc}</div>
            </div>
            ${IC.chevron}
          </div>`).join('')}
      </div>
    </div>`;
  };

  pages.Wallet   = pages.Ads;
  pages.Payments = pages.Ads;
  pages.TopUp    = pages.Ads;

  // ─── STEP 2A: Select a listing to boost ──────────────────────────────────────
  pages.AdsBoost = function () {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Select a Listing')}
        ${H.emptyState('Not signed in', 'Please sign in to continue', 'Sign In', 'H.authPage()')}
      </div>`;
    }

    _myListings = (H.state.listings || []).filter(l => l.sellerId === u.id && l.status === 'active');

    if (!_myListings.length) {
      return `<div class="page active">${H.innerTopbar('Select a Listing')}
        <div class="empty-state">
          <div class="empty-icon">${IC.ads}</div>
          <div class="empty-title">No active listings</div>
          <div class="empty-sub">Post a listing first, then come back to promote it.</div>
          <button class="btn-pri" style="max-width:240px;margin-top:12px" onclick="H.navTo('Post',null)">Post an Ad</button>
        </div>
      </div>`;
    }

    return `<div class="page active">${H.innerTopbar('Select a Listing')}
      <div style="padding:12px 16px 80px">
        <div style="font-size:13px;color:var(--sub);margin-bottom:14px">Select the listing you want to promote</div>

        ${_myListings.map((l, i) => {
          const thumb = l.photos && l.photos[0] ? `<img src="${escHtml(l.photos[0])}" style="width:54px;height:54px;border-radius:10px;object-fit:cover;flex-shrink:0">` : `<div style="width:54px;height:54px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--sub)">${IC.img}</div>`;
          return `
          <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
            <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px">
              ${thumb}
              <div style="flex:1;min-width:0">
                <div style="font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title)}</div>
                <div style="font-size:12px;color:var(--sub);margin-top:3px">${escHtml(fmtPrice(l.price, l.currency))} · ${escHtml(l.city || l.suburb || '')}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <button onclick="H._adv.selectBoost(${i},'Sponsored Listing')"
                style="padding:10px 8px;background:var(--blue-light);border:1.5px solid var(--blue-soft);border-radius:10px;color:var(--blue);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;line-height:1.3">
                ${IC.bolt} Sponsored Listing
                <div style="font-size:10px;font-weight:500;margin-top:3px;opacity:.75">Appears every 5 listings</div>
              </button>
              <button onclick="H._adv.selectBoost(${i},'Featured Ad')"
                style="padding:10px 8px;background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:10px;color:#B45309;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;line-height:1.3">
                ${IC.star} Featured Ad
                <div style="font-size:10px;font-weight:500;margin-top:3px;opacity:.75">Top of search results</div>
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  };

  // ─── STEP 3: Contact Sales ────────────────────────────────────────────────────
  pages.AdsContact = function () {
    const listing = _myListings[_selIndex];
    const title   = listing ? listing.title : 'my listing';
    const type    = _selBoostType;
    const msg     = `Hello, I want to promote my ad: "${title}" (${type})`;
    const msgE    = encodeURIComponent(msg);
    const mailE   = encodeURIComponent('Advertising Enquiry — ' + type);

    function contactBtn(bg, border, color, icon, label, sub, action) {
      return `<button onclick="${action}"
        style="width:100%;display:flex;align-items:center;gap:14px;padding:16px;background:${bg};border:1.5px solid ${border};border-radius:14px;color:${color};font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;text-align:left">
        <span style="flex-shrink:0">${icon}</span>
        <div>
          <div>${label}</div>
          <div style="font-size:12px;font-weight:400;opacity:.8;margin-top:2px">${sub}</div>
        </div>
      </button>`;
    }

    return `<div class="page active">${H.innerTopbar('Contact Sales')}
      <div style="padding:20px 16px 80px">
        <div style="font-size:22px;font-weight:900;color:var(--text);margin-bottom:4px">Promote Your Listing</div>
        <div style="font-size:13px;color:var(--sub);line-height:1.5;margin-bottom:20px">
          Contact our team to set up your <strong style="color:var(--text)">${escHtml(type)}</strong> package.
          We respond within a few hours.
        </div>

        <div style="background:var(--blue-light);border:1px solid var(--blue-soft);border-radius:12px;padding:14px;margin-bottom:24px">
          <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Pre-filled message</div>
          <div style="font-size:13px;color:var(--text);line-height:1.6;font-style:italic">"${escHtml(msg)}"</div>
        </div>

        ${contactBtn('#25D366','#25D366','#fff', IC.wa,    'WhatsApp Us',  'Fastest response — usually within the hour', `window.open('https://wa.me/971589772645?text=${msgE}','_blank')`)}
        ${contactBtn('var(--card)','var(--border)','var(--text)', IC.mail, 'Email Us', 'info@pamarket.co.zw', `window.open('mailto:info@pamarket.co.zw?subject=${mailE}&body=${msgE}','_blank')`)}
        ${contactBtn('var(--card)','var(--border)','var(--text)', IC.phone,'Call Us',  '+263 — Mon–Sat, 8am–6pm CAT', `window.location.href='tel:+263787341565'`)}

        <div style="margin-top:20px;text-align:center;font-size:12px;color:var(--sub);line-height:1.7">
          Our team typically responds during business hours (Mon–Sat, 8am–6pm CAT).<br>
          No payment is taken through the app.
        </div>
      </div>
    </div>`;
  };

  // ─── My Advertisements dashboard ─────────────────────────────────────────────
  pages.MyAds = function () {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('My Advertisements')}
        ${H.emptyState('Not signed in', 'Sign in to view your advertisements', 'Sign In', 'H.authPage()')}
      </div>`;
    }

    const all     = (H.state.listings || []).filter(l => l.sellerId === u.id);
    const active  = all.filter(l => l.status === 'active');
    const pending = all.filter(l => l.status === 'pending');
    const boosted = all.filter(l => l.boosted || l.featured);

    function listingRow(l) {
      const thumb = l.photos && l.photos[0]
        ? `<img src="${escHtml(l.photos[0])}" style="width:50px;height:50px;border-radius:10px;object-fit:cover;flex-shrink:0">`
        : `<div style="width:50px;height:50px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--sub)">${IC.img}</div>`;
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
          ${thumb}
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title)}</div>
            <div style="font-size:11px;color:var(--sub);margin-top:3px">${escHtml(fmtPrice(l.price, l.currency))} · ${escHtml(l.city || '')}</div>
          </div>
          <button onclick="H._adv.promoteFromDash('${escHtml(l.id)}')" style="background:var(--blue-light);border:1px solid var(--blue-soft);color:var(--blue);font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;cursor:pointer;font-family:inherit;flex-shrink:0">
            Promote
          </button>
        </div>`;
    }

    function section(title, items, emptyMsg) {
      return `
        <div style="margin-bottom:20px">
          <div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;padding:0 16px">${title} <span style="background:var(--blue);color:#fff;border-radius:8px;padding:1px 7px;font-size:10px;margin-left:4px">${items.length}</span></div>
          <div style="background:var(--card);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:0 16px">
            ${items.length ? items.map(listingRow).join('') : `<div style="padding:20px 0;text-align:center;font-size:13px;color:var(--sub)">${emptyMsg}</div>`}
          </div>
        </div>`;
    }

    return `<div class="page active">${H.innerTopbar('My Advertisements')}
      <div style="padding:16px 0 80px">
        <div style="padding:0 16px;margin-bottom:16px">
          <button onclick="H.openInner('Ads')"
            style="width:100%;padding:14px;background:#1A3A8F;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">
            ${IC.ads} New Advertisement
          </button>
        </div>
        ${section('Active Ads',  active,  'No active listings yet')}
        ${section('Pending',     pending, 'No pending listings')}
        ${section('Boosted',     boosted, 'No boosted listings — tap Promote to get started')}
      </div>
    </div>`;
  };

  // ─── Handler ─────────────────────────────────────────────────────────────────
  H._adv = {
    pickCategory(cat) {
      if (cat === 'listing') {
        H.openInner('AdsBoost');
      } else {
        H.openInner('Post');
      }
    },
    selectBoost(idx, boostType) {
      _selIndex     = idx;
      _selBoostType = boostType;
      H.openInner('AdsContact');
    },
    promoteFromDash(listingId) {
      _myListings = (H.state.listings || []).filter(l => l.sellerId === (H.currentUser() || {}).id && l.status === 'active');
      const idx = _myListings.findIndex(l => l.id === listingId);
      _selIndex     = idx >= 0 ? idx : 0;
      _selBoostType = 'Sponsored Listing';
      H.openInner('AdsContact');
    },
  };

  H._wallet   = { openTopUp() { H.openInner('Ads'); }, openSite() { H.openInner('Ads'); } };
  H.showTopUp = () => H.openInner('Ads');

  H._copyText = function (el) {
    const text = (el && el.dataset) ? el.dataset.v : String(el);
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    H.toast('Copied: ' + text);
  };

})(window.H);
