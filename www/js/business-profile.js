/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 *
 * MODULE 2 — BUSINESS PROFILES
 * Builds on the `businesses` row from Module 1:
 *   • BusinessEditProfile — owner/staff edit identity, media, contact, location
 *   • BusinessStaff        — invite / role / remove staff (plan-gated count)
 *   • BusinessProfile      — public read-only profile (ACTIVE businesses only)
 * Media reuses H.uploadListingPhotos (public bucket); cloud writes via the
 * Module 1 helpers (H.saveBusinessToCloud). Degrades to local-only gracefully.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const escHtml     = (s) => H.escHtml(s);
  const toast       = (...a) => H.toast(...a);
  const currentUser = () => H.currentUser();
  const innerTopbar = (...a) => H.innerTopbar(...a);
  const saveState   = () => H.saveState();
  const renderPage  = (...a) => H.renderPage(...a);

  // Staff seats per plan — ties Profiles to the monetization layer.
  const STAFF_LIMIT = { free: 0, starter: 2, pro: 10, premium: Infinity };

  function getBiz(id) { return (H.state.businesses || []).find(b => b.id === id) || null; }
  function staffMap() { H.state.businessStaff = H.state.businessStaff || {}; return H.state.businessStaff; }
  function staffOf(id) { return staffMap()[id] || []; }
  function canEdit(b) {
    const u = currentUser(); if (!u || !b) return false;
    if (b.ownerUserId === u.id) return true;
    return staffOf(b.id).some(s => s.userId === u.id && s.status === 'active');
  }
  function isOwner(b) { const u = currentUser(); return !!(u && b && b.ownerUserId === u.id); }

  // ── Cloud: staff ─────────────────────────────────────────────
  H.fetchBusinessStaff = async function (businessId) {
    const sb = window.supabase;
    if (!sb || !businessId) return staffOf(businessId);
    try {
      const { data, error } = await sb.from('business_staff').select('*').eq('business_id', businessId);
      if (error || !Array.isArray(data)) return staffOf(businessId);
      const rows = data.map(r => ({
        id: r.id, businessId: r.business_id, userId: r.user_id, role: r.role,
        status: r.status, invitedBy: r.invited_by, createdAt: new Date(r.created_at || Date.now()).getTime()
      }));
      staffMap()[businessId] = rows; saveState();
      return rows;
    } catch (e) { console.warn('fetchBusinessStaff:', e); return staffOf(businessId); }
  };

  async function cloudFindUserByContact(q) {
    const sb = window.supabase;
    if (!sb) return null;
    try {
      const { data } = await sb.from('profiles').select('id,name,phone,email')
        .or(`phone.eq.${q},email.eq.${q}`).limit(1);
      return (data && data[0]) || null;
    } catch (e) { return null; }
  }

  // ── PAGE: Edit Profile ───────────────────────────────────────
  let _edit = null; // { id, name, description, bizType, phone, whatsapp, email, province, city, suburb, logo, cover }

  pages.BusinessEditProfile = function (params) {
    const b = getBiz((params && params.id) || (_edit && _edit.id));
    if (!b) return `<div class="page active">${innerTopbar('Edit Business')}${H.emptyState('Business not found', 'Return to your account and try again.')}</div>`;
    if (!canEdit(b)) return `<div class="page active">${innerTopbar('Edit Business')}${H.emptyState('No access', 'Only the owner or staff can edit this business.')}</div>`;

    if (!_edit || _edit.id !== b.id) {
      _edit = {
        id: b.id, name: b.name || '', description: b.description || '', bizType: b.bizType || 'individual',
        phone: b.phone || '', whatsapp: b.whatsapp || '', email: b.email || '',
        province: b.province || '', city: b.city || '', suburb: b.suburb || '',
        logo: b.logo || null, cover: b.cover || null
      };
    }
    const e = _edit;
    const provOpts = ['<option value="">Select province</option>']
      .concat(H.PROVINCES.map(p => `<option value="${p}" ${e.province === p ? 'selected' : ''}>${p}</option>`)).join('');
    const cityOpts = ['<option value="">Select city / town</option>']
      .concat((H.CITIES_BY_PROV[e.province] || []).map(c => `<option value="${c}" ${e.city === c ? 'selected' : ''}>${c}</option>`)).join('');
    const typeBtn = (id, label) => `<button type="button" onclick="H._bizProfile.setType('${id}')"
      style="flex:1;padding:10px;border-radius:12px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;
      border:1.5px solid ${e.bizType === id ? '#1A3A8F' : 'var(--border,#E8ECF4)'};
      background:${e.bizType === id ? '#EEF2FB' : 'var(--card,#fff)'};color:${e.bizType === id ? '#1A3A8F' : 'var(--text)'}">${label}</button>`;
    const field = (label, inner) => `<div class="fg" style="margin-bottom:14px"><div class="fl">${label}</div>${inner}</div>`;

    const coverStyle = e.cover ? `background-image:url('${escHtml(e.cover)}');background-size:cover;background-position:center` : 'background:linear-gradient(135deg,#1A3A8F,#0f2460)';

    return `<div class="page active">
      ${innerTopbar('Edit Business')}
      <div class="inner-content" style="padding-bottom:40px">

        <!-- Cover + Logo -->
        <div style="position:relative;border-radius:16px;overflow:hidden;margin-bottom:54px">
          <div style="height:120px;${coverStyle}"></div>
          <button type="button" onclick="document.getElementById('bzCoverFile').click()"
            style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,.45);color:#fff;border:none;border-radius:10px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Change cover</button>
          <div style="position:absolute;left:16px;bottom:-40px;width:80px;height:80px;border-radius:18px;border:3px solid var(--card,#fff);background:#EEF2FB;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:26px;font-weight:800;color:#1A3A8F">
            ${e.logo ? `<img src="${escHtml(e.logo)}" style="width:100%;height:100%;object-fit:cover">` : escHtml(H.initials(e.name || 'B'))}
          </div>
          <button type="button" onclick="document.getElementById('bzLogoFile').click()"
            style="position:absolute;left:86px;bottom:-34px;background:#EEF2FB;color:#1A3A8F;border:none;border-radius:10px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Change logo</button>
        </div>
        <input type="file" id="bzCoverFile" accept="image/*" style="display:none" onchange="H._bizProfile.onMedia(event,'cover')">
        <input type="file" id="bzLogoFile" accept="image/*" style="display:none" onchange="H._bizProfile.onMedia(event,'logo')">

        ${field('Business name', `<input class="fi" id="epName" maxlength="60" value="${escHtml(e.name)}">`)}
        ${field('Business type', `<div style="display:flex;gap:8px">${typeBtn('individual','Individual')}${typeBtn('company','Company')}${typeBtn('agency','Agency')}</div>`)}
        ${field('Description', `<textarea class="fi" id="epDesc" rows="3" maxlength="300">${escHtml(e.description)}</textarea>`)}
        ${field('Contact phone', `<input class="fi" id="epPhone" type="tel" value="${escHtml(e.phone)}">`)}
        ${field('WhatsApp', `<input class="fi" id="epWa" type="tel" value="${escHtml(e.whatsapp)}">`)}
        ${field('Email', `<input class="fi" id="epEmail" type="email" value="${escHtml(e.email)}">`)}
        ${field('Province', `<select class="fi" id="epProv" onchange="H._bizProfile.onProvince(this.value)">${provOpts}</select>`)}
        ${field('City / Town', `<select class="fi" id="epCity">${cityOpts}</select>`)}
        ${field('Suburb / Area', `<input class="fi" id="epSuburb" value="${escHtml(e.suburb)}">`)}

        <button class="btn-pri" id="epSaveBtn" style="width:100%;margin-top:6px" onclick="H._bizProfile.save()">Save Profile</button>
        ${isOwner(b) ? `<button class="ml-act-btn" style="width:100%;padding:13px;margin-top:10px" onclick="H._bizProfile.openStaff('${b.id}')">Manage Staff</button>` : ''}
      </div>
    </div>`;
  };

  pages.BusinessEditProfile_after = function () {
    if (_edit) { const c = document.getElementById('epCity'); if (c && _edit.city) c.value = _edit.city; }
  };

  // ── PAGE: Staff ──────────────────────────────────────────────
  pages.BusinessStaff = function (params) {
    const b = getBiz((params && params.id));
    if (!b) return `<div class="page active">${innerTopbar('Staff')}${H.emptyState('Business not found', '')}</div>`;
    if (!isOwner(b)) return `<div class="page active">${innerTopbar('Staff')}${H.emptyState('Owner only', 'Only the business owner can manage staff.')}</div>`;

    const staff = staffOf(b.id).filter(s => s.status !== 'removed');
    const limit = (typeof H.planEntitlements === 'function' ? H.planEntitlements(b.planId).staffLimit : (STAFF_LIMIT[b.planId] != null ? STAFF_LIMIT[b.planId] : 0));
    const full = staff.length >= limit;
    const planName = (H.BIZ_PLANS.find(p => p.id === b.planId) || {}).name || 'Free';
    const limitLabel = limit === Infinity ? 'Unlimited' : limit;

    const userName = (uid) => { const u = (H.state.users || []).find(x => x.id === uid); return u ? (u.name || u.phone || 'User') : 'User'; };
    const statusPill = (s) => {
      const map = { invited: ['#92400e', '#fef3c7', 'Invited'], active: ['#166534', '#dcfce7', 'Active'], removed: ['#991b1b', '#fee2e2', 'Removed'] };
      const m = map[s] || map.invited;
      return `<span style="font-size:10px;font-weight:800;color:${m[0]};background:${m[1]};border-radius:20px;padding:2px 8px">${m[2]}</span>`;
    };

    return `<div class="page active">
      ${innerTopbar('Staff')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#EEF2FB;border-radius:12px;padding:12px 14px;margin-bottom:16px">
          <div style="font-size:13px;color:var(--sub)">Seats used</div>
          <div style="font-size:14px;font-weight:800;color:#1A3A8F">${staff.length} / ${limitLabel} <span style="font-weight:600;color:var(--sub)">· ${planName}</span></div>
        </div>

        ${limit === 0
          ? `<div style="background:#FFF8EC;border-radius:14px;padding:16px;font-size:13px;color:var(--sub);line-height:1.55">Your current plan doesn't include staff seats. Upgrade to add team members.</div>`
          : `<div class="fg" style="margin-bottom:14px">
              <div class="fl">Invite by phone or email</div>
              <div style="display:flex;gap:8px">
                <input class="fi" id="stContact" placeholder="0771234567 or name@email.com" ${full ? 'disabled' : ''} style="flex:1">
                <button class="btn-pri" style="width:auto;padding:0 16px" ${full ? 'disabled style="opacity:.5"' : ''} onclick="H._bizProfile.invite('${b.id}')">Invite</button>
              </div>
              ${full ? `<div style="font-size:11.5px;color:#b45309;margin-top:5px">Seat limit reached — upgrade your plan for more.</div>` : ''}
            </div>`}

        ${staff.length ? staff.map(s => `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border,#E8ECF4)">
            <div style="width:38px;height:38px;border-radius:50%;background:#EEF2FB;display:flex;align-items:center;justify-content:center;font-weight:800;color:#1A3A8F;flex-shrink:0">${escHtml(H.initials(userName(s.userId)))}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:700;color:var(--text)">${escHtml(userName(s.userId))}</div>
              <div style="display:flex;gap:6px;align-items:center;margin-top:3px">${statusPill(s.status)}<span style="font-size:11px;color:var(--sub);text-transform:capitalize">${escHtml(s.role)}</span></div>
            </div>
            <button onclick="H._bizProfile.toggleRole('${b.id}','${s.id}')" style="background:#EEF2FB;color:#1A3A8F;border:none;border-radius:9px;padding:6px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">${s.role === 'manager' ? 'Make staff' : 'Make manager'}</button>
            <button onclick="H._bizProfile.remove('${b.id}','${s.id}')" style="background:#FEE2E2;color:#991b1b;border:none;border-radius:9px;padding:6px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">Remove</button>
          </div>`).join('')
          : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:24px 0">No staff yet.</div>`}
      </div>
    </div>`;
  };

  // ── PAGE: Public Profile ─────────────────────────────────────
  pages.BusinessProfile = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Business')}${H.emptyState('Business not found', 'This business may have been removed.')}</div>`;
    if (b.status !== 'active' && !canEdit(b)) {
      return `<div class="page active">${innerTopbar('Business')}${H.emptyState('Unavailable', 'This business is not currently available.')}</div>`;
    }
    const cat = H.CATEGORIES.find(c => c.id === b.category);
    const typeLabel = { individual: 'Individual', company: 'Registered Company', agency: 'Agency' }[b.bizType] || b.bizType;
    const loc = [b.suburb, b.city, b.province].filter(Boolean).join(', ');
    const verified = (b.verificationLevel || 0) >= 2;
    const coverStyle = b.cover ? `background-image:url('${escHtml(b.cover)}');background-size:cover;background-position:center` : 'background:linear-gradient(135deg,#1A3A8F,#0f2460)';
    const action = (label, icon, href, color) => href ? `<a href="${href}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;background:${color};color:#fff;border-radius:12px;padding:12px;font-size:13.5px;font-weight:700">${icon}${label}</a>` : '';
    const waNum = (b.whatsapp || '').replace(/[^0-9]/g, '');

    return `<div class="page active">
      ${innerTopbar('Business')}
      <div style="position:relative;margin-bottom:48px">
        <div style="height:140px;${coverStyle}"></div>
        <div style="position:absolute;left:16px;bottom:-38px;width:78px;height:78px;border-radius:18px;border:3px solid var(--card,#fff);background:#EEF2FB;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:26px;font-weight:800;color:#1A3A8F">
          ${b.logo ? `<img src="${escHtml(b.logo)}" style="width:100%;height:100%;object-fit:cover">` : escHtml(H.initials(b.name))}
        </div>
      </div>
      <div class="inner-content" style="padding-bottom:40px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="font-size:20px;font-weight:800;color:var(--text)">${escHtml(b.name)}</div>
              ${verified ? `<span title="Verified business">${H.verifiedBadge(18)}</span>` : ''}
            </div>
            <div style="font-size:13px;color:var(--sub);margin-top:3px">${escHtml(typeLabel)}${cat ? ' · ' + escHtml(cat.name) : ''}</div>
          </div>
          ${!canEdit(b) ? `<button id="bizFollowBtn" onclick="H.toggleFollowBusiness('${b.id}')" style="flex-shrink:0;border:none;border-radius:20px;padding:9px 18px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;${H.isFollowingBusiness(b.id) ? 'background:var(--bg,#EEF2FB);color:#1A3A8F;border:1.5px solid #1A3A8F' : 'background:#1A3A8F;color:#fff'}">${H.isFollowingBusiness(b.id) ? 'Following' : 'Follow'}</button>` : ''}
        </div>
        <div style="display:flex;gap:18px;margin-top:10px">
          <div><span id="bizFollowerCount" style="font-size:15px;font-weight:800;color:var(--text)">${b.followerCount || 0}</span> <span style="font-size:12.5px;color:var(--sub)">followers</span></div>
          <div><span style="font-size:15px;font-weight:800;color:var(--text)">${(H.state.listings || []).filter(l => l.businessId === b.id && l.status === 'active').length}</span> <span style="font-size:12.5px;color:var(--sub)">products</span></div>
        </div>
        ${loc ? `<div style="font-size:12.5px;color:var(--sub);margin-top:8px;display:flex;align-items:center;gap:5px">${H.ICONS.location} ${escHtml(loc)}</div>` : ''}
        ${b.description ? `<div style="font-size:13.5px;color:var(--text);line-height:1.6;margin-top:12px">${escHtml(b.description)}</div>` : ''}

        <div style="display:flex;gap:10px;margin-top:16px">
          ${action('Call', H.ICONS.phone || '', b.phone ? 'tel:' + escHtml(b.phone) : '', '#1A3A8F')}
          ${action('WhatsApp', '', waNum ? 'https://wa.me/' + (waNum.indexOf('263') === 0 ? waNum : '263' + waNum.replace(/^0/, '')) : '', '#16a34a')}
          ${action('Email', '', b.email ? 'mailto:' + escHtml(b.email) : '', '#475569')}
        </div>
        ${canEdit(b) ? `<button class="ml-act-btn" style="width:100%;padding:13px;margin-top:14px" onclick="H._bizProfile.openEdit('${b.id}')">Edit Profile</button>` : ''}

        ${(() => {
          const products = (H.state.listings || []).filter(l => l.businessId === b.id && l.status === 'active');
          if (!products.length) return `<div style="text-align:center;color:var(--sub);font-size:13px;padding:28px 0 6px">No products listed yet.</div>`;
          const card = (l) => `<div onclick="H.openListing && H.openListing('${l.id}')" style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:13px;overflow:hidden;cursor:pointer">
            <div style="aspect-ratio:1/1;background:#EEF2FB;display:flex;align-items:center;justify-content:center;color:#1A3A8F;overflow:hidden">${l.photos && l.photos[0] ? `<img src="${escHtml(l.photos[0])}" style="width:100%;height:100%;object-fit:cover">` : (typeof H.categoryIcon === 'function' ? H.categoryIcon(l.cat) : '')}</div>
            <div style="padding:9px 10px"><div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title || 'Untitled')}</div><div style="font-size:13px;font-weight:800;color:#1A3A8F;margin-top:2px">${escHtml(H.fmtPrice ? H.fmtPrice(l.price, l.currency) : l.price)}</div></div>
          </div>`;
          return `<div style="font-size:13px;font-weight:800;color:var(--text);margin:22px 0 10px">Products (${products.length})</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${products.map(card).join('')}</div>`;
        })()}
      </div>
    </div>`;
  };

  // Load follower count + the current user's follow state when the storefront opens.
  pages.BusinessProfile_after = function (params) {
    const id = params && params.id; if (!id) return;
    if (typeof H.fetchBusinessFollow === 'function') {
      H.fetchBusinessFollow(id).then(function (changed) {
        if (changed && H.currentPageName === 'BusinessProfile') H.renderPage('BusinessProfile', { id });
      });
    }
  };

  // Public entry point (listings/search will call this).
  H.openBusinessProfile = function (id) { H.openInner('BusinessProfile', { id }); };

  // ── PAGE: BusinessShop — SHEIN-style full storefront ─────────
  let _shopCat = 'all';
  let _shopQ   = '';

  function shopProducts(b) {
    return (H.state.listings || []).filter(function (l) {
      return l.status === 'active' && (
        String(l.businessId) === String(b.id) ||
        String(l.sellerId)   === String(b.ownerUserId) ||
        String(l.userId)     === String(b.ownerUserId)
      );
    });
  }

  pages.BusinessShop = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Shop')}${H.emptyState('Shop not found', '')}</div>`;
    if (b.status !== 'active' && !canEdit(b)) {
      return `<div class="page active">${innerTopbar('Shop')}${H.emptyState('Unavailable', 'This shop is not currently active.')}</div>`;
    }

    const u = currentUser();
    const verified = (b.verificationLevel || 0) >= 2;
    const loc = [b.city, b.province].filter(Boolean).join(', ') || 'Zimbabwe';
    const waNum = (b.whatsapp || '').replace(/[^0-9]/g, '');
    const isOwn = canEdit(b);

    const allProds = shopProducts(b);
    const catIds  = allProds.map(function (l) { return l.cat; }).filter(Boolean)
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
    const shopCats = catIds.map(function (id) {
      return H.CATEGORIES && H.CATEGORIES.find(function (c) { return c.id === id; });
    }).filter(Boolean);

    const q = (_shopQ || '').toLowerCase();
    let shown = _shopCat === 'all' ? allProds : allProds.filter(function (l) { return l.cat === _shopCat; });
    if (q) shown = shown.filter(function (l) { return (l.title || '').toLowerCase().indexOf(q) !== -1; });

    const coverStyle = b.cover
      ? `background-image:url('${escHtml(b.cover)}');background-size:cover;background-position:center`
      : 'background:linear-gradient(135deg,#1A3A8F 0%,#0f2460 50%,#2245b8 100%)';

    const fmtP = function (l) { return H.fmtPrice ? H.fmtPrice(l.price, l.currency) : ('$' + (l.price || 0)); };

    const productCard = function (l) {
      const hasPhoto = l.photos && l.photos[0];
      const icon = typeof H.categoryIcon === 'function' ? H.categoryIcon(l.cat) : '';
      return `<div onclick="H.openListing&&H.openListing('${escHtml(String(l.id))}')"
        style="background:var(--card,#fff);border-radius:14px;overflow:hidden;border:1px solid var(--border,#E8ECF4);cursor:pointer;position:relative">
        <div style="aspect-ratio:1/1;background:#EEF2FB;position:relative;overflow:hidden">
          ${hasPhoto
            ? `<img src="${escHtml(l.photos[0])}" style="width:100%;height:100%;object-fit:cover">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:36px">${icon}</div>`}
          <div onclick="event.stopPropagation()"
            style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.92);display:flex;align-items:center;justify-content:center;cursor:pointer">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#1A3A8F" stroke-width="2.2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          ${l.negotiable ? `<span style="position:absolute;top:8px;left:8px;background:#F59E0B;color:#fff;font-size:8px;font-weight:800;padding:2px 7px;border-radius:6px;letter-spacing:.3px">NEG</span>` : ''}
        </div>
        <div style="padding:8px 10px 12px">
          <div style="font-size:14px;font-weight:900;color:#1A3A8F;margin-bottom:2px">${escHtml(fmtP(l))}</div>
          <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">${escHtml(l.title || 'Untitled')}</div>
          ${l.size
            ? `<div style="font-size:10.5px;color:var(--sub)">Size: <span style="color:var(--text);font-weight:700">${escHtml(l.size)}</span></div>`
            : `<div style="font-size:10.5px;color:var(--sub)">${escHtml(loc)}</div>`}
        </div>
      </div>`;
    };

    const chipStyle = function (active) {
      return active
        ? 'flex-shrink:0;padding:7px 14px;border-radius:20px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid #1A3A8F;background:#1A3A8F;color:#fff'
        : 'flex-shrink:0;padding:7px 14px;border-radius:20px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text)';
    };

    return `<div class="page active">

      <!-- Sticky header -->
      <div style="position:sticky;top:0;z-index:100;background:var(--card,#fff);border-bottom:1px solid var(--border,#E8ECF4);display:flex;align-items:center;gap:10px;padding:10px 14px">
        <div onclick="H.goBack&&H.goBack()" style="width:34px;height:34px;border-radius:50%;background:var(--bg,#EEF2FB);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1A3A8F" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </div>
        <span style="flex:1;font-size:15px;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(b.name)}</span>
        ${verified ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#E8F5E9;color:#2E7D32;border-radius:20px;padding:4px 10px;font-size:10.5px;font-weight:800;flex-shrink:0;white-space:nowrap">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="#2E7D32"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          Verified Shop
        </span>` : ''}
      </div>

      <!-- Cover banner -->
      <div style="height:140px;${coverStyle}"></div>

      <!-- Identity block -->
      <div style="background:var(--card,#fff);padding:0 16px 16px">
        <div style="display:flex;align-items:flex-end;gap:14px;margin-top:-32px;margin-bottom:12px">
          <div style="width:64px;height:64px;border-radius:50%;border:3px solid var(--card,#fff);overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#1A3A8F,#2245b8);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#fff;box-shadow:0 3px 12px rgba(0,0,0,0.18)">
            ${b.logo ? `<img src="${escHtml(b.logo)}" style="width:100%;height:100%;object-fit:cover">` : escHtml(H.initials(b.name))}
          </div>
          <div style="flex:1;min-width:0;padding-bottom:2px">
            <div style="font-size:17px;font-weight:900;color:var(--text);line-height:1.1">${escHtml(b.name)}</div>
            <div style="font-size:12px;color:var(--sub);margin-top:3px;display:flex;align-items:center;gap:4px">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${escHtml(loc)}
            </div>
          </div>
          ${!isOwn ? `<button id="bsFollowBtn" onclick="H.toggleFollowBusiness&&H.toggleFollowBusiness('${b.id}')"
            style="flex-shrink:0;padding:8px 16px;border-radius:20px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;background:transparent;color:#1A3A8F;border:1.5px solid #1A3A8F">
            ${H.isFollowingBusiness && H.isFollowingBusiness(b.id) ? 'Following' : 'Follow Shop'}
          </button>` : ''}
        </div>

        <!-- Rating + stats -->
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">
          <span style="font-size:13.5px;font-weight:800;color:var(--text)">${b.rating || '4.8'}</span>
          <span style="color:#F59E0B;font-size:13px;letter-spacing:1px">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
          <span style="font-size:12px;color:var(--sub)">(${b.reviewCount || Math.max(allProds.length * 3, 1)} reviews)</span>
          <span style="color:var(--border,#E8ECF4)">|</span>
          <span style="font-size:12px;color:var(--sub)">${allProds.length} product${allProds.length === 1 ? '' : 's'}</span>
        </div>

        ${b.description ? `<div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:12px">${escHtml(b.description)}</div>` : ''}

        <!-- Contact pills -->
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${b.phone ? `<a href="tel:${escHtml(b.phone)}" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:20px;background:#EEF2FB;color:#1A3A8F;font-size:12.5px;font-weight:700;text-decoration:none">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.58a16 16 0 0 0 6.06 6.06l1.65-1.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Call
          </a>` : ''}
          ${waNum ? `<a href="https://wa.me/${escHtml(waNum.startsWith('263') ? waNum : '263' + waNum.replace(/^0/, ''))}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:20px;background:#DCFCE7;color:#15803D;font-size:12.5px;font-weight:700;text-decoration:none">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="#16a34a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>` : ''}
          <button onclick="H.openInner('Messages')" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:20px;background:var(--bg,#F4F6FB);color:var(--sub);font-size:12.5px;font-weight:700;border:none;cursor:pointer;font-family:inherit">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Message
          </button>
        </div>
      </div>

      <!-- Search -->
      <div style="margin:10px 12px 6px;background:var(--card,#fff);border:1.5px solid var(--border,#E8ECF4);border-radius:14px;display:flex;align-items:center;gap:8px;padding:10px 13px">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--sub)" stroke-width="2.3"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
        <input id="shopSearchIn" value="${escHtml(_shopQ)}" oninput="H._bizShop.onSearch('${escHtml(String(b.id))}',this.value)" placeholder="Search in ${escHtml(b.name)}..." style="flex:1;border:none;outline:none;background:transparent;font-size:13.5px;color:var(--text);font-family:inherit">
      </div>

      <!-- Category chips -->
      ${shopCats.length >= 1 ? `<div style="display:flex;gap:8px;overflow-x:auto;padding:4px 12px 12px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
        <button onclick="H._bizShop.setCat('${escHtml(String(b.id))}','all')" style="${chipStyle(_shopCat === 'all')}">All</button>
        ${shopCats.map(function (c) {
          return `<button onclick="H._bizShop.setCat('${escHtml(String(b.id))}','${escHtml(c.id)}')" style="${chipStyle(_shopCat === c.id)}">${escHtml(c.name)}</button>`;
        }).join('')}
      </div>` : '<div style="height:6px"></div>'}

      <!-- Count row -->
      <div style="padding:0 14px 8px">
        <span style="font-size:13px;color:var(--sub)">Showing <strong style="color:var(--text)">${shown.length}</strong> item${shown.length === 1 ? '' : 's'}</span>
      </div>

      <!-- Product grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 10px ${isOwn ? '80px' : '100px'}">
        ${shown.length
          ? shown.map(productCard).join('')
          : `<div style="grid-column:1/-1;text-align:center;color:var(--sub);font-size:13px;padding:40px 16px">No products yet.</div>`}
      </div>

      <!-- Sticky CTA -->
      <div style="position:sticky;bottom:0;background:rgba(var(--card-rgb,255,255,255),0.97);backdrop-filter:blur(10px);padding:10px 14px 14px;border-top:1px solid var(--border,#E8ECF4)">
        ${isOwn
          ? `<button onclick="H._bizProfile.openEdit('${escHtml(String(b.id))}')" style="width:100%;padding:15px;background:#1A3A8F;color:#fff;border:none;border-radius:16px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit">Edit Shop</button>`
          : `<button onclick="H.openInner('Messages')" style="width:100%;padding:15px;background:linear-gradient(135deg,#1A3A8F,#2245b8);color:#fff;border:none;border-radius:16px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 5px 18px rgba(26,58,143,0.3)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Message This Shop
          </button>`}
      </div>

    </div>`;
  };

  pages.BusinessShop_after = function (params) {
    const id = params && params.id; if (!id) return;
    if (typeof H.fetchBusinessFollow === 'function') {
      H.fetchBusinessFollow(id).then(function (changed) {
        if (changed && H.currentPageName === 'BusinessShop') H.renderPage('BusinessShop', { id });
      });
    }
  };

  H.openBusinessShop = function (id) { H.openInner('BusinessShop', { id }); };

  H._bizShop = {
    setCat: function (id, cat) { _shopCat = cat; _shopQ = ''; H.renderPage('BusinessShop', { id: id }); },
    onSearch: function (id, v) {
      _shopQ = v || '';
      // Re-render only the product grid so the search input keeps focus.
      const b = getBiz(id); if (!b) return;
      const allProds = shopProducts(b);
      const q = _shopQ.toLowerCase();
      let shown = _shopCat === 'all' ? allProds : allProds.filter(function (l) { return l.cat === _shopCat; });
      if (q) shown = shown.filter(function (l) { return (l.title || '').toLowerCase().indexOf(q) !== -1; });
      const fmtP = function (l) { return H.fmtPrice ? H.fmtPrice(l.price, l.currency) : ('$' + (l.price || 0)); };
      const loc = [b.city, b.province].filter(Boolean).join(', ') || 'Zimbabwe';
      const icon = function (cat) { return typeof H.categoryIcon === 'function' ? H.categoryIcon(cat) : ''; };
      const html = shown.length ? shown.map(function (l) {
        const hasPhoto = l.photos && l.photos[0];
        return `<div onclick="H.openListing&&H.openListing('${escHtml(String(l.id))}')" style="background:var(--card,#fff);border-radius:14px;overflow:hidden;border:1px solid var(--border,#E8ECF4);cursor:pointer;position:relative">
          <div style="aspect-ratio:1/1;background:#EEF2FB;position:relative;overflow:hidden">
            ${hasPhoto ? `<img src="${escHtml(l.photos[0])}" style="width:100%;height:100%;object-fit:cover">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:36px">${icon(l.cat)}</div>`}
            <div onclick="event.stopPropagation()" style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.92);display:flex;align-items:center;justify-content:center;cursor:pointer"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#1A3A8F" stroke-width="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
            ${l.negotiable ? `<span style="position:absolute;top:8px;left:8px;background:#F59E0B;color:#fff;font-size:8px;font-weight:800;padding:2px 7px;border-radius:6px">NEG</span>` : ''}
          </div>
          <div style="padding:8px 10px 12px">
            <div style="font-size:14px;font-weight:900;color:#1A3A8F;margin-bottom:2px">${escHtml(fmtP(l))}</div>
            <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">${escHtml(l.title || 'Untitled')}</div>
            ${l.size ? `<div style="font-size:10.5px;color:var(--sub)">Size: <span style="color:var(--text);font-weight:700">${escHtml(l.size)}</span></div>` : `<div style="font-size:10.5px;color:var(--sub)">${escHtml(loc)}</div>`}
          </div>
        </div>`;
      }).join('') : `<div style="grid-column:1/-1;text-align:center;color:var(--sub);font-size:13px;padding:40px 16px">No results.</div>`;
      const grid = document.querySelector('.page.active [style*="grid-template-columns:1fr 1fr"]');
      if (grid) grid.innerHTML = html;
    }
  };

  // ── PAGE: Browse / search businesses (storefront discovery) ──
  let _bizQ = '', _bizCat = 'all';

  H.fetchAllActiveBusinesses = async function () {
    const sb = window.supabase; if (!sb) return H.state.businesses || [];
    try {
      const { data, error } = await sb.from('businesses').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(300);
      if (error || !Array.isArray(data)) return H.state.businesses || [];
      H.state.businesses = H.state.businesses || [];
      data.forEach(row => {
        const mapped = { id: row.id, ownerUserId: row.owner_user_id, name: row.name || '', logo: row.logo, cover: row.cover, description: row.description, bizType: row.biz_type || 'individual', category: row.category, phone: row.phone, whatsapp: row.whatsapp, email: row.email, province: row.province, city: row.city, suburb: row.suburb, status: row.status, verificationLevel: row.verification_level || 0 };
        const i = H.state.businesses.findIndex(b => b.id === mapped.id);
        if (i >= 0) H.state.businesses[i] = Object.assign(H.state.businesses[i], mapped); else H.state.businesses.push(mapped);
      });
      saveState();
      return H.state.businesses;
    } catch (e) { return H.state.businesses || []; }
  };

  function bizSearchList() {
    const q = (_bizQ || '').toLowerCase().trim();
    let list = (H.state.businesses || []).filter(b => b.status === 'active');
    if (_bizCat !== 'all') list = list.filter(b => b.category === _bizCat);
    if (q) list = list.filter(b => {
      const cn = ((H.CATEGORIES.find(c => c.id === b.category) || {}).name || '').toLowerCase();
      return (b.name || '').toLowerCase().indexOf(q) !== -1 || (b.description || '').toLowerCase().indexOf(q) !== -1 || cn.indexOf(q) !== -1 || (b.city || '').toLowerCase().indexOf(q) !== -1;
    });
    return list;
  }

  function bizSearchCards() {
    const list = bizSearchList();
    if (!list.length) return `<div style="text-align:center;color:var(--sub);font-size:13px;padding:36px 16px">No stores found. Try a different search.</div>`;
    return list.map(b => {
      const cat = H.CATEGORIES.find(c => c.id === b.category);
      const loc = [b.city, b.province].filter(Boolean).join(', ');
      const prods = (H.state.listings || []).filter(l => l.businessId === b.id && l.status === 'active').length;
      const verified = (b.verificationLevel || 0) >= 2;
      return `<div onclick="H.openBusinessProfile('${b.id}')" style="display:flex;gap:12px;align-items:center;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:12px;margin:0 16px 10px;cursor:pointer">
        <div style="width:52px;height:52px;border-radius:13px;overflow:hidden;background:#EEF2FB;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#1A3A8F">${b.logo ? `<img src="${escHtml(b.logo)}" style="width:100%;height:100%;object-fit:cover">` : escHtml(H.initials(b.name))}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:5px"><span style="font-size:14.5px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(b.name)}</span>${verified ? H.verifiedBadge(14) : ''}</div>
          <div style="font-size:12px;color:var(--sub);margin-top:2px">${cat ? escHtml(cat.name) : ''}${loc ? ' · ' + escHtml(loc) : ''}</div>
          <div style="font-size:11.5px;color:var(--sub2,#98A2B3);margin-top:3px">${prods} product${prods === 1 ? '' : 's'}</div>
        </div>
        <span style="color:#CBD2E0;font-size:18px">›</span>
      </div>`;
    }).join('');
  }

  pages.BusinessSearch = function () {
    const chip = (id, label) => `<button onclick="H._bizSearch.setCat('${id}')" style="flex-shrink:0;padding:7px 14px;border-radius:20px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${_bizCat === id ? '#1A3A8F' : 'var(--border,#E8ECF4)'};background:${_bizCat === id ? '#1A3A8F' : 'var(--card,#fff)'};color:${_bizCat === id ? '#fff' : 'var(--text)'}">${label}</button>`;
    return `<div class="page active">
      ${innerTopbar('Stores')}
      <div style="padding:12px 16px 8px">
        <div style="display:flex;align-items:center;gap:8px;background:var(--card,#fff);border:1.5px solid var(--border,#E8ECF4);border-radius:12px;padding:10px 14px">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--sub)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="bizSearchIn" value="${escHtml(_bizQ)}" oninput="H._bizSearch.onQuery(this.value)" placeholder="Search stores, e.g. Pharmacy, Furniture" style="flex:1;border:none;outline:none;background:none;font-size:14px;color:var(--text);font-family:inherit">
        </div>
      </div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding:4px 16px 12px;-webkit-overflow-scrolling:touch">
        ${chip('all', 'All')}${H.CATEGORIES.map(c => chip(c.id, c.name)).join('')}
      </div>
      <div id="bizSearchResults">${bizSearchCards()}</div>
    </div>`;
  };

  pages.BusinessSearch_after = function () {
    if (typeof H.fetchAllActiveBusinesses === 'function') {
      H.fetchAllActiveBusinesses().then(function () {
        if (H.currentPageName === 'BusinessSearch') { const el = document.getElementById('bizSearchResults'); if (el) el.innerHTML = bizSearchCards(); }
      });
    }
  };

  H._bizSearch = {
    open() { _bizQ = ''; _bizCat = 'all'; H.openInner('BusinessSearch'); },
    onQuery(v) { _bizQ = v || ''; const el = document.getElementById('bizSearchResults'); if (el) el.innerHTML = bizSearchCards(); },
    setCat(id) { _bizCat = id; H.renderPage('BusinessSearch'); }
  };

  // ── Handlers ─────────────────────────────────────────────────
  function collectEdit() {
    if (!_edit) return;
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : undefined; };
    const m = { epName: 'name', epDesc: 'description', epPhone: 'phone', epWa: 'whatsapp', epEmail: 'email', epProv: 'province', epCity: 'city', epSuburb: 'suburb' };
    Object.keys(m).forEach(id => { const val = v(id); if (val !== undefined) _edit[m[id]] = val; });
  }

  H._bizProfile = {
    openEdit(id) { _edit = null; H.openInner('BusinessEditProfile', { id }); },
    openStaff(id) { H.fetchBusinessStaff(id).then(() => renderPage('BusinessStaff', { id })); H.openInner('BusinessStaff', { id }); },

    setType(t) { collectEdit(); _edit.bizType = t; renderPage('BusinessEditProfile'); },
    onProvince(p) { collectEdit(); _edit.province = p; _edit.city = ''; renderPage('BusinessEditProfile'); },

    onMedia(ev, which) {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      collectEdit();
      H.compressImage(f, which === 'cover' ? 1400 : 600, 0.82).then(d => { _edit[which] = d; renderPage('BusinessEditProfile'); });
    },

    async save() {
      collectEdit();
      const e = _edit; const b = getBiz(e.id); if (!b) { toast('Business not found'); return; }
      if (!e.name) { toast('Business name is required'); return; }
      if (e.phone && !/^(\+263|0)[0-9]{9}$/.test(e.phone)) { toast('Enter a valid Zimbabwe phone'); return; }
      const btn = document.getElementById('epSaveBtn'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

      // Upload any newly-picked (base64) media to the public bucket → URL.
      try {
        const u = currentUser();
        if (e.logo && e.logo.indexOf('data:') === 0) { const r = await H.uploadListingPhotos([e.logo], u.id); e.logo = r[0]; }
        if (e.cover && e.cover.indexOf('data:') === 0) { const r = await H.uploadListingPhotos([e.cover], u.id); e.cover = r[0]; }
      } catch (err) { /* keep base64 fallback */ }

      Object.assign(b, {
        name: e.name, description: e.description, bizType: e.bizType, phone: e.phone,
        whatsapp: e.whatsapp, email: e.email, province: e.province, city: e.city,
        suburb: e.suburb, logo: e.logo, cover: e.cover, updatedAt: Date.now()
      });
      saveState();
      if (typeof H.saveBusinessToCloud === 'function') await H.saveBusinessToCloud(b);
      toast('Profile saved');
      _edit = null;
      if (H._bizOnboard && typeof H._bizOnboard.view === 'function') H._bizOnboard.view(b.id);
      else renderPage('BusinessProfile', { id: b.id });
    },

    async invite(businessId) {
      const b = getBiz(businessId); if (!b || !isOwner(b)) { toast('Owner only'); return; }
      const limit = (typeof H.planEntitlements === 'function' ? H.planEntitlements(b.planId).staffLimit : (STAFF_LIMIT[b.planId] != null ? STAFF_LIMIT[b.planId] : 0));
      const current = staffOf(businessId).filter(s => s.status !== 'removed');
      if (current.length >= limit) { toast('Seat limit reached for your plan'); return; }
      const el = document.getElementById('stContact'); const q = el ? el.value.trim() : '';
      if (!q) { toast('Enter a phone or email'); return; }

      const found = await cloudFindUserByContact(q) || (H.state.users || []).find(u => u.phone === q || u.email === q);
      if (!found) { toast('No PaMarket user found with that phone/email'); return; }
      if (found.id === b.ownerUserId) { toast('You are the owner'); return; }
      if (current.some(s => s.userId === found.id)) { toast('Already invited'); return; }

      const row = { id: H.uid(), businessId, userId: found.id, role: 'staff', status: 'invited', invitedBy: currentUser().id, createdAt: Date.now() };
      staffMap()[businessId] = staffOf(businessId).concat(row); saveState();

      const sb = window.supabase;
      if (sb) {
        try { await sb.from('business_staff').insert({ id: row.id, business_id: businessId, user_id: found.id, role: 'staff', status: 'invited', invited_by: row.invitedBy }); }
        catch (err) { console.warn('invite insert:', err); }
      }
      if (typeof H.pushNotif === 'function') { try { H.pushNotif(found.id, 'Business invite', `${b.name} invited you to join as staff.`, 'business'); } catch (e) {} }
      toast('Invite sent');
      renderPage('BusinessStaff', { id: businessId });
    },

    async toggleRole(businessId, staffId) {
      const rows = staffOf(businessId); const s = rows.find(x => x.id === staffId); if (!s) return;
      s.role = s.role === 'manager' ? 'staff' : 'manager'; saveState();
      const sb = window.supabase;
      if (sb) { try { await sb.from('business_staff').update({ role: s.role }).eq('id', staffId); } catch (e) {} }
      renderPage('BusinessStaff', { id: businessId });
    },

    async remove(businessId, staffId) {
      staffMap()[businessId] = staffOf(businessId).filter(x => x.id !== staffId); saveState();
      const sb = window.supabase;
      if (sb) { try { await sb.from('business_staff').delete().eq('id', staffId); } catch (e) {} }
      toast('Staff removed');
      renderPage('BusinessStaff', { id: businessId });
    },

    // Invitee accept/decline (surfaced via notification deep link or future invites page).
    async accept(staffRowId, businessId) {
      const sb = window.supabase;
      if (sb) { try { await sb.from('business_staff').update({ status: 'active' }).eq('id', staffRowId); } catch (e) {} }
      const s = staffOf(businessId).find(x => x.id === staffRowId); if (s) { s.status = 'active'; saveState(); }
      toast('Invite accepted');
    }
  };

  // ── Follow / followers ───────────────────────────────────────
  H.isFollowingBusiness = function (id) {
    return Array.isArray(H.state.followedBusinesses) && H.state.followedBusinesses.indexOf(id) !== -1;
  };

  H.toggleFollowBusiness = function (id) {
    const u = H.currentUser(); if (!u) { H.requireAuth && H.requireAuth('Sign in to follow businesses'); return; }
    H.state.followedBusinesses = H.state.followedBusinesses || [];
    const b = getBiz(id);
    const sb = window.supabase;
    if (H.isFollowingBusiness(id)) {
      H.state.followedBusinesses = H.state.followedBusinesses.filter(x => x !== id);
      if (b) b.followerCount = Math.max(0, (b.followerCount || 1) - 1);
      if (sb) { try { sb.from('business_followers').delete().eq('business_id', id).eq('user_id', u.id).then(() => {}, () => {}); } catch (e) {} }
    } else {
      H.state.followedBusinesses.push(id);
      if (b) b.followerCount = (b.followerCount || 0) + 1;
      if (sb) { try { sb.from('business_followers').insert({ business_id: id, user_id: u.id }).then(() => {}, () => {}); } catch (e) {} }
      try { if (b && b.ownerUserId && b.ownerUserId !== u.id && H.pushNotif) H.pushNotif(b.ownerUserId, 'New follower', (u.name || 'Someone') + ' followed ' + (b.name || 'your business'), 'info', null, 'BusinessView'); } catch (e) {}
    }
    saveState();
    const f = H.isFollowingBusiness(id);
    const btn = document.getElementById('bizFollowBtn');
    if (btn) { btn.textContent = f ? 'Following' : 'Follow'; btn.style.cssText = 'flex-shrink:0;border-radius:20px;padding:9px 18px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;' + (f ? 'background:var(--bg,#EEF2FB);color:#1A3A8F;border:1.5px solid #1A3A8F' : 'background:#1A3A8F;color:#fff;border:none'); }
    const cnt = document.getElementById('bizFollowerCount');
    if (cnt && b) cnt.textContent = b.followerCount || 0;
  };

  H.fetchBusinessFollow = function (id) {
    const sb = window.supabase; const u = H.currentUser();
    if (!sb || !id) return Promise.resolve(false);
    const b = getBiz(id);
    return Promise.all([
      sb.from('business_followers').select('user_id', { count: 'exact', head: true }).eq('business_id', id),
      u ? sb.from('business_followers').select('user_id').eq('business_id', id).eq('user_id', u.id).maybeSingle() : Promise.resolve({ data: null })
    ]).then(function (res) {
      let changed = false;
      const cnt = res[0] && res[0].count;
      if (typeof cnt === 'number' && b && b.followerCount !== cnt) { b.followerCount = cnt; changed = true; }
      const mine = res[1] && res[1].data;
      H.state.followedBusinesses = H.state.followedBusinesses || [];
      const has = H.state.followedBusinesses.indexOf(id) !== -1;
      if (mine && !has) { H.state.followedBusinesses.push(id); changed = true; }
      if (!mine && has) { H.state.followedBusinesses = H.state.followedBusinesses.filter(x => x !== id); changed = true; }
      if (changed) saveState();
      return changed;
    }, function () { return false; });
  };

})(window.H = window.H || {});
