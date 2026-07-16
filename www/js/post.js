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
      return `<div class="page active sticky-topbar">${H.innerTopbar('Post a Free Ad')}<div style="padding: 20px;">${H.emptyState('Sign In Required', 'Sign in to post listings and reach millions of buyers.', 'Sign In', "H.requireAuth('Sign in to post listings')")}</div></div>`;
    }
    // Check for saved draft and offer to restore it
    let savedDraft = null;
    try { savedDraft = JSON.parse(localStorage.getItem('pamarket_draft') || 'null'); } catch (_) {}
    if (savedDraft && savedDraft.cat && !H._postBizTarget) {
      const draftAge = (Date.now() - (savedDraft.savedAt || 0)) / 60000;
      if (draftAge < 10080) { // 7 days
        postState = Object.assign({
          step: 1, cat: null, title: '', desc: '', price: '',
          currency: 'USD', prov: PROVINCES[0],
          city: CITIES_BY_PROV[PROVINCES[0]][0], suburb: '', photos: [], attrs: {}, variations: [],
          businessId: null
        }, savedDraft);
        H._postBizTarget = null;
        const mins = Math.round(draftAge);
        const ageLabel = mins < 60 ? mins + ' min ago' : Math.round(draftAge / 60) + 'h ago';
        return `<div class="page active sticky-topbar">${H.innerTopbar('Post a Free Ad')}
          <div style="padding:24px 16px">
            <div style="background:#EEF2FB;border:1.5px solid #1A3A8F;border-radius:16px;padding:18px;margin-bottom:16px">
              <div style="font-size:15px;font-weight:800;color:#1A3A8F;margin-bottom:4px">Continue your draft?</div>
              <div style="font-size:13px;color:var(--sub);margin-bottom:14px">You left a <strong>${H.escHtml(savedDraft.cat)}</strong> listing unfinished ${ageLabel}${savedDraft.title ? ': "' + H.escHtml(savedDraft.title.slice(0, 40)) + '"' : ''}.</div>
              <div style="display:flex;gap:10px">
                <button onclick="H._post._resumeDraft()" style="flex:1;padding:12px;background:#1A3A8F;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Continue</button>
                <button onclick="H._post._discardDraft()" style="flex:1;padding:12px;background:#fff;color:var(--sub);border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Start fresh</button>
              </div>
            </div>
          </div>
        </div>`;
      }
    }
    postState = {
      step: 1, cat: null, title: '', desc: '', price: '',
      currency: 'USD', prov: PROVINCES[0],
      city: CITIES_BY_PROV[PROVINCES[0]][0], suburb: '', photos: [], attrs: {}, variations: [],
      businessId: H._postBizTarget || null   // set by "Create new business product"
    };
    H._postBizTarget = null;                  // consume once
    return renderPostShell();
  };

  function renderPostTopbar() {
    const title = postState.businessId ? 'Add Business Product' : 'Post a Free Ad';
    // Reuse the shared sticky header, but redirect its back button to the
    // step-aware headerBack() (which saves a draft / steps back through the
    // wizard) instead of a plain goBack. NOTE: this string-replace must match
    // innerTopbar's exact onclick — if that markup changes, update this too, or
    // the back button silently reverts to goBack and drops the draft-save.
    return H.innerTopbar(title).replace('onclick="H.goBack()"', 'onclick="H._post.headerBack()"');
  }

  function renderPostShell() {
    return `<div class="page active sticky-topbar post-flow-page">
      ${renderPostTopbar()}
      <div class="steps-bar" id="stepsBar">
        ${[1, 2, 3, 4].map(n => `<div class="sdot ${n < postState.step ? 'done' : n === postState.step ? 'cur' : ''}"></div>`).join('')}
      </div>
      <div class="form-wrap" id="postBody">${renderPostStep()}</div>
    </div>`;
  }

  const TITLE_PH = {
    property: 'e.g. 3 Bedroom House in Borrowdale',
    vehicles: 'e.g. 2015 Toyota Hilux D4D',
    rooms: 'e.g. Single room to rent in Avondale',
    electronics: 'e.g. iPhone 13 Pro 128GB',
    furniture: 'e.g. 3-Seater Leather Sofa',
    fashion: "e.g. Men's Nike Air Max UK 9",
    services: 'e.g. Professional Plumbing Services',
    agriculture: 'e.g. 50 Bales of Quality Hay',
    pets: 'e.g. Boerboel Puppies for Sale',
    kids: 'e.g. Baby Stroller / Pram',
    other: 'e.g. What are you selling?'
  };
  function titlePlaceholder(cat) { return TITLE_PH[cat] || 'e.g. What are you selling?'; }

  // Optional variants editor (colour / size / stock). Stored on the listing's
  // attrs so it syncs without a new column and shows on the detail page.
  function renderVariantRows() {
    const vs = postState.variations || [];
    if (!vs.length) return '<div style="font-size:12.5px;color:var(--sub2,#98A2B3);padding:6px 0">No variants added.</div>';
    return vs.map((v, i) => `<div class="pv-row" style="display:flex;gap:6px;margin-bottom:7px;align-items:center">
      <input class="fi pv-color" style="flex:1;padding:9px" placeholder="Colour" value="${H.escHtml(v.color || '')}">
      <input class="fi pv-size" style="flex:1;padding:9px" placeholder="Size" value="${H.escHtml(v.size || '')}">
      <input class="fi pv-stock" style="width:62px;padding:9px" type="number" min="0" placeholder="Qty" value="${v.stock != null ? v.stock : ''}">
      <button type="button" onclick="H._post.removeVariation(${i})" aria-label="Remove" style="width:34px;height:34px;flex-shrink:0;border:none;background:#FFF1F0;color:#EF4444;border-radius:8px;cursor:pointer;font-size:17px;font-weight:700">×</button>
    </div>`).join('');
  }
  function renderVariantsSection() {
    return `<div class="fg" style="margin-top:6px">
      <div class="fl">Variants &amp; stock <span style="font-weight:400;color:var(--sub);text-transform:none">(optional)</span></div>
      <div style="font-size:12px;color:var(--sub);margin:-2px 0 8px;line-height:1.45">Add colours, sizes and stock for each option. Leave empty if not needed.</div>
      <div id="postVariants">${renderVariantRows()}</div>
      <button type="button" onclick="H._post.addVariation()" style="width:100%;padding:11px;border:1.5px dashed var(--border,#E4E8F0);border-radius:10px;background:var(--card,#fff);color:#1A3A8F;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:4px">+ Add variation</button>
    </div>`;
  }

  function renderPostStep() {
    const s = postState;
    if (s.step === 1) {
      // Screen 1a — pick a category. Selecting one opens that category's own form.
      if (!s.cat) {
        return `
        <div class="fg">
          <div class="fl">What are you posting?</div>
          <div class="cat-3">
            ${CATEGORIES.map(c => `
              <div class="cat-opt" onclick="H._post.setCat('${c.id}')">
                <div style="font-size:22px">${c.icon}</div>
                <div class="cat-opt-label">${c.name}</div>
              </div>`).join('')}
          </div>
        </div>`;
      }
      // Screen 1b — the chosen category's own form (title, description, details).
      const cat = CATEGORIES.find(c => c.id === s.cat) || { name: 'Listing', icon: '' };
      return `
        <div class="post-cat-bar">
          <div class="post-cat-bar-l"><span class="post-cat-ic">${cat.icon}</span><span>${H.escHtml(cat.name)}</span></div>
          <button class="post-cat-change" onclick="H._post.changeCat()">Change</button>
        </div>
        <div class="fg"><div class="fl">Title</div>
          <input class="fi" id="postTitle" value="${H.escHtml(s.title)}" placeholder="${H.escHtml(titlePlaceholder(s.cat))}" maxlength="80">
        </div>
        <div class="fg"><div class="fl">Description</div>
          <textarea class="fi" rows="4" id="postDesc" placeholder="Describe what you're selling · condition, features, why you're selling..." maxlength="2000">${H.escHtml(s.desc)}</textarea>
        </div>
        ${H.renderAttrFields ? H.renderAttrFields(s.cat, s.attrs) : ''}
        ${renderVariantsSection()}
        <div class="step-btns"><button class="btn-next" onclick="H._post.next()">Continue →</button></div>`;
    }

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
      `<div class="photo-thumb" style="position:relative">
        <img src="${H.escHtml(p)}">
        <button class="rm" onclick="H._post.removePhoto(${i})" aria-label="Remove">x</button>
        ${i === 0
          ? '<span style="position:absolute;bottom:4px;left:4px;font-size:9px;font-weight:800;background:#1A3A8F;color:#fff;border-radius:6px;padding:2px 6px;pointer-events:none">Cover</span>'
          : `<button onclick="H._post.setCover(${i})" style="position:absolute;bottom:4px;left:4px;font-size:9px;font-weight:800;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:6px;padding:2px 6px;cursor:pointer;-webkit-tap-highlight-color:transparent">Set cover</button>`}
      </div>`
    ).join('');
  }

  function refreshBody(isStepTransition) {
    const body = document.getElementById('postBody');
    if (!body) return;
    body.classList.remove('post-step-enter');
    body.innerHTML = renderPostStep();
    if (!isStepTransition) return;

    // The page scrolls inside mainArea. Reset before the next paint so a new
    // step never appears halfway down the form beneath the sticky header.
    const scroller = document.getElementById('mainArea');
    if (scroller) scroller.scrollTop = 0;
    else window.scrollTo(0, 0);

    // Restart the lightweight CSS entrance animation for the newly-rendered
    // step. The stylesheet disables it for reduced-motion users.
    void body.offsetWidth;
    body.classList.add('post-step-enter');
  }

  function refreshSteps() {
    const bar = document.getElementById('stepsBar');
    if (bar) bar.innerHTML = [1, 2, 3, 4].map(n =>
      `<div class="sdot ${n < postState.step ? 'done' : n === postState.step ? 'cur' : ''}"></div>`).join('');
  }

  // Namespace for onclick calls
  H._post = {
    // Smart back from the Post flow: step -> previous step; category form -> the
    // category picker; category picker -> out of Post (back to the business store
    // when creating a business product, else the previous screen).
    headerBack() {
      const s = postState;
      if (s.step > 1) { this.prev(); return; }
      if (s.cat) { this.changeCat(); return; }
      // Save draft if user has meaningful data (category or title set)
      const t = document.getElementById('postTitle'); if (t) s.title = t.value;
      const d = document.getElementById('postDesc');  if (d) s.desc  = d.value;
      if (s.cat || (s.title && s.title.trim())) {
        try {
          localStorage.setItem('pamarket_draft', JSON.stringify({ savedAt: Date.now(), ...s }));
          const u = H.currentUser && H.currentUser();
          if (u && typeof H.pushNotif === 'function') {
            H.pushNotif(u.id, 'Unfinished Ad Saved', 'You have an unfinished ad. Tap to continue posting.', 'info', null, 'page:Post');
          }
          H.toast('Draft saved');
        } catch (_) {}
      }
      if (typeof H.goBack === 'function') H.goBack(); else H.navTo('Home');
    },
    readVariations() {
      const out = [];
      document.querySelectorAll('#postVariants .pv-row').forEach(function (r) {
        const color = ((r.querySelector('.pv-color') || {}).value || '').trim();
        const size = ((r.querySelector('.pv-size') || {}).value || '').trim();
        const stockRaw = (r.querySelector('.pv-stock') || {}).value || '';
        if (color || size || stockRaw !== '') out.push({ color: color, size: size, stock: stockRaw === '' ? null : Number(stockRaw) });
      });
      postState.variations = out;
      return out;
    },
    addVariation() {
      this.readVariations();
      postState.variations = postState.variations || [];
      postState.variations.push({ color: '', size: '', stock: null });
      const el = document.getElementById('postVariants'); if (el) el.innerHTML = renderVariantRows();
    },
    removeVariation(i) {
      this.readVariations();
      postState.variations.splice(i, 1);
      const el = document.getElementById('postVariants'); if (el) el.innerHTML = renderVariantRows();
    },
    _resumeDraft() {
      // postState was already populated from the draft in pages.Post
      try { localStorage.removeItem('pamarket_draft'); } catch (_) {}
      H.renderPage('Post', null, true);
    },
    _discardDraft() {
      try { localStorage.removeItem('pamarket_draft'); } catch (_) {}
      postState = {
        step: 1, cat: null, title: '', desc: '', price: '',
        currency: 'USD', prov: PROVINCES[0],
        city: CITIES_BY_PROV[PROVINCES[0]][0], suburb: '', photos: [], attrs: {}, variations: [],
        businessId: null
      };
      H.renderPage('Post');
    },
    setCat(c)    {
      if(c==='jobs'){H.openInner('JobIntent');return;}
      // Preserve anything already typed before the step re-renders.
      const t = document.getElementById('postTitle'); if (t) postState.title = t.value;
      const d = document.getElementById('postDesc');  if (d) postState.desc  = d.value;
      if (H.readAttrFields) postState.attrs = Object.assign({}, postState.attrs, H.readAttrFields(document.getElementById('postBody')));
      postState.cat = c; refreshBody(true);
    },
    changeCat() {
      // Back to the category picker. Keep title/desc; drop the old category's attrs.
      const t = document.getElementById('postTitle'); if (t) postState.title = t.value;
      const d = document.getElementById('postDesc');  if (d) postState.desc  = d.value;
      postState.cat = null; postState.attrs = {};
      refreshBody(true);
    },
    toggleChip(btn) { if (btn) btn.classList.toggle('on'); },
    setCur(c)    { postState.currency = c; refreshBody(); },
    onProv(p)    { postState.prov = p; postState.city = CITIES_BY_PROV[p][0]; refreshBody(); },
    removePhoto(i) { postState.photos.splice(i, 1); document.getElementById('photoGrid').innerHTML = renderPhotoGrid(); },
    setCover(i) {
      if (i > 0 && i < postState.photos.length) {
        const cover = postState.photos.splice(i, 1)[0];
        postState.photos.unshift(cover);
        const g = document.getElementById('photoGrid');
        if (g) g.innerHTML = renderPhotoGrid();
      }
    },
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
        this.readVariations();
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
      refreshBody(true);
    },
    prev() {
      if (postState.step > 1) { postState.step--; refreshSteps(); refreshBody(true); }
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
      const needsApproval = u.role !== 'admin' && !!(H.state.requireListingApproval && !(H.state.autoApproveVerified && u.verified));
      // Pending if the admin forces review OR moderation flagged it for review. Admin always goes live immediately.
      const finalStatus = (needsApproval || (u.role !== 'admin' && mod.status === 'pending')) ? 'pending' : 'active';

      H._post._posting = true;
      const btn = document.querySelector('.btn-submit');
      if (btn) { btn.disabled = true; btn.textContent = 'Posting…'; }

      // Upload photos to cloud storage and keep only URLs. Storing base64 in
      // localStorage overflows the 5MB quota (the old crash) and bloats both
      // the cloud row and every listing fetch (the old slowness).
      let photos = [];
      try {
        if (btn && s.photos.length) btn.textContent = 'Uploading photos…';
        // Older callers intentionally treat uploads as best-effort, so this
        // helper can return the original data URL after an R2 failure. Posting
        // is strict: retry, then accept only a complete set of hosted URLs.
        const isHostedPhoto = p => typeof p === 'string' && /^https?:\/\//i.test(p);
        let uploadError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (attempt) {
              if (btn) btn.textContent = 'Retrying photos…';
              await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 750 : 2000));
            }
            const result = H.withTimeout
              ? await H.withTimeout(H.uploadListingPhotos(s.photos, u.id), 45000, 'photo upload')
              : await H.uploadListingPhotos(s.photos, u.id);
            if (!Array.isArray(result) || result.length !== s.photos.length || result.some(p => !isHostedPhoto(p))) {
              // Prefer the real per-photo failure reason (auth/R2/network) captured by
              // uploadListingPhotos over a generic message, so the user and the logs
              // both see what actually went wrong.
              throw (result && result._uploadError) || new Error('One or more photos were not uploaded');
            }
            photos = result;
            uploadError = null;
            break;
          } catch (e) {
            uploadError = e;
            // An expired/invalid session will fail identically on every retry —
            // stop burning attempts and tell the user to sign in again instead.
            if (e && /not authenticated/i.test(e.message || '')) break;
          }
        }
        if (uploadError) throw uploadError;
      } catch (e) {
        H._post._posting = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Post Ad →'; }
        const authFailure = e && /not authenticated/i.test(e.message || '');
        const userMsg = authFailure
          ? 'Your session expired. Please sign in again and retry posting.'
          : 'We could not upload every photo. Check your connection and tap Post Ad to retry.';
        if (H.showError) H.showError(userMsg, e, 'post.upload.failed');
        else H.toast(userMsg, 6000, true);
        return; // Never add locally or call saveListingToCloud with data/blob URLs.
      }

      // USD is the canonical currency. If the seller entered ZiG, convert to USD
      // now using the central rate and store it as USD, so every price across the
      // app uses one source of truth.
      let _priceUSD = Number(s.price) || 0;
      if (s.currency === 'ZiG' && typeof H.toUSD === 'function') {
        _priceUSD = Math.round(H.toUSD(s.price, 'ZiG') * 100) / 100;
      }

      const l = {
        id: listingId, sellerId: u.id, sellerName: u.name || '', sellerPhone: u.phone || '', title: s.title, desc: s.desc,
        price: _priceUSD, currency: 'USD', cat: s.cat,
        prov: s.prov, city: s.city, suburb: s.suburb,
        photos: photos, createdAt: Date.now(),
        status: finalStatus,
        businessId: s.businessId || null,   // business product (kept out of personal listings)
        views: 0
      };
      // Attach category-specific attributes (top-level too, so Browse filters see them).
      if (H.applyAttrs) H.applyAttrs(l, s.attrs || {});
      else l.attrs = s.attrs || {};
      // Variants (colour / size / stock) — stored in attrs so they sync + restore.
      this.readVariations();
      const vars = (s.variations || []).filter(v => v.color || v.size || (v.stock != null && v.stock !== ''));
      if (vars.length) { l.attrs = l.attrs || {}; l.attrs.variations = vars; l.variations = vars; }
      H.state.listings.unshift(l);
      H.saveState();
      // Did the cloud accept the row? Only a confirmed cloud write makes the
      // ad visible to other devices and lets it survive a refresh (the feed
      // reloads from the cloud, so a local-only ad is dropped). Track the
      // outcome so we never falsely tell the user "your ad is live" when the
      // write actually failed.
      let cloudSaved = true;
      if (typeof H.saveListingToCloud === "function") {
        try {
          const saveRes = await (H.withTimeout ? H.withTimeout(H.saveListingToCloud(l), 20000, 'save listing') : H.saveListingToCloud(l));
          // Backend moderation blocked the post (prohibited content or an account
          // sanction). Undo the optimistic local add so it never appears "live",
          // then show the friendly reason from the backend decision.
          if (saveRes && saveRes.blocked) {
            H.state.listings = (H.state.listings || []).filter(x => x.id !== listingId);
            H.saveState();
            H._post._posting = false;
            if (btn) { btn.disabled = false; btn.textContent = 'Post Ad →'; }
            const msg = (saveRes.friendly && saveRes.friendly.message) ||
              (window.Safety ? Safety.friendlyError(saveRes.error).message : 'This ad could not be posted.');
            H.toast(msg, 6000, true);
            return;
          }
          // A non-blocked failure (RLS/network/schema) — the ad is on the device
          // but NOT in the cloud. Keep it locally (the feed-merge grace window
          // preserves own recent posts across refreshes) and queue a retry
          // instead of claiming success.
          if (saveRes && saveRes.ok === false) {
            cloudSaved = false;
            if (typeof H.queueListingSync === 'function') H.queueListingSync(l);
          }
        } catch (e) {
          cloudSaved = false;
          if (typeof H.queueListingSync === 'function') H.queueListingSync(l);
          if (e && e._timeout && H.showError) H.showError('Saved on your device but the cloud didn’t respond — it will sync later.', e, 'post.cloud.timeout');
        }
      }

      H._post._posting = false;
      // Business product: return to the store catalog, not the personal listings.
      if (s.businessId && typeof H._bizListings === 'object' && H._bizListings.open) {
        H.toast('Product added to your store!');
        H._bizListings.open(s.businessId);
        return;
      }
      // Clear any saved draft — post was successful
      try { localStorage.removeItem('pamarket_draft'); } catch (_) {}
      // Use the reconciled status: saveListingToCloud may have downgraded the ad
      // to 'flagged' server-side, so honour l.status over the pre-save guess.
      const liveStatus = l.status || finalStatus;
      if (!cloudSaved) {
        // Saved on device, cloud write didn't land — be honest and send them to
        // My Listings (where the retry queue will sync it) rather than Home,
        // where a not-yet-synced ad can look like it "disappeared".
        H.toast('Saved on your device — we’ll finish posting it as soon as you’re back online.', 6000, true);
        H.openInner('MyListings');
      } else if (liveStatus !== 'active') {
        H.toast(mod.status === 'pending' && !needsApproval
          ? (mod.reason || 'Ad submitted for review before going live.')
          : 'Ad submitted! It will go live after review.', 5000);
        H.openInner('MyListings');
      } else {
        H.toast('Your ad is live!');
        H.navTo('Home', document.querySelector('[data-nav="Home"]'));
      }
    }
  };

  // Upload base64 photos to Cloudflare R2; return an array of public URLs.
  // Anything already an http(s) URL is passed through untouched. If the upload
  // fails, that photo keeps its original value so the listing still posts
  // (best-effort, never blocks the user).
  H.uploadListingPhotos = async function uploadListingPhotos(photos, userId) {
    const list = Array.isArray(photos) ? photos : [];
    if (typeof H.uploadToR2 !== 'function') return list;
    const out = [];
    let lastError = null;
    for (const p of list) {
      if (typeof p !== 'string' || p.indexOf('data:') !== 0) { out.push(p); continue; }
      try {
        const key = 'listings/' + userId + '/' + H.uid() + '.jpg';
        const b64p = p.split(',')[1];
        const blob = new Blob([Uint8Array.from(atob(b64p), c => c.charCodeAt(0))], { type: 'image/jpeg' });
        const url = await H.uploadToR2(blob, key, 'image/jpeg');
        out.push(url || p);
      } catch (e) {
        // Keep the real reason instead of discarding it — callers need to know
        // WHY an upload failed (expired session vs. R2 outage vs. bad network)
        // to decide whether retrying even makes sense.
        lastError = e;
        if (H.logError) H.logError('uploadListingPhotos', e);
        out.push(p);
      }
    }
    out._uploadError = lastError; // non-enumerable-ish flag; array stays a normal array for existing callers
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
