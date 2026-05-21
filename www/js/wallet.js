/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const { escHtml, fmtPrice, PROVINCES, CITIES_BY_PROV, CATEGORIES } = H;

  const IC = {
    bolt:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    star:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
    photo:   '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    ads:     '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>',
    wa:      '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
    mail:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    phone:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>',
  };

  // Category map: Ads-page id → H.CATEGORIES id
  const CAT_MAP = {
    property: 'property', vehicles: 'vehicles', electronics: 'electronics',
    business: 'services', jobs: 'jobs', other: 'other',
  };

  const ADS_CATS = [
    { id:'listing',     emoji:'📋', title:'A specific listing',    desc:'Boost or feature one of your existing ads' },
    { id:'property',    emoji:'🏠', title:'Property',              desc:'Homes, land, rentals and commercial spaces' },
    { id:'vehicles',    emoji:'🚗', title:'Vehicles',              desc:'Cars, trucks, motorbikes and more' },
    { id:'electronics', emoji:'📱', title:'Electronics & Gadgets', desc:'Phones, laptops and appliances' },
    { id:'business',    emoji:'💼', title:'Business / Services',   desc:'Promote your services to active buyers' },
    { id:'jobs',        emoji:'👔', title:'Jobs',                  desc:'Find the best talent for your company' },
    { id:'other',       emoji:'📦', title:'Other',                 desc:'Everything else' },
  ];

  // Module-level state
  let _selIndex     = 0;
  let _selBoostType = 'Sponsored Listing';
  let _myListings   = [];

  // Ad creation form state
  let _cs = { cat:'', title:'', desc:'', price:'', currency:'USD', prov:'', city:'', suburb:'', contact:'chat', photos:[] };

  // ─── ENTRY: category picker ──────────────────────────────────────────────────
  pages.Ads = function () {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Advertisements')}
        ${H.emptyState('Sign in to continue', 'Create a free account to advertise on PaMarket', 'Sign In', 'H.authPage()')}
      </div>`;
    }
    return `<div class="page active">${H.innerTopbar('Advertisements')}

      <div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);padding:22px 20px 20px;text-align:center">
        <div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:5px">Pa<span style="color:#F5A623">Market</span> for Business</div>
        <div style="font-size:13px;color:rgba(255,255,255,.8);line-height:1.5">Reach active buyers across all 10 provinces of Zimbabwe</div>
      </div>

      <div style="padding:16px 16px 80px">
        <div style="font-size:19px;font-weight:900;color:var(--text);margin-bottom:3px">What do you want to advertise?</div>
        <div style="font-size:13px;color:var(--sub);margin-bottom:16px">Choose a category to get started</div>

        ${ADS_CATS.map(c => `
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

  // ─── Ad creation form (for category cards) ───────────────────────────────────
  pages.AdsCreate = function ({ category } = {}) {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Create Advertisement')}
        ${H.emptyState('Not signed in', 'Please sign in to continue', 'Sign In', 'H.authPage()')}
      </div>`;
    }

    const catId  = CAT_MAP[category] || category || '';
    const catObj = CATEGORIES.find(c => c.id === catId);
    const catEmoji = ADS_CATS.find(c => CAT_MAP[c.id] === catId || c.id === category)?.emoji || '📦';

    _cs = { cat: catId, title:'', desc:'', price:'', currency:'USD',
            prov: PROVINCES[0], city:(CITIES_BY_PROV[PROVINCES[0]]||[])[0]||'',
            suburb:'', contact:'chat', photos:[] };

    return renderCreateShell(catEmoji, catObj?.name || category || 'Other');
  };

  function renderCreateShell(emoji, catName) {
    return `<div class="page active">${H.innerTopbar('Create Advertisement')}
      <div style="display:flex;align-items:center;gap:10px;padding:14px 16px 10px;background:var(--card);border-bottom:1px solid var(--border)">
        <span style="font-size:24px">${emoji}</span>
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--text)">${escHtml(catName)}</div>
          <div style="font-size:12px;color:var(--sub)">Fill in the details below</div>
        </div>
      </div>
      <div style="padding:16px 16px 100px" id="adsCreateBody">
        ${renderCreateForm()}
      </div>
    </div>`;
  }

  function renderCreateForm() {
    const s = _cs;
    const prov = s.prov || PROVINCES[0];
    const cities = CITIES_BY_PROV[prov] || [];

    const photoGrid = s.photos.map((p, i) =>
      `<div style="position:relative;width:80px;height:80px;flex-shrink:0">
        <img src="${p}" style="width:80px;height:80px;border-radius:10px;object-fit:cover">
        <button onclick="H._adsCreate.removePhoto(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#EF4444;color:#fff;border:none;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">×</button>
      </div>`
    ).join('');

    return `
      <div class="fg">
        <div class="fl">Title <span style="color:var(--red)">*</span></div>
        <input class="fi" id="acTitle" value="${escHtml(s.title)}" placeholder="e.g. 3 Bedroom House in Avondale" maxlength="80">
      </div>
      <div class="fg">
        <div class="fl">Description <span style="color:var(--red)">*</span></div>
        <textarea class="fi" rows="4" id="acDesc" placeholder="Describe what you're advertising — condition, features, why buyers should contact you..." maxlength="2000">${escHtml(s.desc)}</textarea>
      </div>

      <div class="fg">
        <div class="fl">Photos <span style="color:var(--red)">*</span> <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--sub)">(min 1, up to 8)</span></div>
        <label for="acPhotos" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:2px dashed var(--border);border-radius:14px;padding:20px;cursor:pointer;background:var(--bg);margin-bottom:10px">
          ${IC.photo}
          <div style="font-size:14px;font-weight:600;color:var(--sub)">Tap to add photos</div>
          <div style="font-size:12px;color:var(--sub)">JPG, PNG · Max 8 photos</div>
        </label>
        <input type="file" id="acPhotos" accept="image/*" multiple style="display:none" onchange="H._adsCreate.onPhotos(event)">
        <div style="display:flex;flex-wrap:wrap;gap:8px" id="acPhotoGrid">${photoGrid}</div>
      </div>

      <div class="fg">
        <div class="fl">Price <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--sub)">(optional)</span></div>
        <div style="display:flex;gap:8px">
          <input class="fi" style="flex:1" type="number" id="acPrice" value="${escHtml(s.price)}" placeholder="0" min="0">
          <div style="display:flex;border:1.5px solid var(--border);border-radius:10px;overflow:hidden">
            <button onclick="H._adsCreate.setCur('USD')" style="padding:0 14px;background:${s.currency==='USD'?'#1A3A8F':'var(--card)'};color:${s.currency==='USD'?'#fff':'var(--text)'};border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">USD</button>
            <button onclick="H._adsCreate.setCur('ZiG')" style="padding:0 14px;background:${s.currency==='ZiG'?'#1A3A8F':'var(--card)'};color:${s.currency==='ZiG'?'#fff':'var(--text)'};border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">ZiG</button>
          </div>
        </div>
      </div>

      <div class="fg">
        <div class="fl">Province</div>
        <select class="fi" id="acProv" onchange="H._adsCreate.onProv(this.value)">
          ${PROVINCES.map(p => `<option${p===prov?' selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <div class="fl">City / Town</div>
        <select class="fi" id="acCity">
          ${cities.map(c => `<option${c===s.city?' selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <div class="fl">Suburb / Area <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--sub)">(optional)</span></div>
        <input class="fi" id="acSuburb" value="${escHtml(s.suburb)}" placeholder="e.g. Avondale West">
      </div>

      <div class="fg">
        <div class="fl">Preferred Contact Method</div>
        <div style="display:flex;gap:8px">
          <button onclick="H._adsCreate.setContact('chat')" style="flex:1;padding:12px;border-radius:10px;border:2px solid ${s.contact==='chat'?'#1A3A8F':'var(--border)'};background:${s.contact==='chat'?'var(--blue-light)':'var(--card)'};color:${s.contact==='chat'?'#1A3A8F':'var(--text)'};font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            💬 In-App Chat
          </button>
          <button onclick="H._adsCreate.setContact('phone')" style="flex:1;padding:12px;border-radius:10px;border:2px solid ${s.contact==='phone'?'#1A3A8F':'var(--border)'};background:${s.contact==='phone'?'var(--blue-light)':'var(--card)'};color:${s.contact==='phone'?'#1A3A8F':'var(--text)'};font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            📞 Phone Call
          </button>
        </div>
      </div>

      <div id="acErr" style="background:var(--red-light);border-radius:10px;color:var(--red);font-size:13px;font-weight:600;padding:10px 12px;margin-bottom:12px;display:none"></div>

      <button id="acBtn" class="btn-submit" style="width:100%;font-size:15px" onclick="H._adsCreate.submit()">
        Submit Advertisement
      </button>
      <div style="text-align:center;font-size:12px;color:var(--sub);margin-top:8px">
        Your ad will go live after admin review (usually within 24 hours)
      </div>`;
  }

  H._adsCreate = {
    setCur(c) {
      _cs.currency = c;
      const body = document.getElementById('adsCreateBody');
      if (body) body.innerHTML = renderCreateForm();
    },
    onProv(p) {
      _cs.prov = p;
      _cs.city = (CITIES_BY_PROV[p] || [])[0] || '';
      const body = document.getElementById('adsCreateBody');
      if (body) body.innerHTML = renderCreateForm();
    },
    setContact(m) {
      _cs.contact = m;
      const body = document.getElementById('adsCreateBody');
      if (body) body.innerHTML = renderCreateForm();
    },
    onPhotos(e) {
      const files = Array.from(e.target.files || []);
      const remaining = 8 - _cs.photos.length;
      files.slice(0, remaining).forEach(f => {
        if (!f.type.startsWith('image/')) return;
        (H.compressImage || _compressImage)(f, 1200, 0.78).then(d => {
          _cs.photos.push(d);
          const grid = document.getElementById('acPhotoGrid');
          if (grid) grid.innerHTML = _cs.photos.map((p, i) =>
            `<div style="position:relative;width:80px;height:80px;flex-shrink:0"><img src="${p}" style="width:80px;height:80px;border-radius:10px;object-fit:cover"><button onclick="H._adsCreate.removePhoto(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#EF4444;color:#fff;border:none;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">×</button></div>`
          ).join('');
        });
      });
      e.target.value = '';
    },
    removePhoto(i) {
      _cs.photos.splice(i, 1);
      const grid = document.getElementById('acPhotoGrid');
      if (grid) grid.innerHTML = _cs.photos.map((p, idx) =>
        `<div style="position:relative;width:80px;height:80px;flex-shrink:0"><img src="${p}" style="width:80px;height:80px;border-radius:10px;object-fit:cover"><button onclick="H._adsCreate.removePhoto(${idx})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#EF4444;color:#fff;border:none;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">×</button></div>`
      ).join('');
    },
    async submit() {
      _cs.title  = (document.getElementById('acTitle')?.value  || '').trim();
      _cs.desc   = (document.getElementById('acDesc')?.value   || '').trim();
      _cs.price  = document.getElementById('acPrice')?.value   || '0';
      _cs.suburb = (document.getElementById('acSuburb')?.value || '').trim();

      const errEl = document.getElementById('acErr');
      const btn   = document.getElementById('acBtn');
      errEl.style.display = 'none';
      const err = m => { errEl.textContent = m; errEl.style.display = 'block'; errEl.scrollIntoView({behavior:'smooth',block:'nearest'}); };

      if (_cs.title.length < 5)  { err('Title needs at least 5 characters'); return; }
      if (_cs.desc.length < 10)  { err('Description needs at least 10 characters'); return; }
      if (!_cs.photos.length)    { err('Please add at least one photo'); return; }

      btn.disabled = true; btn.textContent = 'Submitting…';

      const u = H.currentUser();
      const needsApproval = !!(H.state.requireListingApproval && !(H.state.autoApproveVerified && u.verified));
      const listing = {
        id: H.uid(), sellerId: u.id, sellerName: u.name || '', sellerPhone: u.phone || '',
        title: _cs.title, desc: _cs.desc, price: _cs.price, currency: _cs.currency,
        cat: _cs.cat, prov: _cs.prov, city: _cs.city, suburb: _cs.suburb,
        photos: _cs.photos, createdAt: Date.now(),
        status: 'pending',
        contactMethod: _cs.contact, boost: null, views: 0,
      };

      if (!Array.isArray(H.state.listings)) H.state.listings = [];
      H.state.listings.unshift(listing);
      H.saveState();
      if (typeof H.saveListingToCloud === 'function') H.saveListingToCloud(listing);

      H.toast('Ad submitted! It will go live after admin review. ✅', 5000);
      H.goBack();
    },
  };

  // Fallback compressImage (in case post.js hasn't loaded yet)
  function _compressImage(file, maxDim, q) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = ev => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
          else if (h > maxDim)     { w = Math.round(w * maxDim / h); h = maxDim; }
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          res(c.toDataURL('image/jpeg', q || 0.78));
        };
        img.src = ev.target.result;
      };
      r.readAsDataURL(file);
    });
  }

  // ─── AdsBoost: select listing to promote ─────────────────────────────────────
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
          const thumb = (l.photos && l.photos[0])
            ? `<img src="${escHtml(l.photos[0])}" style="width:54px;height:54px;border-radius:10px;object-fit:cover;flex-shrink:0">`
            : `<div style="width:54px;height:54px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--sub)">${IC.photo}</div>`;
          return `
          <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
            <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px">
              ${thumb}
              <div style="flex:1;min-width:0">
                <div style="font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title)}</div>
                <div style="font-size:12px;color:var(--sub);margin-top:3px">${escHtml(fmtPrice(l.price, l.currency))} · ${escHtml(l.city || '')}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <button onclick="H._adv.selectBoost(${i},'Sponsored Listing')"
                style="padding:10px 8px;background:var(--blue-light);border:1.5px solid var(--blue-soft);border-radius:10px;color:var(--blue);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;line-height:1.3">
                ${IC.bolt} Sponsored<div style="font-size:10px;font-weight:500;margin-top:3px;opacity:.75">Every 5 listings</div>
              </button>
              <button onclick="H._adv.selectBoost(${i},'Featured Ad')"
                style="padding:10px 8px;background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:10px;color:#B45309;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;line-height:1.3">
                ${IC.star} Featured<div style="font-size:10px;font-weight:500;margin-top:3px;opacity:.75">Top placement</div>
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  };

  // ─── AdsContact: contact sales ────────────────────────────────────────────────
  pages.AdsContact = function () {
    const listing = _myListings[_selIndex];
    const title   = listing ? listing.title : 'my listing';
    const type    = _selBoostType;
    const msg     = `Hello, I want to promote my ad: "${title}" (${type})`;
    const msgE    = encodeURIComponent(msg);
    const subE    = encodeURIComponent('Advertising Enquiry — ' + type);

    function btn(bg, border, color, icon, label, sub, action) {
      return `<button onclick="${action}"
        style="width:100%;display:flex;align-items:center;gap:14px;padding:16px;background:${bg};border:1.5px solid ${border};border-radius:14px;color:${color};font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;text-align:left">
        <span style="flex-shrink:0">${icon}</span>
        <div><div>${label}</div><div style="font-size:12px;font-weight:400;opacity:.8;margin-top:2px">${sub}</div></div>
      </button>`;
    }

    return `<div class="page active">${H.innerTopbar('Contact Sales')}
      <div style="padding:20px 16px 80px">
        <div style="font-size:22px;font-weight:900;color:var(--text);margin-bottom:4px">Promote Your Listing</div>
        <div style="font-size:13px;color:var(--sub);line-height:1.5;margin-bottom:20px">
          Contact our team to set up your <strong style="color:var(--text)">${escHtml(type)}</strong> package.
        </div>
        <div style="background:var(--blue-light);border:1px solid var(--blue-soft);border-radius:12px;padding:14px;margin-bottom:24px">
          <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Pre-filled message</div>
          <div style="font-size:13px;color:var(--text);line-height:1.6;font-style:italic">"${escHtml(msg)}"</div>
        </div>
        ${btn('#25D366','#25D366','#fff', IC.wa,    'WhatsApp Us',  'Fastest response — usually within the hour', `window.open('https://wa.me/971589772645?text=${msgE}','_blank')`)}
        ${btn('var(--card)','var(--border)','var(--text)', IC.mail,'Email Us','info@pamarket.co.zw',`window.open('mailto:info@pamarket.co.zw?subject=${subE}&body=${msgE}','_blank')`)}
        ${btn('var(--card)','var(--border)','var(--text)', IC.phone,'Call Us','Mon–Sat, 8am–6pm CAT',`window.location.href='tel:+263787341565'`)}
        <div style="margin-top:20px;text-align:center;font-size:12px;color:var(--sub);line-height:1.7">
          No payment is taken through the app.
        </div>
      </div>
    </div>`;
  };

  // ─── My Advertisements ────────────────────────────────────────────────────────
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

    function row(l) {
      const thumb = (l.photos && l.photos[0])
        ? `<img src="${escHtml(l.photos[0])}" style="width:50px;height:50px;border-radius:10px;object-fit:cover;flex-shrink:0">`
        : `<div style="width:50px;height:50px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--sub)">${IC.photo}</div>`;
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
          ${thumb}
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title)}</div>
            <div style="font-size:11px;color:var(--sub);margin-top:3px">${escHtml(fmtPrice(l.price, l.currency))} · ${escHtml(l.city || '')}</div>
          </div>
          <button onclick="H._adv.promoteFromDash('${escHtml(l.id)}')"
            style="background:var(--blue-light);border:1px solid var(--blue-soft);color:var(--blue);font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;cursor:pointer;font-family:inherit;flex-shrink:0">
            Promote
          </button>
        </div>`;
    }

    function section(title, items, emptyMsg) {
      return `
        <div style="margin-bottom:20px">
          <div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;padding:0 16px;margin-bottom:8px">
            ${title} <span style="background:var(--blue);color:#fff;border-radius:8px;padding:1px 7px;font-size:10px;margin-left:4px">${items.length}</span>
          </div>
          <div style="background:var(--card);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:0 16px">
            ${items.length ? items.map(row).join('') : `<div style="padding:18px 0;text-align:center;font-size:13px;color:var(--sub)">${emptyMsg}</div>`}
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
        ${section('Active Ads',  active,  'No active ads yet')}
        ${section('Pending',     pending, 'No pending ads')}
        ${section('Boosted',     boosted, 'No boosted ads — tap Promote to get started')}
      </div>
    </div>`;
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  H._adv = {
    pickCategory(cat) {
      if (cat === 'listing') {
        H.openInner('AdsBoost');
      } else {
        H.openInner('AdsCreate', { category: cat });
      }
    },
    selectBoost(idx, boostType) {
      _selIndex     = idx;
      _selBoostType = boostType;
      H.openInner('AdsContact');
    },
    promoteFromDash(listingId) {
      const u = H.currentUser();
      _myListings = (H.state.listings || []).filter(l => l.sellerId === (u || {}).id && l.status === 'active');
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
