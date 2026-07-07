/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;

  const S = {
    crossCircle: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    location:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    eye:         '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    boost:       '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    message:     '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    phone:       '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg>',
    flag:        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    heart:       '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    heartFill:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="#1A3A8F" stroke="#1A3A8F" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    user:        '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    wa:          '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 0C5.364 0 0 5.372 0 11.994c0 2.116.554 4.1 1.524 5.822L.057 24l6.304-1.654A11.978 11.978 0 0 0 11.99 24C18.626 24 24 18.628 24 12.006 24 5.372 18.626 0 11.99 0zm.01 21.818a9.886 9.886 0 0 1-5.031-1.375l-.361-.214-3.741.981.999-3.648-.235-.374A9.82 9.82 0 0 1 2.18 12c0-5.418 4.412-9.824 9.82-9.824 5.418 0 9.824 4.406 9.824 9.824 0 5.418-4.406 9.818-9.824 9.818z"/></svg>',
  };

  function getSeller(l) {
    const found = (H.state.users||[]).find(u => u.id === l.sellerId);
    if (found) return found;
    return {
      id:       l.sellerId   || '',
      name:     l.sellerName || 'Seller',
      phone:    l.sellerPhone|| '',
      verified: false,
      joinedAt: l.createdAt  || Date.now(),
      avatar:   null
    };
  }

  // Render the variants table (colour / size / stock) if the listing has any.
  H._variationsHtml = function (l) {
    var vars = (l && (l.variations || (l.attrs && l.attrs.variations))) || [];
    if (!Array.isArray(vars) || !vars.length) return '';
    var row = function (v) {
      var parts = [];
      if (v.color) parts.push(H.escHtml(v.color));
      if (v.size) parts.push(H.escHtml(v.size));
      var label = parts.join(' · ') || 'Option';
      var out = (v.stock != null && v.stock !== '') ? Number(v.stock) : null;
      var stockTxt = out === null ? '' : (out > 0
        ? '<span style="font-size:11.5px;font-weight:700;color:#0f7a3d;background:#EAF7EF;border-radius:20px;padding:2px 9px">' + out + ' in stock</span>'
        : '<span style="font-size:11.5px;font-weight:700;color:#B42318;background:#FEE4E2;border-radius:20px;padding:2px 9px">Out of stock</span>');
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border,#E8ECF4)">'
        + '<span style="font-size:13.5px;font-weight:600;color:var(--text)">' + label + '</span>' + stockTxt + '</div>';
    };
    return '<div class="det-section"><div class="det-sec-title">Available options</div>'
      + '<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:2px 14px">'
      + vars.map(row).join('') + '</div></div>';
  };

  pages.Detail = function ({ id }) {
    const l = (H.state.listings||[]).find(x => x.id === id);
    if (!l) {
      if (H._detailFetchFailed === id)
        return `<div class="page active">${H.innerTopbar('Listing')}<div class="empty-state"><div class="empty-icon">${S.crossCircle}</div><div class="empty-title">Listing not found</div><div class="empty-sub">This listing may have been removed or is no longer available.</div></div></div>`;
      return `<div class="page active">${H.innerTopbar('Listing')}<div class="empty-state" id="detailLoading"><div class="empty-title">Loading…</div></div></div>`;
    }

    const seller      = getSeller(l);
    const u           = H.currentUser();
    const saved       = u ? (H.state.saves[u.id]||[]).includes(id) : false;
    const isMine      = u && u.id && seller.id && seller.id === u.id;
    const photos      = l.photos && l.photos.length ? l.photos : [];
    const sellerPhone = seller.phone || l.sellerPhone || '';
    const sellerName  = seller.name  || l.sellerName  || 'Seller';

    // Moderation-aware visibility: a listing in a hidden backend state
    // (under_review / flagged / removed / deleted / pending) is only viewable by
    // its owner. Buyers reaching it via a stale link or cached row see a neutral
    // "not available" page instead. The seller still sees it with its status.
    if (!isMine && window.Safety && !Safety.isPubliclyVisible(l.status) && l.status !== 'sold') {
      return `<div class="page active">${H.innerTopbar('Listing')}<div class="empty-state"><div class="empty-icon">${S.crossCircle}</div><div class="empty-title">Listing not available</div><div class="empty-sub">This listing is no longer available or is being reviewed.</div></div></div>`;
    }

    if (!isMine) {
      // Only count once per session — gates BOTH the local increment and the DB
      // write so re-renders (e.g. triggered by the ratings fetch) never double-count.
      window._viewedListings = window._viewedListings || new Set();
      if (!window._viewedListings.has(id)) {
        window._viewedListings.add(id);
        l.views = (l.views || 0) + 1;
        H.saveState();
        (function() {
          const _sb = window.supabase;
          if (_sb && typeof _sb.rpc === 'function') {
            _sb.rpc('increment_listing_view', { listing_id: id }).then(function(res) {
              if (res && res.data && typeof res.data.views === 'number') {
                l.views = res.data.views;
                H.saveState();
              }
            }).catch(function(){});
          }
        })();
      }
    }

    // Condition label + colour
    const COND_LABEL = { 'new':'New', 'like-new':'Like New', 'used':'Used', 'refurbished':'Refurbished' };
    const condRaw  = l.condition || (l.attrs && l.attrs.condition) || '';
    const condText = COND_LABEL[condRaw] || '';
    const condGood = condRaw === 'new' || condRaw === 'like-new';

    // Location string
    const locStr = H.escHtml(([l.suburb, l.city, l.prov].filter(Boolean)[0] || ''));

    // Seller stats
    const sellerListings = (H.state.listings||[]).filter(x => x.sellerId === seller.id && x.status === 'active').length;
    const ratings        = (H.state.ratings && H.state.ratings[seller.id]) || [];
    const avgRating      = ratings.length ? (ratings.reduce((s,r) => s + r.rating, 0) / ratings.length).toFixed(1) : '—';

    // Photo HTML
    const photoHtml = photos.length
      ? `<img src="${photos[0]}" id="dPhotoImg" data-photos="${H.escHtml(JSON.stringify(photos))}" onclick="H.openPhotoViewer(JSON.parse(this.dataset.photos),0)" style="cursor:zoom-in;position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
      : `<div class="ph">${H.categoryIcon(l.cat)}</div>`;

    // Rate-seller section (buyer only, SVG stars)
    let rateSection = '';
    if (u && u.id !== seller.id) {
      const myRating = ratings.find(r => r.userId === u.id);
      const avgLine  = ratings.length ? `<div style="font-size:11px;color:#71717A;margin-bottom:8px">${avgRating} avg · ${ratings.length} rating${ratings.length===1?'':'s'}</div>` : '';
      const stars    = [1,2,3,4,5].map(n => {
        const on = myRating && myRating.rating >= n;
        return `<button onclick="H._rateSeller('${seller.id}',${n},'${l.id}')" style="background:none;border:none;cursor:pointer;padding:2px;flex-shrink:0;line-height:1"><svg viewBox="0 0 24 24" width="28" height="28" fill="${on?'#F5A623':'none'}" stroke="${on?'#F5A623':'#D4D4D8'}" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>`;
      }).join('');
      rateSection = `<div style="background:var(--card);padding:14px 16px;margin-bottom:8px"><div class="det-sec-title">Rate this Seller</div>${avgLine}<div style="display:flex;gap:2px;align-items:center">${stars}</div>${myRating?`<div style="font-size:11px;color:#71717A;margin-top:6px">Your rating: ${myRating.rating}/5</div>`:''}</div>`;
    }

    // Owner performance + actions
    let ownerSection = '';
    if (isMine) {
      ownerSection = `
        <div style="background:var(--card);padding:14px 16px;margin-bottom:8px">
          <div class="det-sec-title">Performance</div>
          <div class="det-perf-grid">
            <div class="det-perf-item"><div class="det-perf-val">${l.views||0}</div><div class="det-perf-label">Views</div></div>
            <div class="det-perf-item"><div class="det-perf-val">${l.saves||0}</div><div class="det-perf-label">Saves</div></div>
            <div class="det-perf-item"><div class="det-perf-val" style="color:var(--blue)">${l.messages||0}</div><div class="det-perf-label">Messages</div></div>
          </div>
          <div class="det-boost-banner">
            <svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <div style="flex:1"><div style="font-size:12px;font-weight:800;color:#92400E">Boost this ad</div><div style="font-size:11px;color:#B45309;margin-top:1px">Get 5× more views for $2/day</div></div>
            <button class="det-boost-btn" onclick="H.boostListing&&H.boostListing('${l.id}')">Boost</button>
          </div>
        </div>
        <div class="owner-actions">
          <button class="oa-btn oa-edit" onclick="H._myListings&&H._myListings.edit('${l.id}')">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>Edit Ad
          </button>
          <button class="oa-btn oa-sold" onclick="H._myListings&&H._myListings.markSold('${l.id}')">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Mark Sold
          </button>
          <button class="oa-btn oa-del" onclick="H._myListings&&H._myListings.del('${l.id}')">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Remove
          </button>
        </div>`;
    }

    // CTA bar
    const sellerPrivacy = seller.privacySettings || {};
    const msgDisabled   = sellerPrivacy.allowMessages === false;
    const cm            = l.contactMethod || 'chat';
    let ctaBar;
    if (isMine) {
      ctaBar = `<div class="det-cta-bar det-cta-owner"><span style="font-size:12px;color:#A1A1AA;font-weight:600">This is your listing</span></div>`;
    } else {
      const waBtn = `<button class="cta-wa-btn" onclick="H.openWA('${l.id}')" title="Chat on WhatsApp">${S.wa}</button>`;
      const callBtn = sellerPhone
        ? `<button class="cta-call-btn" onclick="H.callSeller('${H.escHtml(sellerPhone)}')" title="Call seller"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.13 12.6a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.07 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.05 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z"/></svg></button>`
        : '';
      const msgBtn = msgDisabled
        ? `<button class="cta-msg-btn" disabled style="opacity:.5;cursor:not-allowed"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Messaging Off</button>`
        : `<button class="cta-msg-btn" onclick="H.startChatWith('${seller.id}','${l.id}')"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Message Seller</button>`;
      ctaBar = cm === 'phone'
        ? `<div class="det-cta-bar">${callBtn}${waBtn}${msgBtn}</div>`
        : `<div class="det-cta-bar">${msgBtn}${waBtn}${callBtn}</div>`;
    }

    return `<div class="page active det-page">
      <div class="det-photo-wrap" id="dPhoto">
        ${photoHtml}
        <div class="det-photo-overlay"></div>
        ${photos.length > 1 ? `
          <div class="photo-dots">${photos.map((_,i)=>`<div class="pdot ${i===0?'on':''}" onclick="H.setPhoto('${l.id}',${i})"></div>`).join('')}</div>
          <div class="photo-counter" id="photoCount">1 / ${photos.length}</div>
        ` : ''}
        ${l.boost ? '<div class="feat-badge-abs">Featured</div>' : ''}
        <div class="det-topbar">
          <button class="det-icon-btn" onclick="H.goBack()" aria-label="Back">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="det-topbar-title">${H.escHtml(l.title)}</div>
          <button class="det-icon-btn" onclick="H.shareListing('${l.id}')" aria-label="Share">
            <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          <button class="det-icon-btn${saved?' saved':''}" data-save-id="${l.id}" onclick="H.toggleSave('${l.id}')" aria-label="${saved?'Unsave':'Save'}">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"${saved?' fill="#1A3A8F" stroke="#1A3A8F"':''}/></svg>
          </button>
        </div>
      </div>

      <div class="det-content">
        <div class="det-card">
          <div class="det-price-row">
            <div class="det-price">${H.escHtml(H.fmtPrice(l.price, l.currency))}</div>
            ${l.negotiable ? '<div class="nego-pill">Negotiable</div>' : ''}
          </div>
          <div class="det-listing-title">${H.escHtml(l.title)}</div>
          <div class="qf-row">
            ${condText ? `<div class="qf-chip${condGood?' qf-green':''}"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>${H.escHtml(condText)}</div>` : ''}
            ${locStr ? `<div class="qf-chip"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${locStr}</div>` : ''}
            <div class="qf-chip"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${H.timeAgo(l.createdAt)}</div>
            <div class="qf-chip qf-blue"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${l.views||0} views</div>
          </div>
        </div>

        ${H.attrQuickFactsHtml ? H.attrQuickFactsHtml(l) : ''}
        ${H.attrOverviewHtml ? H.attrOverviewHtml(l) : ''}
        ${H._variationsHtml ? H._variationsHtml(l) : ''}

        <div class="det-desc-wrap">
          <div class="det-sec-title">Description</div>
          <div class="desc-text">${H.escHtml(l.desc||'No description provided.')}</div>
          <div style="font-size:11px;color:#71717A;margin-top:10px;display:flex;align-items:center;gap:4px">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#A1A1AA" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            Posted in <strong style="color:#3F3F46;margin-left:3px">${H.escHtml((l.cat||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))}</strong>
          </div>
        </div>

        ${H.attrAmenitiesHtml ? H.attrAmenitiesHtml(l) : ''}

        <div class="det-seller-section">
          <div class="seller-card" onclick="H.openUserProfile('${seller.id}')">
            <div style="position:relative;flex-shrink:0">
              <div class="seller-av">
                ${seller.avatar ? `<img src="${H.escHtml(seller.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : H.initials(sellerName)}
              </div>
              ${(seller.privacySettings && seller.privacySettings.showActivity) ? '<div class="seller-online-dot"></div>' : ''}
            </div>
            <div class="seller-body">
              <div class="seller-name-row">
                <div class="seller-name">${H.escHtml(sellerName)}</div>
                ${seller.verified ? `<div class="verified-badge-det"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Verified</div>` : ''}
              </div>
              <div class="seller-meta">Member since ${new Date(seller.joinedAt||Date.now()).getFullYear()}${seller.verified?' · ID Verified':''}</div>
            </div>
            <div class="seller-profile-btn"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div>
          </div>
          <div class="seller-stats">
            <div class="seller-stat"><div class="ss-val">${sellerListings||'—'}</div><div class="ss-label">Listings</div></div>
            <div class="seller-stat"><div class="ss-val">${avgRating}</div><div class="ss-label">Rating</div></div>
            <div class="seller-stat"><div class="ss-val">${ratings.length||'—'}</div><div class="ss-label">Reviews</div></div>
          </div>
        </div>

        ${!isMine ? `<div class="safety-tip">
          <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div class="safety-tip-text">Never pay in advance or transfer money before seeing the item. Meet in a public place and inspect before purchasing.</div>
        </div>` : ''}

        ${ownerSection}
        ${rateSection}

        <div style="background:#F5F5F7;padding-top:4px" id="similarListingsPlaceholder"></div>
      </div>

      ${ctaBar}
    </div>`;
  };

  H.pages.Detail_after = function(params) {
    H._initSwipe();

    H._rateSeller = function(sellerId, rating, listingId) {
      const u = H.currentUser();
      if (!u) { H.toast('Sign in to rate sellers'); return; }
      if (!H.state.ratings) H.state.ratings = {};
      if (!H.state.ratings[sellerId]) H.state.ratings[sellerId] = [];
      H.state.ratings[sellerId] = H.state.ratings[sellerId].filter(r => r.userId !== u.id);
      H.state.ratings[sellerId].push({ userId: u.id, rating: rating, at: Date.now() });
      H.saveState();
      H.toast('Thanks for your rating!');
      H.openInner('Detail', { id: listingId || params.id });
      const _sb = window.supabase;
      if (_sb && typeof _sb.from === 'function') {
        // Omit 'text' so an existing written review is preserved on rating change.
        // PostgREST only updates the columns present in the payload on conflict.
        _sb.from('reviews').upsert({
          seller_id: sellerId, reviewer_id: u.id,
          reviewer_name: u.name || 'User', rating: rating
        }, { onConflict: 'seller_id,reviewer_id' }).then(function(res) {
          if (res && res.error) console.warn('Rating DB sync failed:', res.error.message);
        });
      }
    };

    const l = H.state.listings.find(x => x.id === params.id);
    const placeholder = document.getElementById('similarListingsPlaceholder');
    if (!l) {
      if (placeholder) placeholder.remove();
      // Listing isn't in the local cache (stale after idle, deleted-from-cache,
      // or older than the cached set). Fetch it by id once before giving up, so
      // tapping a listing never dead-ends on "Listing not found".
      if (H._detailFetchFailed === params.id) return;   // already tried — not-found shown
      if (H._detailFetchTrying === params.id) return;   // fetch in flight
      if (typeof H._fetchListingById !== 'function') { H._detailFetchFailed = params.id; return; }
      H._detailFetchTrying = params.id;
      H._fetchListingById(params.id).then(function (found) {
        H._detailFetchTrying = null;
        if (found) H._detailFetchFailed = null; else H._detailFetchFailed = params.id;
        // Only act if the user is still looking at this listing.
        if (H.currentPageName !== 'Detail' || !H.currentPageParams || H.currentPageParams.id !== params.id) return;
        if (found && found.cat === 'jobs') { H.openInner('JobDetail', { id: params.id }); return; }
        H.renderPage('Detail', params);
      });
      return;
    }
    // Reaching a valid listing clears any stale not-found marker.
    if (H._detailFetchFailed === params.id) H._detailFetchFailed = null;

    // Fetch ratings from Supabase once per seller per session so the star display
    // is never stuck on stale local state. Re-renders only when data changed.
    (function() {
      const _sb = window.supabase;
      const _sellerId = l.sellerId || l.seller_id;
      if (!_sb || !_sellerId) return;
      H._ratingsFetched = H._ratingsFetched || {};
      const _lastRF = H._ratingsFetched[_sellerId];
      if (_lastRF && (Date.now() - _lastRF) < 120000) return;
      H._ratingsFetched[_sellerId] = Date.now();
      _sb.from('reviews').select('reviewer_id,rating,created_at').eq('seller_id', _sellerId)
        .then(function(res) {
          if (!res || !res.data) return;
          H.state.ratings = H.state.ratings || {};
          H.state.ratings[_sellerId] = res.data.map(function(r) {
            return { userId: r.reviewer_id, rating: r.rating, at: new Date(r.created_at).getTime() };
          });
          H.saveState();
          if (H.currentPageName === 'Detail' && H.currentPageParams && H.currentPageParams.id === params.id) {
            H.renderPage('Detail', params);
          }
        }).catch(function(){});
    })();

    const similar = (H.state.listings||[]).filter(x => x.id!==l.id && x.cat===l.cat && x.status==='active').slice(0,4);
    // Recently viewed (tracked in localStorage by openListing) — skip the current
    // listing and anything already shown under "Similar".
    let rv = [];
    try { rv = JSON.parse(localStorage.getItem('pamarket_rv') || '[]'); } catch (e) {}
    const simIds = similar.map(function(s){ return s.id; });
    const recent = rv.filter(function(id){ return id !== l.id && simIds.indexOf(id) === -1; })
      .map(function(id){ return (H.state.listings||[]).find(function(x){ return x.id === id; }); })
      .filter(function(x){ return x && x.status === 'active'; })
      .slice(0, 4);
    function simCardHtml(s) {
      const thumb = s.photos && s.photos[0]
        ? `<img src="${H.escHtml(s.photos[0])}" style="width:100%;height:100%;object-fit:cover">`
        : `<div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:.35">${H.categoryIcon(s.cat)}</div>`;
      return `<div class="sim-card" onclick="H.openListing('${s.id}')">
        <div class="sim-img">${thumb}</div>
        <div class="sim-body">
          <div class="sim-price">${H.escHtml(H.fmtPrice(s.price,s.currency))}</div>
          <div class="sim-title">${H.escHtml(s.title)}</div>
        </div>
      </div>`;
    }
    let html = '';
    if (similar.length) html += `<div style="padding:12px 16px 6px;display:flex;align-items:center;justify-content:space-between"><span style="font-size:14px;font-weight:800;color:#18181B;letter-spacing:-.2px">Similar Listings</span></div><div class="det-similar-scroll">${similar.map(simCardHtml).join('')}</div>`;
    if (recent.length)  html += `<div style="padding:12px 16px 6px;display:flex;align-items:center;justify-content:space-between"><span style="font-size:14px;font-weight:800;color:#18181B;letter-spacing:-.2px">Recently Viewed</span></div><div class="det-similar-scroll">${recent.map(simCardHtml).join('')}</div>`;
    if (!html) { if (placeholder) placeholder.remove(); return; }
    const sec = document.createElement('div');
    sec.style.background = '#F5F5F7';
    sec.style.paddingBottom = '8px';
    sec.innerHTML = html;
    if (placeholder) {
      placeholder.replaceWith(sec);
    } else {
      const det = document.querySelector('.det-content');
      if (det) det.appendChild(sec);
    }
  };

  H._initSwipe = function() {
    const el = document.getElementById('dPhoto'); if (!el) return;
    let sx = 0;
    el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, {passive:true});
    el.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) < 40) return;
      const dots = document.querySelectorAll('.pdot');
      if (!dots.length) return;
      const cur  = Array.from(dots).findIndex(d => d.classList.contains('on'));
      const next = dx < 0 ? Math.min(cur+1, dots.length-1) : Math.max(cur-1, 0);
      const m = el.querySelector('[onclick*="setPhoto"]');
      if (m) { const match = m.getAttribute('onclick').match(/'([^']+)'/); if (match) H.setPhoto(match[1], next); }
    }, {passive:true});
  };

  H.setPhoto = function(id, i) {
    const l = H.state.listings.find(x => x.id === id);
    if (!l || !l.photos[i]) return;
    const img = document.getElementById('dPhotoImg');
    if (img) img.src = l.photos[i];
    document.querySelectorAll('.pdot').forEach((d,j) => d.classList.toggle('on', j===i));
    const cnt = document.getElementById('photoCount');
    if (cnt) cnt.textContent = (i+1)+' / '+l.photos.length;
  };

  H.shareListing = function(id) {
    const l = H.state.listings.find(x => x.id === id); if (!l) return;
    const text = l.title+' · '+H.fmtPrice(l.price, l.currency)+' on PaMarket Zimbabwe';
    if (navigator.share) navigator.share({title:l.title, text, url:location.href}).catch(()=>{});
    else { if (navigator.clipboard) navigator.clipboard.writeText(text+' '+location.href).catch(()=>{}); H.toast('Link copied'); }
  };

  H.toggleSave = function(id, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to save listings'); return; }
    H.state.saves[u.id] = H.state.saves[u.id] || [];
    const i = H.state.saves[u.id].indexOf(id);
    const removing = i >= 0;
    if (removing) {
      H.state.saves[u.id].splice(i, 1);
      H.toast('Removed from saved');
    } else {
      H.state.saves[u.id].push(id);
      H.toast('Saved!');
      if (!H.state.savedPrices) H.state.savedPrices = {};
      var listing = (H.state.listings || []).find(function(l) { return l.id === id; });
      if (listing) H.state.savedPrices[id] = listing.price;
    }
    H.saveState();

    // Update every heart button for this listing in the DOM — no full re-render.
    var nowSaved = !removing;
    document.querySelectorAll('[data-save-id="' + id + '"]').forEach(function(btn) {
      var svg = btn.querySelector('svg path, svg > path');
      if (svg) {
        svg.setAttribute('fill', nowSaved ? '#1A3A8F' : 'none');
        svg.setAttribute('stroke', nowSaved ? '#1A3A8F' : 'currentColor');
      }
      if (nowSaved) btn.classList.add('saved'); else btn.classList.remove('saved');
      btn.setAttribute('aria-label', nowSaved ? 'Unsave' : 'Save');
    });

    // Use security-definer RPCs — auth.uid() is resolved server-side so
    // there is no risk of a client-side session/state mismatch causing RLS
    // to reject the request with a 401.
    var _sb = window.supabase;
    if (_sb && typeof _sb.rpc === 'function') {
      if (removing) {
        _sb.rpc('unsave_listing', { p_listing_id: id })
          .then(function(res) { if (res && res.error) console.warn('Save sync failed:', res.error.message); });
      } else {
        _sb.rpc('save_listing', { p_listing_id: id })
          .then(function(res) { if (res && res.error) console.warn('Save sync failed:', res.error.message); });
      }
    }
  };

  H.deleteListing = function(id) {
    H.modal({
      title:'Delete this listing?', body:'This cannot be undone.', confirmText:'Delete', danger:true,
      onConfirm: async () => {
        var sc = window.supabase;
        // Only attempt a cloud delete when a real Supabase client is available
        // (the mock fallback has no .auth). Otherwise just remove it locally.
        if (sc && sc.auth && typeof sc.from === 'function') {
          try {
            var res = await sc.from('listings').delete().eq('id', id).select();
            if (res && res.error) {
              H.toast('Could not delete: ' + (res.error.message || 'permission denied'));
              return;
            }
            if (!res.data || res.data.length === 0) {
              // Nothing deleted in the cloud — likely a local-only listing that
              // never synced. Fall through and remove it locally.
            }
          } catch (e) {
            H.toast('Network error — try again');
            return;
          }
        }
        if (typeof H.markPendingDelete === 'function') H.markPendingDelete(id);
        H.state.listings = (H.state.listings || []).filter(l => l.id !== id);
        H.saveState();
        H.toast('Listing deleted');
        H.goBack();
      }
    });
  };

  H.openWA = function(id) {
    const l = H.state.listings.find(x => x.id === id); if (!l) return;
    const seller = getSeller(l);
    const phone  = (seller.phone||l.sellerPhone||'').replace(/[^\d+]/g,'');
    if (!phone) { H.toast('No WhatsApp number available'); return; }
    const txt = encodeURIComponent('Hi! I saw your "'+l.title+'" listing on PaMarket Zimbabwe. Is it still available?');
    if (typeof H.recordLead === 'function') H.recordLead(id, 'whatsapp');
    window.open('https://wa.me/'+phone.replace('+','')+'?text='+txt, '_blank');
  };

  H.callSeller = function(phone) {
    if (!phone || phone.trim()==='') { H.toast('No phone number available'); return; }
    const clean = phone.replace(/\s+/g,'');
    if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      location.href = 'tel:'+clean;
    } else {
      if (navigator.clipboard) navigator.clipboard.writeText(clean).catch(()=>{});
      H.toast('Number copied: '+clean);
    }
  };

  H.startChatWith = function(sellerId, listingId) {
    if (!H.currentUser()) { H.requireAuth('Sign in to message sellers'); return; }
    const u = H.currentUser();
    if (!sellerId || sellerId === u.id) { H.toast('You cannot message yourself'); return; }
    if (listingId && typeof H.recordLead === 'function') H.recordLead(listingId, 'chat');
    if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
    const ids = [u.id, sellerId].sort();
    // One conversation per person (listing kept as context, not in the id) and
    // reuse any existing thread with this seller so profile and listing entry
    // points never fork into separate threads.
    let convId = 'conv_' + H.idFrag(ids[0]) + '_' + H.idFrag(ids[1]);
    const _pair = H.state.conversations.find(function (c) {
      return c && Array.isArray(c.members) && c.members.length === 2 &&
             c.members.map(String).indexOf(String(u.id)) !== -1 &&
             c.members.map(String).indexOf(String(sellerId)) !== -1 &&
             String(c.id).indexOf('job_') !== 0;
    });
    if (_pair) convId = _pair.id;
    let conv = H.state.conversations.find(c => c.id === convId);
    if (!conv) {
      conv = { id: convId, members: [u.id, sellerId], listingId: listingId || null, messages: [] };
      H.state.conversations.push(conv);
      H.saveState();
      if (typeof H.ensureConversationInCloud === 'function') H.ensureConversationInCloud(conv);
    }
    H.openInner('Chat', { id: convId });
  };

  H.reportListing = function(id) {
    if (!H.currentUser()) { H.requireAuth('Sign in to report'); return; }
    const reasons = ['Scam or fraud','Counterfeit or fake item','Wrong category','Prohibited item','Offensive content','Duplicate listing','Other'];
    H.modal({
      title:'Report this listing',
      body:`<select class="fi" id="reportReason" style="width:100%;margin-bottom:8px">${reasons.map(r=>`<option>${r}</option>`).join('')}</select>
            <textarea class="fi" id="reportNote" rows="3" placeholder="Tell us more (optional)" style="width:100%;margin-top:4px"></textarea>`,
      confirmText:'Submit Report',
      onConfirm:() => {
        const cu = H.currentUser(); if (!cu) { H.requireAuth('Sign in to report'); return; }
        const reason = document.getElementById('reportReason')?.value||'';
        const note   = document.getElementById('reportNote')?.value||'';
        H.state.reports = H.state.reports||[];
        H.state.reports.push({id:H.uid(), reporterId:cu.id, targetType:'listing', targetId:id, reason:reason+(note?' - '+note:''), t:Date.now(), status:'open'});
        H.saveState();
        var _sb = window.supabase;
        if (_sb) _sb.from('reports').insert({id:H.uid(), target_type:'listing', target_id:id, reason:reason+(note?' - '+note:''), reporter_id:String(cu.id), status:'open'}).then(function(r){ if(r&&r.error) console.warn('report save:',r.error.message); });
        H.toast('Report submitted. Thank you.');
      }
    });
  };

  H.reportUser = function(id) {
    if (!H.currentUser()) { H.requireAuth('Sign in to report'); return; }
    const reasons = ['Scammer or fraudster','Harassment','Spam','Fake account','Impersonation','Other'];
    H.modal({
      title:'Report this user',
      body:`<select class="fi" id="reportReason" style="width:100%;margin-bottom:8px">${reasons.map(r=>`<option>${r}</option>`).join('')}</select>
            <textarea class="fi" id="reportNote" rows="3" placeholder="More details (optional)" style="width:100%;margin-top:4px"></textarea>`,
      confirmText:'Submit Report',
      onConfirm:() => {
        const cu = H.currentUser(); if (!cu) { H.requireAuth('Sign in to report'); return; }
        const reason = document.getElementById('reportReason')?.value||'';
        const note   = document.getElementById('reportNote')?.value||'';
        H.state.reports = H.state.reports||[];
        H.state.reports.push({id:H.uid(), reporterId:cu.id, targetType:'user', targetId:id, reason:reason+(note?' - '+note:''), t:Date.now(), status:'open'});
        H.saveState();
        var _sb = window.supabase;
        if (_sb) _sb.from('reports').insert({id:H.uid(), target_type:'user', target_id:id, reason:reason+(note?' - '+note:''), reporter_id:String(cu.id), status:'open'}).then(function(r){ if(r&&r.error) console.warn('report save:',r.error.message); });
        H.toast('Report submitted');
      }
    });
  };

  function pvHTML(photos, idx) {
    var dots = '';
    if (photos.length > 1) {
      dots = '<div style="position:absolute;bottom:calc(env(safe-area-inset-bottom,0px)+22px);left:0;right:0;display:flex;gap:8px;justify-content:center;z-index:2">';
      for (var di = 0; di < photos.length; di++) {
        dots += '<div data-dot="'+di+'" onclick="H._pvGoTo('+di+')" style="width:8px;height:8px;border-radius:50%;background:'+(di===idx?'#fff':'rgba(255,255,255,.35)')+';cursor:pointer;transition:background .2s"></div>';
      }
      dots += '</div>';
    }
    return '<div id="pvHeader" style="position:absolute;top:0;left:0;right:0;padding:calc(max(env(safe-area-inset-top,0px), 24px) + 20px) 14px 18px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(rgba(0,0,0,.7),transparent);z-index:10">'
      + '<span id="pvCounter" style="color:#fff;font-size:14px;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,.6)">'+(idx+1)+' / '+photos.length+'</span>'
      + '<button id="pvClose" onclick="H.closePhotoViewer()" ontouchend="event.preventDefault();H.closePhotoViewer()" style="background:rgba(0,0,0,.55);border:none;border-radius:50%;width:46px;height:46px;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" width="22" height="22"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      + '</button></div>'
      + '<img id="pvImg" src="'+photos[idx]+'" style="position:absolute;top:50%;left:50%;max-width:100%;max-height:100%;object-fit:contain;will-change:transform;pointer-events:none;-webkit-user-drag:none;user-select:none" draggable="false">'
      + dots;
  }

  function pvApply() {
    var pv = H._pv; if (!pv) return;
    var img = document.getElementById('pvImg'); if (!img) return;
    img.style.transform = 'translate(calc(-50% + '+pv.tx+'px), calc(-50% + '+pv.ty+'px)) scale('+pv.scale+')';
  }

  function pvClamp() {
    var pv = H._pv; if (!pv) return;
    if (pv.scale <= 1) { pv.tx = 0; pv.ty = 0; return; }
    var img = document.getElementById('pvImg'); if (!img) return;
    var ox = Math.max(0, img.offsetWidth  * pv.scale - window.innerWidth);
    var oy = Math.max(0, img.offsetHeight * pv.scale - window.innerHeight);
    pv.tx = Math.min(ox/2, Math.max(-ox/2, pv.tx));
    pv.ty = Math.min(oy/2, Math.max(-oy/2, pv.ty));
  }

  function pvDist(a, b) {
    var dx = b.clientX-a.clientX, dy = b.clientY-a.clientY;
    return Math.sqrt(dx*dx+dy*dy);
  }

  function pvTS(e) {
    var pv = H._pv; if (!pv) return;
    // Touches on the top bar (close button / counter) must not be hijacked by
    // the pan/zoom handler — let the native button tap fire normally.
    if (e.target && e.target.closest && e.target.closest('#pvHeader')) { pv.skipGesture = true; return; }
    pv.skipGesture = false;
    e.preventDefault();
    var ts = e.touches;
    pv.moved = false;
    if (ts.length === 1) {
      pv.x0 = ts[0].clientX; pv.y0 = ts[0].clientY;
      pv.txAtStart = pv.tx; pv.tyAtStart = pv.ty;
      pv.pinch = false;
      var now = Date.now();
      if (now - pv.lastTap < 300) { pvDoubleTap(ts[0].clientX, ts[0].clientY); pv.lastTap = 0; }
      else pv.lastTap = now;
    } else if (ts.length >= 2) {
      pv.pinch = true;
      pv.pinchDist0 = pvDist(ts[0], ts[1]);
      pv.scaleAtPinch = pv.scale;
      pv.x0 = (ts[0].clientX+ts[1].clientX)/2;
      pv.y0 = (ts[0].clientY+ts[1].clientY)/2;
      pv.txAtStart = pv.tx; pv.tyAtStart = pv.ty;
    }
  }

  function pvTM(e) {
    var pv = H._pv; if (!pv || pv.skipGesture) return;
    e.preventDefault();
    var ts = e.touches;
    if (ts.length === 1 && !pv.pinch) {
      var dx = ts[0].clientX - pv.x0;
      var dy = ts[0].clientY - pv.y0;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) pv.moved = true;
      if (pv.scale > 1) {
        pv.tx = pv.txAtStart + dx;
        pv.ty = pv.tyAtStart + dy;
        pvClamp(); pvApply();
      }
    } else if (ts.length >= 2) {
      var dist = pvDist(ts[0], ts[1]);
      pv.scale = Math.min(4, Math.max(1, pv.scaleAtPinch * (dist / pv.pinchDist0)));
      var mx = (ts[0].clientX+ts[1].clientX)/2;
      var my = (ts[0].clientY+ts[1].clientY)/2;
      pv.tx = pv.txAtStart + (mx - pv.x0);
      pv.ty = pv.tyAtStart + (my - pv.y0);
      pv.moved = true;
      pvClamp(); pvApply();
    }
  }

  function pvTE(e) {
    var pv = H._pv; if (!pv) return;
    if (pv.skipGesture) { if (e.touches.length === 0) pv.skipGesture = false; return; }
    if (e.touches.length === 0) {
      if (!pv.pinch && pv.scale <= 1 && pv.moved) {
        var dx = e.changedTouches[0].clientX - pv.x0;
        var dy = e.changedTouches[0].clientY - pv.y0;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) pvNavDir(dx < 0 ? 1 : -1);
      }
      if (pv.scale < 1) { pv.scale = 1; pv.tx = 0; pv.ty = 0; pvApply(); }
      pv.pinch = false;
    } else if (e.touches.length === 1) {
      pv.pinch = false;
      pv.x0 = e.touches[0].clientX; pv.y0 = e.touches[0].clientY;
      pv.txAtStart = pv.tx; pv.tyAtStart = pv.ty;
    }
  }

  function pvDoubleTap(x, y) {
    var pv = H._pv; if (!pv) return;
    var img = document.getElementById('pvImg'); if (!img) return;
    img.style.transition = 'transform .25s ease';
    if (pv.scale > 1) {
      pv.scale = 1; pv.tx = 0; pv.ty = 0;
    } else {
      pv.scale = 2.5;
      pv.tx = (x - window.innerWidth/2)  * (1 - pv.scale);
      pv.ty = (y - window.innerHeight/2) * (1 - pv.scale);
      pvClamp();
    }
    pvApply();
    setTimeout(function(){ var i=document.getElementById('pvImg'); if(i) i.style.transition=''; }, 280);
  }

  function pvNavDir(dir) {
    var pv = H._pv; if (!pv) return;
    var ni = pv.idx + dir;
    if (ni < 0 || ni >= pv.photos.length) return;
    pv.idx = ni; pv.scale = 1; pv.tx = 0; pv.ty = 0;
    var img = document.getElementById('pvImg');
    if (img) {
      img.style.transition = 'opacity .1s';
      img.style.opacity = '0';
      setTimeout(function(){
        img.src = pv.photos[pv.idx];
        img.style.opacity = '1';
        setTimeout(function(){ img.style.transition = ''; }, 120);
      }, 80);
    }
    var cnt = document.getElementById('pvCounter');
    if (cnt) cnt.textContent = (pv.idx+1)+' / '+pv.photos.length;
    document.querySelectorAll('[data-dot]').forEach(function(d){
      d.style.background = parseInt(d.getAttribute('data-dot'))===pv.idx ? '#fff' : 'rgba(255,255,255,.35)';
    });
    pvApply();
  }

  H.openPhotoViewer = function(photos, startIdx) {
    if (!photos || !photos.length) return;
    var existing = document.getElementById('pvOverlay');
    if (existing) existing.remove();
    H._pv = { photos:photos, idx:startIdx||0, scale:1, tx:0, ty:0,
               pinch:false, x0:0, y0:0, txAtStart:0, tyAtStart:0,
               pinchDist0:0, scaleAtPinch:1, moved:false, lastTap:0 };
    var ov = document.createElement('div');
    ov.id = 'pvOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000;overflow:hidden';
    ov.innerHTML = pvHTML(photos, H._pv.idx);
    document.body.appendChild(ov);
    ov.addEventListener('touchstart', pvTS, {passive:false});
    ov.addEventListener('touchmove',  pvTM, {passive:false});
    ov.addEventListener('touchend',   pvTE, {passive:false});
    H._pv.keyHandler = function(e) {
      if (!H._pv) return;
      if (e.key==='ArrowRight') pvNavDir(1);
      if (e.key==='ArrowLeft')  pvNavDir(-1);
      if (e.key==='Escape')     H.closePhotoViewer();
    };
    document.addEventListener('keydown', H._pv.keyHandler);
    pvApply();
  };

  H.closePhotoViewer = function() {
    var ov = document.getElementById('pvOverlay');
    if (ov) {
      ov.removeEventListener('touchstart', pvTS);
      ov.removeEventListener('touchmove',  pvTM);
      ov.removeEventListener('touchend',   pvTE);
      ov.remove();
    }
    if (H._pv && H._pv.keyHandler) document.removeEventListener('keydown', H._pv.keyHandler);
    H._pv = null;
  };

  H._pvNav   = pvNavDir;
  H._pvGoTo  = function(i) {
    var pv = H._pv; if (!pv) return;
    pv.idx = i; pv.scale = 1; pv.tx = 0; pv.ty = 0;
    var img = document.getElementById('pvImg');
    if (img) img.src = pv.photos[i];
    var cnt = document.getElementById('pvCounter');
    if (cnt) cnt.textContent = (i+1)+' / '+pv.photos.length;
    document.querySelectorAll('[data-dot]').forEach(function(d){
      d.style.background = parseInt(d.getAttribute('data-dot'))===i ? '#fff' : 'rgba(255,255,255,.35)';
    });
    pvApply();
  };

  H.openListing = window.openListing = function(id) {
    const l = (H.state.listings||[]).find(x => x.id === id);
    if (l) {
      if (l.cat === 'jobs') { l.views=(l.views||0)+1; H.saveState(); H.openInner('JobDetail',{id}); return; }
      H.openInner('Detail', {id});
      return;
    }
    // Not in the local cache (e.g. dropped after the app sat idle, or older than
    // the cached set). Open Detail anyway — it fetches the listing by id on demand
    // instead of dead-ending on "Listing not found".
    H.openInner('Detail', {id});
  };

  H.openUserProfile = function(id) {
    if (!id) { H.toast('Profile not available'); return; }
    H.openInner('UserProfile', {id: String(id)});
  };

  H.pages.UserProfile = function(params) {
    const id = params && params.id ? String(params.id) : null;
    if (!id) return '<div class="page active">'+H.innerTopbar('User')+'<div class="empty-state"><div class="empty-title">User not found</div></div></div>';

    let u = (H.state.users||[]).find(x => String(x.id)===id);
    if (!u) {
      const listing = (H.state.listings||[]).find(l => String(l.sellerId)===id);
      if (listing) {
        u = {id, name:listing.sellerName||'Seller', phone:listing.sellerPhone||'', verified:false, joinedAt:listing.createdAt||Date.now(), avatar:null};
      } else {
        return '<div class="page active">'+H.innerTopbar('User')+'<div class="empty-state"><div class="empty-title">User not found</div></div></div>';
      }
    }

    const myListings = (H.state.listings||[]).filter(l => String(l.sellerId)===id && l.status==='active');
    const me   = H.currentUser();
    const isMe = !!(me && String(me.id)===id);

    // profilePublic check — only applies when viewing another user's profile
    const uPrivacy = u.privacySettings || {};
    if (!isMe && uPrivacy.profilePublic === false) {
      // Show a stripped-down private profile screen
      return `<div class="page active">
        <div class="det-topbar">
          <button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>
          <div class="det-topbar-title">${H.escHtml(u.name)}</div>
          <div style="width:40px"></div>
        </div>
        <div class="prof-top" style="text-align:center;padding:32px 20px">
          <div class="prof-av" style="background:#1A3A8F;color:#fff;font-weight:700;font-size:22px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
            ${u.avatar ? `<img src="${H.escHtml(u.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : H.initials(u.name)}
          </div>
          <div class="prof-name">${H.escHtml(u.name)}</div>
          <div style="display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:7px 16px;background:rgba(255,255,255,0.12);border-radius:20px;border:1px solid rgba(255,255,255,0.25)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.85)">Private Profile</span>
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:10px">This user has set their profile to private</div>
        </div>
      </div>`;
    }

    // showActivity dot for the profile avatar
    const showDot = uPrivacy.showActivity === true;

    return `<div class="page active">
      <div class="det-topbar">
        <button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="det-topbar-title">${H.escHtml(u.name)}</div>
        ${!isMe ? `<button class="share-btn" onclick="H.reportUser('${u.id}')" title="Report user">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="4" y1="22" x2="4" y2="15"/><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/></svg>
        </button>` : '<div style="width:40px"></div>'}
      </div>

      <div class="prof-top">
        <div style="position:relative;display:inline-block;margin-bottom:0">
          <div class="prof-av" style="background:#1A3A8F;color:#fff;font-weight:700;font-size:22px;display:flex;align-items:center;justify-content:center">
            ${u.avatar ? `<img src="${H.escHtml(u.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : H.initials(u.name)}
          </div>
          ${showDot ? `<div style="position:absolute;bottom:3px;right:3px;width:13px;height:13px;border-radius:50%;background:#22c55e;border:2.5px solid #1A3A8F"></div>` : ''}
        </div>
        <div class="prof-name">${H.escHtml(u.name)}</div>
        ${showDot ? `<div style="font-size:11px;color:#86efac;font-weight:600;display:flex;align-items:center;gap:4px;justify-content:center;margin-top:4px"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e"></span>Online</div>` : ''}
        ${u.phone ? `<div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px">${H.escHtml(u.phone)}</div>` : ''}
        ${u.verified ? `<div class="prof-badges"><span class="pbadge pbadge-verified">${H.verifiedBadge(13)} ID Verified</span></div>` : ''}
        <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:8px">Member since ${new Date(u.joinedAt||Date.now()).toLocaleDateString()}</div>
        ${!isMe && me ? `<div class="prof-actions">
          ${(uPrivacy.allowMessages === false)
            ? `<button class="pa-btn pa-disabled" disabled>
                 <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                 Messaging off</button>`
            : `<button class="pa-btn pa-primary" onclick="H.startChatWith('${u.id}','')">
                 <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                 Message ${H.escHtml((u.name||'').split(' ')[0] || '')}</button>`}
          <div class="prof-actions-row">
            ${u.phone ? `<button class="pa-btn pa-glass" onclick="H.callSeller('${H.escHtml(u.phone)}')">
                 <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                 Call</button>` : ''}
            <button class="pa-btn pa-gold" onclick="H.leaveReview('${u.id}')">
                 <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z"/></svg>
                 Review</button>
          </div>
        </div>` : ''}
      </div>

      <div class="sec-head">
        <div class="sec-title">${myListings.length} active listing${myListings.length===1?'':'s'}</div>
        ${!isMe ? `<button onclick="H.openInner('Reviews',{id:'${u.id}'})" style="background:none;border:none;color:#1A3A8F;font-size:12px;font-weight:700;cursor:pointer;padding:0">See Reviews →</button>` : ''}
      </div>
      <div class="listing-list">
        ${myListings.length ? myListings.map(H.renderListCard).join('') : H.emptyState('No listings','This seller has no active listings',null,null)}
      </div>
    </div>`;
  };

  H.pages.SellerProfile = H.pages.UserProfile;

  // Boost listing (H.boostListing / H._buyBoost) now lives in www/js/billing.js
  // — Google Play Billing consumable purchase flow, replacing the old
  // wallet_usd-funded apply_listing_boost RPC. billing.js must load after
  // this file for H.boostListing to be the Play Billing version.

})(window.H);
