/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  
  const { CATEGORIES, PROVINCES, CITIES_BY_PROV } = H;

  let postState = {};

  pages.Post = function () {
    if (!H.currentUser()) {
      return `<div class="page active">${H.innerTopbar('Post a Listing')}<div style="padding: 20px;">${H.emptyState('Sign In Required', 'Sign in to post listings and reach millions of buyers.', 'Sign In', "H.requireAuth('Sign in to post listings')")}</div></div>`;
    }
    postState = {
      step: 1, cat: null, title: '', desc: '', price: '',
      currency: 'USD', prov: PROVINCES[0],
      city: CITIES_BY_PROV[PROVINCES[0]][0], suburb: '', photos: [], attrs: {}
    };
    return renderPostShell();
  };

  function renderPostShell() {
    return `<div class="page active">
      <div class="post-header">
        <div class="post-h">Post a Free Ad</div>
        <div class="post-sub-txt">Reach buyers across Zimbabwe in minutes</div>
      </div>
      <div class="steps-bar" id="stepsBar">
        ${[1, 2, 3, 4].map(n => `<div class="sdot ${n < postState.step ? 'done' : n === postState.step ? 'cur' : ''}"></div>`).join('')}
      </div>
      <div class="form-wrap" id="postBody">${renderPostStep()}</div>
    </div>`;
  }

  function renderPostStep() {
    const s = postState;
    if (s.step === 1) return `
      <div class="fg">
        <div class="fl">Category</div>
        <div class="cat-3">
          ${CATEGORIES.map(c => `
            <div class="cat-opt ${s.cat === c.id ? 'sel' : ''}" onclick="H._post.setCat('${c.id}')">
              <div style="font-size:22px">${c.icon}</div>
              <div class="cat-opt-label">${c.name}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="fg"><div class="fl">Title</div>
        <input class="fi" id="postTitle" value="${H.escHtml(s.title)}" placeholder="e.g. 3 Bedroom Flat in Avondale" maxlength="80">
      </div>
      <div class="fg"><div class="fl">Description</div>
        <textarea class="fi" rows="4" id="postDesc" placeholder="Describe what you're selling · condition, features, why you're selling..." maxlength="2000">${H.escHtml(s.desc)}</textarea>
      </div>
      ${s.cat && H.renderAttrFields ? H.renderAttrFields(s.cat, s.attrs) : ''}
      <div class="step-btns"><button class="btn-next" onclick="H._post.next()">Continue →</button></div>`;

    if (s.step === 2) return `
      <div class="fg"><div class="fl">Price</div>
        ${H.state.freeOnly
          ? `<div class="fi" style="color:var(--sub);cursor:default;background:var(--bg2)">Free / Negotiable (set by platform)</div><input type="hidden" id="priceInput" value="0">`
          : `<div class="price-row">
              <input class="fi" style="flex:1" type="number" placeholder="0" id="priceInput" value="${H.escHtml(s.price)}" min="0">
              <div class="cur-toggle">
                <button class="cur ${s.currency === 'USD' ? 'on' : ''}" onclick="H._post.setCur('USD')">USD</button>
                <button class="cur ${s.currency === 'ZiG' ? 'on' : ''}" onclick="H._post.setCur('ZiG')">ZiG</button>
              </div>
            </div>`
        }
      </div>
      <div class="fg"><div class="fl">Province</div>
        <select class="fi" id="provinceSel" onchange="H._post.onProv(this.value)">
          ${PROVINCES.map(p => `<option ${s.prov === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><div class="fl">City / Town</div>
        <select class="fi" id="citySel">
          ${(CITIES_BY_PROV[s.prov] || []).map(c => `<option ${s.city === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><div class="fl">Suburb / Area (optional)</div>
        <input class="fi" id="suburbIn" value="${H.escHtml(s.suburb)}" placeholder="e.g. Avondale West">
      </div>
      <div class="step-btns">
        <button class="btn-prev" onclick="H._post.prev()">← Back</button>
        <button class="btn-next" onclick="H._post.next()">Continue →</button>
      </div>`;

    if (s.step === 3) return `
      <div class="fg">
        <div class="fl">Photos <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--sub2)">(up to 8 · first is the cover)</span></div>
        ${H.state.allowImageUploads === false
          ? `<div style="padding:18px;background:var(--bg2);border-radius:12px;text-align:center;color:var(--sub);font-size:13px;border:1px dashed var(--border)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Photo uploads are currently disabled by the admin.</div>`
          : `<div style="display:flex;gap:10px;margin-bottom:10px" id="photoActions">
              <button type="button" onclick="H._post.pick('upload')" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;padding:18px 10px;background:var(--card);border:1.5px dashed var(--border-mid);border-radius:14px;color:var(--blue);cursor:pointer;font-size:13px;font-weight:700">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload
              </button>
              <button type="button" onclick="H._post.pick('camera')" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;padding:18px 10px;background:var(--card);border:1.5px dashed var(--border-mid);border-radius:14px;color:var(--blue);cursor:pointer;font-size:13px;font-weight:700">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Camera
              </button>
            </div>
            <div style="text-align:center;font-size:12px;color:var(--sub);margin-bottom:10px">JPG or PNG · up to 8 photos · auto-compressed</div>
            <input type="file" id="photoFileUpload" accept="image/*" multiple style="display:none" onchange="H._post.onPhotos(event)">
            <input type="file" id="photoFileCamera" accept="image/*" capture="environment" style="display:none" onchange="H._post.onPhotos(event)">
            <div id="photoProgress" style="display:none;text-align:center;font-size:13px;color:var(--blue);font-weight:600;padding:10px 0"></div>
            <div class="photo-grid" id="photoGrid">${renderPhotoGrid()}</div>`
        }
      </div>
      <div class="tip-box">
        <div class="tip-title"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Photos sell 3× faster</div>
        <div class="tip-body">Listings with 5+ clear photos in good lighting get 3× more enquiries.</div>
      </div>
      <div class="step-btns">
        <button class="btn-prev" onclick="H._post.prev()">← Back</button>
        <button class="btn-next" onclick="H._post.next()">Preview →</button>
      </div>`;

    if (s.step === 4) return `
      <div class="preview-card">
        <div class="preview-label"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Ad Preview</div>
        <div class="preview-title">${H.escHtml(s.title || 'Untitled')}</div>
        <div class="preview-price">${H.escHtml(H.fmtPrice(s.price, s.currency))}</div>
        <div class="preview-meta"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${H.escHtml(s.suburb || s.city)}, ${H.escHtml(s.prov)} · ${(CATEGORIES.find(c => c.id === s.cat) || {}).name || 'Other'} · ${s.photos.length} photo${s.photos.length === 1 ? '' : 's'}</div>
      </div>
      <div class="tip-box">
        <div class="tip-title"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>Listing Rules</div>
        <div class="tip-body">By posting you confirm this item is legal, you own it, and the photos are real. Scam listings result in account suspension.</div>
      </div>
      <div class="step-btns">
        <button class="btn-prev" onclick="H._post.prev()">← Back</button>
        <button class="btn-submit" onclick="H._post.submit()">Post Ad →</button>
      </div>`;
  }

  function renderPhotoGrid() {
    return postState.photos.map((p, i) =>
      `<div class="photo-thumb"><img src="${p}"><button class="rm" onclick="H._post.removePhoto(${i})">×</button></div>`
    ).join('');
  }

  function refreshBody() {
    document.getElementById('postBody').innerHTML = renderPostStep();
  }

  function refreshSteps() {
    const bar = document.getElementById('stepsBar');
    if (bar) bar.innerHTML = [1, 2, 3, 4].map(n =>
      `<div class="sdot ${n < postState.step ? 'done' : n === postState.step ? 'cur' : ''}"></div>`).join('');
  }

  // Namespace for onclick calls
  H._post = {
    setCat(c)    {
      if(c==='jobs'){H.openInner('PostJob');return;}
      // Preserve anything already typed before the step re-renders.
      const t = document.getElementById('postTitle'); if (t) postState.title = t.value;
      const d = document.getElementById('postDesc');  if (d) postState.desc  = d.value;
      if (H.readAttrFields) postState.attrs = Object.assign({}, postState.attrs, H.readAttrFields(document.getElementById('postBody')));
      postState.cat = c; refreshBody();
    },
    toggleChip(btn) { if (btn) btn.classList.toggle('on'); },
    setCur(c)    { postState.currency = c; refreshBody(); },
    onProv(p)    { postState.prov = p; postState.city = CITIES_BY_PROV[p][0]; refreshBody(); },
    removePhoto(i) { postState.photos.splice(i, 1); document.getElementById('photoGrid').innerHTML = renderPhotoGrid(); },
    pick(mode) {
      if (H._post._compressing) { H.toast('Still processing the last photos…', 2500); return; }
      const el = document.getElementById(mode === 'camera' ? 'photoFileCamera' : 'photoFileUpload');
      if (el) el.click();
    },
    async onPhotos(e)  {
      if (H._post._compressing) return;
      const ALLOWED = ['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif',''];
      const MAX_BYTES = 25 * 1024 * 1024; // originals can be large; we compress them right down
      const files = Array.from(e.target.files || []);
      const remaining = 8 - postState.photos.length;
      let rejected = 0;
      const valid = [];
      files.slice(0, remaining).forEach(f => {
        if (f.type && ALLOWED.indexOf(f.type) === -1) { rejected++; return; }
        if (f.size > MAX_BYTES) { rejected++; return; }
        valid.push(f);
      });
      if (files.length > remaining) H.toast('You can add up to 8 photos', 3000, true);
      if (rejected) H.toast(rejected + ' photo(s) skipped — use a JPG or PNG image', 4000, true);
      e.target.value = '';
      if (!valid.length) return;

      // Compress one at a time. Decoding several full-size phone photos at once
      // thrashes memory on the device and is what made it hang on "Processing".
      H._post._compressing = true;
      const actions = document.getElementById('photoActions');
      const prog    = document.getElementById('photoProgress');
      if (actions) { actions.style.opacity = '.5'; actions.style.pointerEvents = 'none'; }

      let done = 0;
      for (const f of valid) {
        if (prog) {
          prog.style.display = 'block';
          prog.textContent = valid.length > 1
            ? 'Processing photo ' + (done + 1) + ' of ' + valid.length + '…'
            : 'Processing photo…';
        }
        try {
          // 1024px / q0.72 keeps marketplace photos sharp at roughly half the bytes
          // of the old 1200px setting — listings load faster and cost less data.
          const d = await H.compressImage(f, 1024, 0.72);
          if (d) {
            postState.photos.push(d);
            const g = document.getElementById('photoGrid');
            if (g) g.innerHTML = renderPhotoGrid(); // show each photo as it finishes
          }
        } catch (err) { /* skip a photo that fails to decode */ }
        done++;
      }

      if (prog) prog.style.display = 'none';
      if (actions) { actions.style.opacity = ''; actions.style.pointerEvents = ''; }
      H._post._compressing = false;
    },
    next() {
      const s = postState;
      if (s.step === 1) {
        s.title = document.getElementById('postTitle').value.trim();
        s.desc  = document.getElementById('postDesc').value.trim();
        if (!s.cat)               { H.toast('Pick a category'); return; }
        if (s.title.length < 5)   { H.toast('Title needs at least 5 characters'); return; }
        if (s.desc.length < 10)   { H.toast('Description needs at least 10 characters'); return; }
        if (H.readAttrFields)     s.attrs = Object.assign({}, s.attrs, H.readAttrFields(document.getElementById('postBody')));
      } else if (s.step === 2) {
        s.price  = document.getElementById('priceInput').value;
        s.prov   = document.getElementById('provinceSel').value;
        s.city   = document.getElementById('citySel').value;
        s.suburb = document.getElementById('suburbIn').value.trim();
        if (!H.state.freeOnly && (!s.price || Number(s.price) <= 0)) { H.toast('Enter a valid price'); return; }
        if (H.state.freeOnly) s.price = '0';
      } else if (s.step === 3) {
        if (H.state.allowImageUploads !== false && !s.photos.length) { H.toast('Add at least one photo'); return; }
      }
      s.step++;
      refreshSteps();
      refreshBody();
    },
    prev() {
      if (postState.step > 1) { postState.step--; refreshSteps(); refreshBody(); }
    },
    async submit() {
      if (H._post._posting) return;            // guard against double-tap → duplicate listings
      if (H.checkBan && H.checkBan()) return;
      const s = postState;

      // Re-validate all required fields before posting
      if (!s.title || !s.title.trim()) { H.toast('Please add a title for your listing'); return; }
      if (!H.state.freeOnly && (s.price === '' || s.price === null || s.price === undefined || isNaN(Number(s.price)) || Number(s.price) < 0)) { H.toast('Please enter a valid price'); return; }
      if (!s.cat) { H.toast('Please select a category'); return; }
      if (!s.desc || !s.desc.trim()) { H.toast('Please add a description'); return; }
      if (H.state.allowImageUploads !== false && !s.photos.length) { H.toast('Please add at least one photo'); return; }

      const u = H.currentUser();
      const listingId = H.uid();

      // Content moderation + anti-spam: banned terms, duplicate titles, and a
      // 5-posts-per-24h flood guard (see moderation.js). Runs before the photo
      // upload so a rejected ad never wastes bandwidth.
      let mod = { status: 'active', reason: null };
      if (typeof H.moderateListing === 'function') {
        try { mod = H.moderateListing({ id: listingId, title: s.title, desc: s.desc, cat: s.cat }, u) || mod; }
        catch (e) { mod = { status: 'active', reason: null }; }
        if (mod.status === 'rejected') { H.toast(mod.reason || 'Listing could not be posted', 5000, true); return; }
      }
      const needsApproval = !!(H.state.requireListingApproval && !(H.state.autoApproveVerified && u.verified));
      // Pending if the admin forces review OR moderation flagged it for review.
      const finalStatus = (needsApproval || mod.status === 'pending') ? 'pending' : 'active';

      H._post._posting = true;
      const btn = document.querySelector('.btn-submit');
      if (btn) { btn.disabled = true; btn.textContent = 'Posting…'; }

      // Upload photos to cloud storage and keep only URLs. Storing base64 in
      // localStorage overflows the 5MB quota (the old crash) and bloats both
      // the cloud row and every listing fetch (the old slowness).
      let photos = s.photos;
      try {
        if (btn && s.photos.length) btn.textContent = 'Uploading photos…';
        // Cap the upload so a stalled network surfaces a code instead of hanging.
        photos = H.withTimeout
          ? await H.withTimeout(H.uploadListingPhotos(s.photos, u.id), 45000, 'photo upload')
          : await H.uploadListingPhotos(s.photos, u.id);
      } catch (e) {
        if (e && e._timeout && H.showError) H.showError('Photos took too long to upload — posting without waiting.', e, 'post.upload.timeout');
        /* fall back to whatever we have */
      }

      const l = {
        id: listingId, sellerId: u.id, sellerName: u.name || '', sellerPhone: u.phone || '', title: s.title, desc: s.desc,
        price: s.price, currency: s.currency, cat: s.cat,
        prov: s.prov, city: s.city, suburb: s.suburb,
        photos: photos, createdAt: Date.now(),
        status: finalStatus,
        views: 0
      };
      // Attach category-specific attributes (top-level too, so Browse filters see them).
      if (H.applyAttrs) H.applyAttrs(l, s.attrs || {});
      else l.attrs = s.attrs || {};
      H.state.listings.unshift(l);
      H.saveState();
      if (typeof H.saveListingToCloud === "function") {
        try {
          await (H.withTimeout ? H.withTimeout(H.saveListingToCloud(l), 20000, 'save listing') : H.saveListingToCloud(l));
        } catch (e) {
          if (e && e._timeout && H.showError) H.showError('Saved on your device but the cloud didn’t respond — it will sync later.', e, 'post.cloud.timeout');
        }
      }

      H._post._posting = false;
      if (finalStatus === 'pending') {
        H.toast(mod.status === 'pending' && !needsApproval
          ? (mod.reason || 'Ad submitted for review before going live.')
          : 'Ad submitted! It will go live after admin review.', 5000);
        H.openInner('MyListings');
      } else {
        H.toast('Your ad is live!');
        H.navTo('Home', document.querySelector('[data-nav="Home"]'));
      }
    }
  };

  // Upload base64 photos to Supabase Storage; return an array of public URLs.
  // Anything already an http(s) URL is passed through untouched. If storage is
  // unavailable or an upload fails, that photo keeps its original value so the
  // listing still posts (best-effort, never blocks the user).
  H.uploadListingPhotos = async function uploadListingPhotos(photos, userId) {
    const list = Array.isArray(photos) ? photos : [];
    const sb = window.supabase;
    if (!sb || typeof sb.storage !== 'object') return list;
    const out = [];
    for (const p of list) {
      if (typeof p !== 'string' || p.indexOf('data:') !== 0) { out.push(p); continue; }
      try {
        // Path must match the storage RLS policy: listings/{user_id}/file.jpg
        const path = 'listings/' + userId + '/' + H.uid() + '.jpg';
        const blob = await (await fetch(p)).blob();
        const { data: up, error } = await sb.storage.from('listings-photos')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (!error && up) {
          const { data: urlData } = sb.storage.from('listings-photos').getPublicUrl(path);
          out.push(urlData && urlData.publicUrl ? urlData.publicUrl : p);
        } else {
          out.push(p);
        }
      } catch (e) { out.push(p); }
    }
    return out;
  };

  H.compressImage = function compressImage(file, maxDim = 1200, q = 0.8) {
    return new Promise(res => {
      // Draw a decoded source (ImageBitmap or <img>) to a scaled canvas and return a JPEG data URL.
      function finish(src, sw, sh) {
        let w = sw, h = sh;
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else        { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(src, 0, 0, w, h);
        try { if (src.close) src.close(); } catch (e) {} // free the ImageBitmap right away
        let out = '';
        try { out = c.toDataURL('image/jpeg', q); } catch (e) {}
        c.width = c.height = 0; // release canvas memory
        res(out);
      }

      // Fallback path for engines without createImageBitmap (older iOS).
      function viaReader() {
        const r = new FileReader();
        r.onload = ev => {
          const img = new Image();
          img.onload  = () => finish(img, img.width, img.height);
          img.onerror = () => res('');
          img.src = ev.target.result;
        };
        r.onerror = () => res('');
        r.readAsDataURL(file);
      }

      if (window.createImageBitmap) {
        createImageBitmap(file)
          .then(bmp => finish(bmp, bmp.width, bmp.height))
          .catch(viaReader); // HEIC or odd formats fall back to the <img> decoder
      } else {
        viaReader();
      }
    });
  }

})(window.H);
