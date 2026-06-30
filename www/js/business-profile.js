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
      const { data, error } = await sb.from('business_staff').select('id,business_id,user_id,role,status,invited_by,created_at').eq('business_id', businessId).limit(50);
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
        categories: b.categories && b.categories.length ? b.categories.slice() : (b.category ? [b.category] : []),
        phone: b.phone || '', whatsapp: b.whatsapp || '', email: b.email || '',
        province: b.province || '', city: b.city || '', suburb: b.suburb || '',
        logo: b.logo || null, cover: b.cover || null, featuredListingIds: b.featuredListingIds ? b.featuredListingIds.slice() : []
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
        <div style="position:relative;margin-bottom:58px">
          <div style="height:120px;border-radius:16px;overflow:hidden;${coverStyle};position:relative">
            <button type="button" onclick="document.getElementById('bzCoverFile').click()"
              style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,.45);color:#fff;border:none;border-radius:10px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Change cover</button>
          </div>
          <!-- Tappable logo — tap to upload or change -->
          <div onclick="document.getElementById('bzLogoFile').click()"
            style="position:absolute;left:16px;bottom:-44px;width:88px;height:88px;border-radius:20px;border:3px solid var(--card,#fff);background:#EEF2FB;overflow:hidden;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.13);display:flex;align-items:center;justify-content:center">
            ${e.logo
              ? `<img src="${escHtml(e.logo)}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">
                 <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.48);padding:5px 0;display:flex;align-items:center;justify-content:center">
                   <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                 </div>`
              : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;pointer-events:none">
                   <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#1A3A8F" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                   <span style="font-size:9px;font-weight:800;color:#1A3A8F;letter-spacing:.3px">ADD LOGO</span>
                 </div>`
            }
          </div>
        </div>
        <input type="file" id="bzCoverFile" accept="image/*" style="display:none" onchange="H._bizProfile.onMedia(event,'cover')">
        <input type="file" id="bzLogoFile" accept="image/*" style="display:none" onchange="H._bizProfile.onMedia(event,'logo')">

        ${field('Business name', `<input class="fi" id="epName" maxlength="60" value="${escHtml(e.name)}">`)}
        ${field('Business type', `<div style="display:flex;gap:8px">${typeBtn('individual','Individual')}${typeBtn('company','Company')}${typeBtn('agency','Agency')}</div>`)}
        ${field('Description', `<textarea class="fi" id="epDesc" rows="3" maxlength="300">${escHtml(e.description)}</textarea>`)}
        ${field('Categories', `<div style="font-size:11.5px;color:var(--sub);margin-bottom:10px">Select all categories that apply to your business.</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${(H.CATEGORIES || []).map(c => `<button type="button" onclick="H._bizProfile.toggleCategory('${c.id}')" style="display:flex;align-items:center;gap:8px;padding:10px 11px;border-radius:12px;cursor:pointer;font-family:inherit;text-align:left;border:1.5px solid ${(e.categories||[]).includes(c.id) ? '#1A3A8F' : 'var(--border,#E8ECF4)'};background:${(e.categories||[]).includes(c.id) ? '#EEF2FB' : 'var(--card,#fff)'};color:${(e.categories||[]).includes(c.id) ? '#1A3A8F' : 'var(--text)'}"><span style="flex-shrink:0;color:#1A3A8F">${c.icon}</span><span style="font-size:12.5px;font-weight:700">${escHtml(c.name)}</span>${(e.categories||[]).includes(c.id) ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#1A3A8F" stroke-width="3" style="margin-left:auto;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</button>`).join('')}</div>`)}
        ${field('Contact phone', `<input class="fi" id="epPhone" type="tel" value="${escHtml(e.phone)}">`)}
        ${field('WhatsApp', `<input class="fi" id="epWa" type="tel" value="${escHtml(e.whatsapp)}">`)}
        ${field('Email', `<input class="fi" id="epEmail" type="email" value="${escHtml(e.email)}">`)}
        ${field('Province', `<select class="fi" id="epProv" onchange="H._bizProfile.onProvince(this.value)">${provOpts}</select>`)}
        ${field('City / Town', `<select class="fi" id="epCity">${cityOpts}</select>`)}
        ${field('Suburb / Area', `<input class="fi" id="epSuburb" value="${escHtml(e.suburb)}">`)}

        ${(() => {
          const u = currentUser();
          if (!u) return '';
          const myProds = (H.state.listings || []).filter(function(l) {
            return l.status === 'active' && (String(l.sellerId) === String(u.id) || String(l.businessId) === String(e.id));
          });
          if (!myProds.length) return '';
          const featured = e.featuredListingIds || [];
          const prodHtml = myProds.slice(0, 8).map(function(l) {
            const sel = featured.indexOf(l.id) !== -1;
            const hasPhoto = l.photos && l.photos[0];
            return '<div onclick="H._bizProfile.toggleFeatured(\'' + escHtml(String(l.id)) + '\')" style="border:2px solid ' + (sel ? '#1A3A8F' : 'var(--border,#E8ECF4)') + ';border-radius:10px;overflow:hidden;cursor:pointer;position:relative;background:var(--card,#fff)">'
              + (hasPhoto ? '<img src="' + escHtml(l.photos[0]) + '" style="width:100%;aspect-ratio:1/1;object-fit:cover">' : '<div style="aspect-ratio:1/1;background:#EEF2FB;display:flex;align-items:center;justify-content:center;font-size:22px">' + (typeof H.categoryIcon === 'function' ? H.categoryIcon(l.cat) : '') + '</div>')
              + '<div style="padding:4px 6px;font-size:10.5px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(l.title || 'Untitled') + '</div>'
              + (sel ? '<div style="position:absolute;top:5px;right:5px;width:18px;height:18px;border-radius:50%;background:#1A3A8F;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>' : '')
              + '</div>';
          }).join('');
          return '<div style="margin-bottom:14px;background:var(--bg,#F3F5FA);border-radius:14px;padding:14px 14px 16px">'
            + '<div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:3px">Shop Thumbnails</div>'
            + '<div style="font-size:11.5px;color:var(--sub);margin-bottom:12px">Tap up to 2 listings to feature as preview images when buyers browse Local Shops.</div>'
            + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">' + prodHtml + '</div>'
            + '</div>';
        })()}
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
    const _bCats = b.categories && b.categories.length ? b.categories : (b.category ? [b.category] : []);
    const catLabel = _bCats.map(id => ((H.CATEGORIES.find(c => c.id === id) || {}).name || '')).filter(Boolean).join(' / ');
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
          ${b.logo ? `<img src="${escHtml(b.logo)}${b.logo.startsWith('data:') ? '' : '?v=' + (b._updatedAt||b.updatedAt||'')}" style="width:100%;height:100%;object-fit:cover">` : _shopIconBlue}
        </div>
      </div>
      <div class="inner-content" style="padding-bottom:40px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="font-size:20px;font-weight:800;color:var(--text)">${escHtml(b.name)}</div>
              ${verified ? `<span title="Verified business">${H.verifiedBadge(18)}</span>` : ''}
            </div>
            <div style="font-size:13px;color:var(--sub);margin-top:3px">${escHtml(typeLabel)}${catLabel ? ' · ' + escHtml(catLabel) : ''}</div>
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
  let _shopCat      = 'all';
  let _shopQ        = '';
  let _shopSort     = 'default';
  let _shopMinPrice = '';
  let _shopMaxPrice = '';
  let _shopFilters  = {};

  function shopProducts(b) {
    return (H.state.listings || []).filter(function (l) {
      return l.status === 'active' && String(l.businessId) === String(b.id);
    });
  }

  function _shopDominantCat(b) {
    if (_shopCat !== 'all' && _shopCat !== 'new') return _shopCat;
    var prods = shopProducts(b);
    if (!prods.length) return null;
    var counts = {};
    prods.forEach(function(l) { if (l.cat) counts[l.cat] = (counts[l.cat] || 0) + 1; });
    var best = null, bestCnt = 0;
    Object.keys(counts).forEach(function(c) { if (counts[c] > bestCnt) { bestCnt = counts[c]; best = c; } });
    return best;
  }

  function _shopFilterAttrHtml(domCat) {
    if (!domCat) return '';
    var sf = _shopFilters;
    var sH = function(id, key, label, opts) {
      var cur = (sf[key] || '').toLowerCase();
      var h = '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">' + escHtml(label) + '</div>'
        + '<select id="' + id + '" style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E8ECF4);border-radius:10px;font-size:13px;font-family:inherit;background:var(--bg,#F3F5FA);color:var(--text);outline:none">'
        + '<option value="">Any</option>';
      opts.forEach(function(o) {
        var v = Array.isArray(o) ? o[0] : o.toLowerCase(), t = Array.isArray(o) ? o[1] : o;
        h += '<option value="' + escHtml(v) + '"' + (cur === v ? ' selected' : '') + '>' + escHtml(t) + '</option>';
      });
      return h + '</select></div>';
    };
    var tH = function(id, key, label, ph) {
      return '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">' + escHtml(label) + '</div>'
        + '<input id="' + id + '" type="text" placeholder="' + escHtml(ph) + '" value="' + escHtml(sf[key] || '') + '" style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E8ECF4);border-radius:10px;font-size:13px;font-family:inherit;background:var(--bg,#F3F5FA);color:var(--text);outline:none;box-sizing:border-box">'
        + '</div>';
    };
    var condOpts = [['brand new','Brand New'],['used','Used']];
    if (domCat === 'fashion') {
      return '<div style="border-top:1px solid var(--border,#E8ECF4);margin-bottom:16px;padding-top:16px"><div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Fashion Filters</div>'
        + sH('shopFCondition','condition','Condition',condOpts)
        + sH('shopFGender','gender','For',[['women','Women'],['men','Men'],['unisex','Unisex'],['kids','Kids']])
        + tH('shopFSize','size','Size','e.g. M, UK 8, 38')
        + tH('shopFBrand','brand','Brand','e.g. Zara, Nike, Edgars')
        + '</div>';
    }
    if (domCat === 'kids') {
      return '<div style="border-top:1px solid var(--border,#E8ECF4);margin-bottom:16px;padding-top:16px"><div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Kids Filters</div>'
        + sH('shopFCondition','condition','Condition',condOpts)
        + sH('shopFGender','gender','Gender',[['male','Boys'],['female','Girls']])
        + tH('shopFSize','size','Age / Size','e.g. 3-5 yrs, size 10')
        + '</div>';
    }
    if (domCat === 'vehicles') {
      return '<div style="border-top:1px solid var(--border,#E8ECF4);margin-bottom:16px;padding-top:16px"><div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Vehicle Filters</div>'
        + '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Year Range</div>'
        + '<div style="display:flex;align-items:center;gap:10px">'
        + '<input id="shopFYearMin" type="number" min="1960" max="2030" placeholder="From" value="' + escHtml(sf.yearMin || '') + '" style="flex:1;padding:10px 12px;border:1.5px solid var(--border,#E8ECF4);border-radius:10px;font-size:13px;font-family:inherit;background:var(--bg,#F3F5FA);color:var(--text);outline:none">'
        + '<span style="color:var(--sub);flex-shrink:0">to</span>'
        + '<input id="shopFYearMax" type="number" min="1960" max="2030" placeholder="To" value="' + escHtml(sf.yearMax || '') + '" style="flex:1;padding:10px 12px;border:1.5px solid var(--border,#E8ECF4);border-radius:10px;font-size:13px;font-family:inherit;background:var(--bg,#F3F5FA);color:var(--text);outline:none">'
        + '</div></div>'
        + sH('shopFFuel','fuel','Fuel Type',[['petrol','Petrol'],['diesel','Diesel'],['hybrid','Hybrid'],['electric','Electric']])
        + sH('shopFCondition','condition','Condition',[['brand new','Brand New'],['used','Used'],['for parts','For Parts']])
        + tH('shopFBrand','brand','Make / Brand','e.g. Toyota, Honda')
        + '</div>';
    }
    if (domCat === 'electronics') {
      return '<div style="border-top:1px solid var(--border,#E8ECF4);margin-bottom:16px;padding-top:16px"><div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Electronics Filters</div>'
        + sH('shopFCondition','condition','Condition',[['brand new','Brand New'],['used','Used'],['refurbished','Refurbished']])
        + tH('shopFBrand','brand','Brand','e.g. Samsung, Apple')
        + '</div>';
    }
    if (domCat === 'furniture') {
      return '<div style="border-top:1px solid var(--border,#E8ECF4);margin-bottom:16px;padding-top:16px"><div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Furniture Filters</div>'
        + sH('shopFCondition','condition','Condition',condOpts)
        + '</div>';
    }
    if (domCat === 'agriculture') {
      return '<div style="border-top:1px solid var(--border,#E8ECF4);margin-bottom:16px;padding-top:16px"><div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Agriculture Filters</div>'
        + sH('shopFCondition','condition','Condition',[['new','New'],['used','Used'],['live','Live']])
        + '</div>';
    }
    return '<div style="border-top:1px solid var(--border,#E8ECF4);margin-bottom:16px;padding-top:16px">'
      + sH('shopFCondition','condition','Condition',condOpts)
      + '</div>';
  }

  function _shopAttrPillsHtml(bizId) {
    var sf = _shopFilters; if (!sf) return '';
    var bId = escHtml(String(bizId));
    var cap = function(s) { return s ? s.replace(/\b\w/g, function(c){ return c.toUpperCase(); }) : ''; };
    var xB  = function(fn) { return '<button onclick="' + fn + '" style="background:none;border:none;color:#1A3A8F;cursor:pointer;padding:0;font-size:13px;line-height:1;margin-left:2px">&times;</button>'; };
    var pl  = function(txt, fn) { return '<span style="display:inline-flex;align-items:center;gap:4px;background:#EEF2FB;color:#1A3A8F;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:20px">' + txt + xB(fn) + '</span>'; };
    var out = [];
    if (sf.condition) out.push(pl(escHtml(cap(sf.condition)), "H._bizShop._clearAttr('" + bId + "','condition')"));
    if (sf.gender)    out.push(pl(escHtml(cap(sf.gender)),    "H._bizShop._clearAttr('" + bId + "','gender')"));
    if (sf.size)      out.push(pl('Size: ' + escHtml(sf.size),  "H._bizShop._clearAttr('" + bId + "','size')"));
    if (sf.brand)     out.push(pl('Brand: ' + escHtml(sf.brand), "H._bizShop._clearAttr('" + bId + "','brand')"));
    if (sf.fuel)      out.push(pl(escHtml(cap(sf.fuel)) + ' fuel', "H._bizShop._clearAttr('" + bId + "','fuel')"));
    if (sf.yearMin || sf.yearMax) out.push(pl('Year: ' + escHtml(sf.yearMin || 'any') + '-' + escHtml(sf.yearMax || 'any'), "H._bizShop._clearAttr('" + bId + "','year')"));
    return out.join('');
  }

  var _shopIcon = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-6h15L21 9M3 9h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm6 0v2a3 3 0 006 0V9"/></svg>';
  var _shopIconBlue = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#1A3A8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-6h15L21 9M3 9h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm6 0v2a3 3 0 006 0V9"/></svg>';

  function _ratingStatsHtml(b) {
    var allP = shopProducts(b);
    var rvs = (H.state.businessReviews && H.state.businessReviews[b.id]) || [];
    var cnt = rvs.length;
    var avg = cnt > 0 ? (rvs.reduce(function(s, r){ return s + (r.rating || 0); }, 0) / cnt) : null;
    var filled = avg !== null ? Math.round(avg) : 0;
    return (avg !== null
      ? '<span style="font-size:13.5px;font-weight:800;color:var(--text)">' + avg.toFixed(1) + '</span>'
        + '<span style="color:#F59E0B;font-size:13px;letter-spacing:1px">' + '&#9733;'.repeat(filled) + '<span style="color:#D1D5DB">' + '&#9734;'.repeat(5 - filled) + '</span></span>'
        + '<span style="font-size:12px;color:var(--sub)">(' + cnt + ' review' + (cnt === 1 ? '' : 's') + ')</span>'
      : '<span style="font-size:12px;color:var(--sub)">No reviews yet</span>')
      + '<span style="color:var(--border,#E8ECF4)">|</span>'
      + '<span style="font-size:12px;color:var(--sub)">' + allP.length + ' product' + (allP.length === 1 ? '' : 's') + '</span>';
  }

  function _reviewsHtml(b) {
    if (!b) return '';
    const reviews = (H.state.businessReviews && H.state.businessReviews[b.id]) || [];
    const avg = reviews.length ? (reviews.reduce(function(s, r){ return s + (r.rating || 0); }, 0) / reviews.length).toFixed(1) : null;
    const u = currentUser();
    const isOwn = canEdit(b);
    const alreadyReviewed = u && reviews.some(function(r){ return r.reviewerId === u.id; });
    const stars = function(n) {
      n = Math.round(n || 0);
      return '<span style="color:#F59E0B">' + '&#9733;'.repeat(n) + '</span><span style="color:#D1D5DB">' + '&#9734;'.repeat(5 - n) + '</span>';
    };
    return '<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:12px;overflow:hidden">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border,#E8ECF4)">'
      + '<div>'
      + '<div style="font-size:14px;font-weight:800;color:var(--text)">Reviews</div>'
      + (avg
        ? '<div style="font-size:12px;color:var(--sub);margin-top:2px;display:flex;align-items:center;gap:5px"><span style="font-weight:700;color:var(--text)">' + avg + '</span>' + stars(parseFloat(avg)) + '<span>(' + reviews.length + ')</span></div>'
        : '<div style="font-size:12px;color:var(--sub);margin-top:2px">No reviews yet</div>')
      + '</div>'
      + (!isOwn
        ? '<button onclick="H._bizShop.openReviewModal(\'' + escHtml(String(b.id)) + '\')" style="padding:7px 14px;border-radius:8px;background:#1A3A8F;color:#fff;border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">' + (alreadyReviewed ? 'Update Review' : 'Write a Review') + '</button>'
        : '')
      + '</div>'
      + (reviews.length
        ? reviews.slice(0, 6).map(function(r){
            return '<div style="padding:14px 16px;border-bottom:1px solid var(--border,#E8ECF4)">'
              + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">'
              + '<div style="font-size:13px;font-weight:700;color:var(--text)">' + escHtml(r.reviewerName) + '</div>'
              + '<div style="font-size:13px;letter-spacing:1px">' + stars(r.rating) + '</div>'
              + '</div>'
              + (r.comment ? '<div style="font-size:12.5px;color:var(--sub);line-height:1.55;margin-bottom:4px">' + escHtml(r.comment) + '</div>' : '')
              + '<div style="font-size:10.5px;color:var(--sub2,#98A2B3)">' + (typeof H.timeAgo === 'function' ? H.timeAgo(r.createdAt) : '') + '</div>'
              + '</div>';
          }).join('')
        : '<div style="padding:24px 16px;text-align:center;color:var(--sub);font-size:13px">Be the first to review this shop.</div>')
      + '</div>';
  }

  H.fetchShopReviews = async function (bizId) {
    const sb = window.supabase; if (!sb || !bizId) return;
    try {
      const { data, error } = await sb.from('business_reviews').select('*').eq('business_id', bizId).order('created_at', { ascending: false }).limit(20);
      if (error || !Array.isArray(data)) return;
      H.state.businessReviews = H.state.businessReviews || {};
      H.state.businessReviews[bizId] = data.map(function(r){
        return { id: r.id, bizId: bizId, reviewerId: r.reviewer_id, reviewerName: r.reviewer_name || 'Anonymous', rating: r.rating || 0, comment: r.comment || '', createdAt: new Date(r.created_at).getTime() };
      });
      saveState();
      if (H.currentPageName === 'BusinessShop') {
        const sec = document.getElementById('shopReviewsSection');
        const b = getBiz(bizId);
        if (sec && b) sec.innerHTML = _reviewsHtml(b);
        const statsEl = document.getElementById('shopRatingStats');
        if (statsEl && b) statsEl.innerHTML = _ratingStatsHtml(b);
      }
    } catch(e) {}
  };

  H.submitShopReview = async function (bizId, rating, comment) {
    const u = currentUser();
    if (!u) { if (H.requireAuth) H.requireAuth('Sign in to leave a review'); return; }
    if (!rating) { if (H.toast) H.toast('Please select a star rating'); return; }
    const b = getBiz(bizId); if (!b) return;
    const row = { id: H.uid(), bizId: bizId, reviewerId: u.id, reviewerName: u.name || u.phone || 'User', rating: rating, comment: comment || '', createdAt: Date.now() };
    H.state.businessReviews = H.state.businessReviews || {};
    H.state.businessReviews[bizId] = (H.state.businessReviews[bizId] || []).filter(function(r){ return r.reviewerId !== u.id; });
    H.state.businessReviews[bizId].unshift(row);
    saveState();
    const m = document.getElementById('shopReviewModal'); if (m) m.remove();
    if (H.toast) H.toast('Review submitted');
    const sec = document.getElementById('shopReviewsSection'); if (sec) sec.innerHTML = _reviewsHtml(b);
    const statsEl = document.getElementById('shopRatingStats'); if (statsEl) statsEl.innerHTML = _ratingStatsHtml(b);
    if (typeof H.pushNotif === 'function') H.pushNotif(b.ownerUserId, 'New review', (u.name || 'Someone') + ' left a ' + rating + '-star review on ' + b.name, 'review');
    const sb = window.supabase;
    if (sb) { try { await sb.from('business_reviews').upsert({ id: row.id, business_id: bizId, reviewer_id: u.id, reviewer_name: row.reviewerName, rating: rating, comment: row.comment || '' }, { onConflict: 'reviewer_id,business_id' }); } catch(e) {} }
  };

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
    // Price range filter
    const _minP = parseFloat(_shopMinPrice); const _maxP = parseFloat(_shopMaxPrice);
    if (!isNaN(_minP) && _minP >= 0) shown = shown.filter(function (l) { return (Number(l.price) || 0) >= _minP; });
    if (!isNaN(_maxP) && _maxP > 0)  shown = shown.filter(function (l) { return (Number(l.price) || 0) <= _maxP; });
    // Category attribute filters
    var _sf = _shopFilters || {};
    if (_sf.condition) shown = shown.filter(function(l) { return (l.condition || '').toLowerCase() === _sf.condition; });
    if (_sf.brand)     shown = shown.filter(function(l) { return (l.brand || l.make || '').toLowerCase().indexOf(_sf.brand) !== -1; });
    if (_sf.gender)    shown = shown.filter(function(l) { return (l.gender || '').toLowerCase() === _sf.gender; });
    if (_sf.size)      shown = shown.filter(function(l) {
      if (Array.isArray(l.sizes)) return l.sizes.some(function(s){ return String(s).toLowerCase() === _sf.size; });
      return (l.size || '').toLowerCase() === _sf.size;
    });
    if (_sf.fuel)      shown = shown.filter(function(l) { return (l.fuel || l.fuelType || '').toLowerCase() === _sf.fuel; });
    if (_sf.yearMin)   shown = shown.filter(function(l) { return +(l.year||0) >= +_sf.yearMin; });
    if (_sf.yearMax)   shown = shown.filter(function(l) { return +(l.year||9999) <= +_sf.yearMax; });
    // Sort
    if (_shopSort === 'newest' || _shopCat === 'new') {
      shown = shown.slice().sort(function (a, b) { return ((b.createdAt||b.created_at||0)) - ((a.createdAt||a.created_at||0)); });
      if (_shopCat === 'new') shown = shown.slice(0, 12);
    } else if (_shopSort === 'price_asc') {
      shown = shown.slice().sort(function (a, b) { return (Number(a.price) || 0) - (Number(b.price) || 0); });
    } else if (_shopSort === 'price_desc') {
      shown = shown.slice().sort(function (a, b) { return (Number(b.price) || 0) - (Number(a.price) || 0); });
    }

    const coverStyle = b.cover
      ? `background-image:url('${escHtml(b.cover)}');background-size:cover;background-position:center`
      : 'background:linear-gradient(135deg,#1A3A8F 0%,#0f2460 50%,#2245b8 100%)';

    const fmtP = function (l) { return H.fmtPrice ? H.fmtPrice(l.price, l.currency) : ('$' + (l.price || 0)); };

    const productCard = function (l) {
      const hasPhoto = l.photos && l.photos[0];
      const icon = typeof H.categoryIcon === 'function' ? H.categoryIcon(l.cat) : '';
      const sizesArr = Array.isArray(l.sizes) ? l.sizes : (l.size ? [l.size] : []);
      const colorsArr = Array.isArray(l.colors) ? l.colors : (l.color ? [l.color] : []);
      const sizePills = sizesArr.slice(0, 4).map(function(s) {
        return '<span style="display:inline-block;padding:2px 6px;border:1px solid var(--border,#E8ECF4);border-radius:3px;font-size:9px;font-weight:700;color:var(--sub)">' + escHtml(String(s)) + '</span>';
      }).join('');
      const colorDots = colorsArr.slice(0, 5).map(function(c) {
        return '<span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:' + escHtml(String(c)) + ';border:1px solid rgba(0,0,0,0.12)"></span>';
      }).join('');
      const hasVariants = sizesArr.length > 0 || colorsArr.length > 0;
      return `<div onclick="H.openListing&&H.openListing('${escHtml(String(l.id))}')"
        style="background:var(--card,#fff);border-radius:8px;overflow:hidden;border:1px solid var(--border,#E8ECF4);cursor:pointer;position:relative">
        <div style="aspect-ratio:1/1;background:#F4F6FB;position:relative;overflow:hidden">
          ${hasPhoto
            ? `<img src="${escHtml(l.photos[0])}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:36px">${icon}</div>`}
          <div onclick="event.stopPropagation()"
            style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.12)">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#1A3A8F" stroke-width="2.2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          ${l.negotiable ? `<span style="position:absolute;top:8px;left:8px;background:#F59E0B;color:#fff;font-size:8px;font-weight:800;padding:2px 6px;border-radius:3px;letter-spacing:.4px">NEG</span>` : ''}
        </div>
        <div style="padding:10px 10px 13px">
          <div style="font-size:15px;font-weight:900;color:#1A3A8F;margin-bottom:3px;letter-spacing:-.3px">${escHtml(fmtP(l))}</div>
          <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px">${escHtml(l.title || 'Untitled')}</div>
          ${hasVariants
            ? `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">${sizePills}${colorDots}</div>`
            : `<div style="font-size:10.5px;color:var(--sub)">${escHtml(loc)}</div>`}
        </div>
      </div>`;
    };

    const chipStyle = function (active) {
      return active
        ? 'flex-shrink:0;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid #1A3A8F;background:#1A3A8F;color:#fff'
        : 'flex-shrink:0;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text)';
    };
    const _hasAttrs = Object.keys(_shopFilters).some(function(k) { var v = _shopFilters[k]; return !!(v && v !== ''); });
    const _filterActive = _shopSort !== 'default' || !!_shopMinPrice || !!_shopMaxPrice || _hasAttrs;

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
            ${b.logo ? `<img src="${escHtml(b.logo)}${b.logo.startsWith('data:') ? '' : '?v=' + (b._updatedAt||b.updatedAt||'')}" style="width:100%;height:100%;object-fit:cover">` : _shopIcon}
          </div>
          <div style="flex:1;min-width:0;padding-bottom:2px">
            <div style="font-size:17px;font-weight:900;color:var(--text);line-height:1.1">${escHtml(b.name)}</div>
            <div style="font-size:12px;color:var(--sub);margin-top:3px;display:flex;align-items:center;gap:4px">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${escHtml(loc)}
            </div>
          </div>
          ${!isOwn ? `<button id="bsFollowBtn" onclick="H.toggleFollowBusiness&&H.toggleFollowBusiness('${b.id}')"
            style="flex-shrink:0;padding:9px 16px;border-radius:8px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;background:#1A3A8F;color:#fff;border:none;letter-spacing:.2px">
            ${H.isFollowingBusiness && H.isFollowingBusiness(b.id) ? 'Following' : 'Follow Shop'}
          </button>` : ''}
        </div>

        <!-- Rating + stats -->
        <div id="shopRatingStats" style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">
          ${_ratingStatsHtml(b)}
        </div>

        ${b.description ? `<div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:12px">${escHtml(b.description)}</div>` : ''}

        <!-- Contact pills -->
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${b.phone ? `<a href="tel:${escHtml(b.phone)}" onclick="H.recordShopLead&&H.recordShopLead('${escHtml(String(b.id))}','call')" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:20px;background:#EEF2FB;color:#1A3A8F;font-size:12.5px;font-weight:700;text-decoration:none">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.58a16 16 0 0 0 6.06 6.06l1.65-1.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Call
          </a>` : ''}
          ${waNum ? `<a href="https://wa.me/${escHtml(waNum.startsWith('263') ? waNum : '263' + waNum.replace(/^0/, ''))}" target="_blank" onclick="H.recordShopLead&&H.recordShopLead('${escHtml(String(b.id))}','whatsapp')" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:20px;background:#DCFCE7;color:#15803D;font-size:12.5px;font-weight:700;text-decoration:none">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="#16a34a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>` : ''}
          <button onclick="H.recordShopLead&&H.recordShopLead('${escHtml(String(b.id))}','chat');H.startBizChat('${escHtml(String(b.id))}')" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:20px;background:var(--bg,#F4F6FB);color:var(--sub);font-size:12.5px;font-weight:700;border:none;cursor:pointer;font-family:inherit">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Message
          </button>
        </div>
      </div>

      <!-- Search + Filter -->
      <div style="margin:10px 12px 6px;display:flex;align-items:center;gap:8px">
        <div style="flex:1;background:var(--card,#fff);border:1.5px solid var(--border,#E8ECF4);border-radius:14px;display:flex;align-items:center;gap:8px;padding:10px 13px">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--sub)" stroke-width="2.3"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
          <input id="shopSearchIn" value="${escHtml(_shopQ)}" oninput="H._bizShop.onSearch('${escHtml(String(b.id))}',this.value)" placeholder="Search in ${escHtml(b.name)}..." style="flex:1;border:none;outline:none;background:transparent;font-size:13.5px;color:var(--text);font-family:inherit">
          ${_shopQ ? `<button onclick="H._bizShop.onSearch('${escHtml(String(b.id))}','');document.getElementById('shopSearchIn')&&(document.getElementById('shopSearchIn').value='')" style="background:none;border:none;color:var(--sub);cursor:pointer;padding:0;font-size:16px;line-height:1;flex-shrink:0">&times;</button>` : ''}
        </div>
        <button onclick="H._bizShop.openFilterSheet('${escHtml(String(b.id))}')" title="Sort &amp; Filter" style="flex-shrink:0;width:44px;height:44px;border-radius:12px;background:${_filterActive ? '#1A3A8F' : 'var(--card,#fff)'};border:1.5px solid ${_filterActive ? '#1A3A8F' : 'var(--border,#E8ECF4)'};display:flex;align-items:center;justify-content:center;cursor:pointer">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${_filterActive ? '#fff' : '#1A3A8F'}" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>
        </button>
      </div>
      ${_filterActive ? `<div style="display:flex;align-items:center;gap:6px;padding:0 12px 6px;flex-wrap:wrap">
        ${_shopSort !== 'default' ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#EEF2FB;color:#1A3A8F;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:20px">${_shopSort === 'newest' ? 'Newest' : _shopSort === 'price_asc' ? 'Price: Low' : 'Price: High'} <button onclick="H._bizShop._setSort('${escHtml(String(b.id))}','default')" style="background:none;border:none;color:#1A3A8F;cursor:pointer;padding:0;font-size:13px;line-height:1;margin-left:2px">&times;</button></span>` : ''}
        ${(_shopMinPrice || _shopMaxPrice) ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#EEF2FB;color:#1A3A8F;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:20px">${_shopMinPrice ? '$'+_shopMinPrice : ''}${_shopMinPrice && _shopMaxPrice ? ' - ' : ''}${_shopMaxPrice ? '$'+_shopMaxPrice : ''} <button onclick="H._bizShop._clearPrice('${escHtml(String(b.id))}')" style="background:none;border:none;color:#1A3A8F;cursor:pointer;padding:0;font-size:13px;line-height:1;margin-left:2px">&times;</button></span>` : ''}
        ${_shopAttrPillsHtml(b.id)}
      </div>` : ''}

      <!-- Category chips -->
      <div style="display:flex;gap:8px;overflow-x:auto;padding:4px 12px 12px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
        <button onclick="H._bizShop.setCat('${escHtml(String(b.id))}','all')" style="${chipStyle(_shopCat === 'all')}">All</button>
        <button onclick="H._bizShop.setCat('${escHtml(String(b.id))}','new')" style="${chipStyle(_shopCat === 'new')}">New Arrivals</button>
        ${shopCats.map(function (c) {
          return `<button onclick="H._bizShop.setCat('${escHtml(String(b.id))}','${escHtml(c.id)}')" style="${chipStyle(_shopCat === c.id)}">${escHtml(c.name)}</button>`;
        }).join('')}
      </div>

      <!-- Count row -->
      <div style="padding:0 14px 8px">
        <span style="font-size:13px;color:var(--sub)">Showing <strong style="color:var(--text)">${shown.length}</strong> item${shown.length === 1 ? '' : 's'}</span>
      </div>

      <!-- Product grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 12px 16px">
        ${shown.length
          ? shown.map(productCard).join('')
          : `<div style="grid-column:1/-1;text-align:center;color:var(--sub);font-size:13px;padding:40px 16px">No products yet.</div>`}
      </div>

      <!-- Reviews -->
      <div id="shopReviewsSection" style="padding:0 12px ${isOwn ? '80px' : '100px'}">
        ${_reviewsHtml(b)}
      </div>

      <!-- Sticky CTA -->
      <div style="position:sticky;bottom:0;background:rgba(var(--card-rgb,255,255,255),0.97);backdrop-filter:blur(10px);padding:10px 14px calc(14px + var(--safe-bottom, 0px));border-top:1px solid var(--border,#E8ECF4)">
        ${isOwn
          ? `<div style="display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;gap:8px">
                <button onclick="H._bizAnalytics&&H._bizAnalytics.open('${escHtml(String(b.id))}')" style="flex:1;padding:13px 0;background:#EEF2FB;color:#1A3A8F;border:none;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:4px">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Analytics
                </button>
                <button onclick="H._bizLeads&&H._bizLeads.open('${escHtml(String(b.id))}')" style="flex:1;padding:13px 0;background:#EEF2FB;color:#1A3A8F;border:none;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:4px">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Leads
                </button>
                <button onclick="H._bizProfile.openEdit('${escHtml(String(b.id))}')" style="flex:1;padding:13px 0;background:#1A3A8F;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:4px">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
                </button>
              </div>
              <button onclick="H._bizProfile.confirmDeleteShop('${escHtml(String(b.id))}')" style="width:100%;padding:11px 0;background:#FFF1F0;color:#dc2626;border:1.5px solid #FECACA;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>Delete Shop
              </button>
            </div>`
          : `<button onclick="H.recordShopLead&&H.recordShopLead('${escHtml(String(b.id))}','chat');H.startBizChat('${escHtml(String(b.id))}')" style="width:100%;padding:15px;background:linear-gradient(135deg,#1A3A8F,#2245b8);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 5px 18px rgba(26,58,143,0.3)">
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
    if (typeof H.fetchShopReviews === 'function') H.fetchShopReviews(id);
  };

  H.openBusinessShop = function (id) { H.openInner('BusinessShop', { id }); };

  H._bizShop = {
    setCat: function (id, cat) { _shopCat = cat; _shopQ = ''; _shopFilters = {}; H.renderPage('BusinessShop', { id: id }); },
    _reviewStar: 0,
    setReviewStar: function (n) {
      H._bizShop._reviewStar = n;
      document.querySelectorAll('#reviewStars [data-star]').forEach(function(s) {
        s.style.color = parseInt(s.dataset.star) <= n ? '#F59E0B' : '#D1D5DB';
      });
    },
    openReviewModal: function (bizId) {
      H._bizShop._reviewStar = 0;
      if (document.getElementById('shopReviewModal')) return;
      const u = H.currentUser && H.currentUser();
      if (!u) { if (H.requireAuth) H.requireAuth('Sign in to leave a review'); return; }
      const ov = document.createElement('div');
      ov.id = 'shopReviewModal';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(16,24,40,.55);z-index:9600;display:flex;align-items:flex-end;justify-content:center';
      ov.innerHTML = '<div style="background:var(--card,#fff);border-radius:22px 22px 0 0;width:100%;max-width:520px;padding:22px 20px calc(30px + env(safe-area-inset-bottom));font-family:Inter,sans-serif">'
        + '<div style="width:40px;height:4px;border-radius:2px;background:var(--border,#E8ECF4);margin:0 auto 18px"></div>'
        + '<div style="font-size:17px;font-weight:800;color:var(--text);text-align:center;margin-bottom:4px">Write a Review</div>'
        + '<div style="font-size:12.5px;color:var(--sub);text-align:center;margin-bottom:18px">Tap a star to rate this shop</div>'
        + '<div id="reviewStars" style="display:flex;justify-content:center;gap:10px;margin-bottom:18px">'
        + [1,2,3,4,5].map(function(n){ return '<span onclick="H._bizShop.setReviewStar(' + n + ')" data-star="' + n + '" style="font-size:40px;cursor:pointer;color:#D1D5DB;line-height:1;transition:color .12s">&#9733;</span>'; }).join('')
        + '</div>'
        + '<textarea id="reviewComment" placeholder="Share your experience with this shop (optional)" style="width:100%;height:90px;border:1.5px solid var(--border,#E8ECF4);border-radius:10px;padding:12px;font-size:14px;color:var(--text);font-family:inherit;resize:none;outline:none;box-sizing:border-box;background:var(--bg,#F4F6FB);margin-bottom:14px;display:block"></textarea>'
        + '<div style="display:flex;gap:10px">'
        + '<button onclick="document.getElementById(\'shopReviewModal\').remove()" style="flex:1;padding:14px;border-radius:10px;border:1.5px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Cancel</button>'
        + '<button onclick="H.submitShopReview(\'' + escHtml(String(bizId)) + '\',H._bizShop._reviewStar,(document.getElementById(\'reviewComment\')||{}).value||\'\')" style="flex:2;padding:14px;border-radius:10px;background:#1A3A8F;color:#fff;border:none;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">Submit</button>'
        + '</div></div>';
      ov.addEventListener('click', function(e){ if (e.target === ov) ov.remove(); });
      document.body.appendChild(ov);
    },
    onSearch: function (id, v) {
      _shopQ = v || '';
      H.renderPage('BusinessShop', { id: id });
    },

    openFilterSheet: function (bizId) {
      const sheet = document.getElementById('actionSheet');
      const bg    = document.getElementById('sheetBg');
      if (!sheet || !bg) return;
      const b = getBiz(bizId);
      const domCat = b ? _shopDominantCat(b) : null;
      const sortOpts = [
        { id: 'default',    label: 'Default' },
        { id: 'newest',     label: 'Newest First' },
        { id: 'price_asc',  label: 'Price: Low to High' },
        { id: 'price_desc', label: 'Price: High to Low' }
      ];
      sheet.innerHTML = '<div class="sheet-header">Sort &amp; Filter</div>'
        + '<div style="padding:0 16px 8px;max-height:70vh;overflow-y:auto">'
        + '<div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">Sort by</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">'
        + sortOpts.map(function (s) {
            const active = _shopSort === s.id;
            return '<button onclick="H._bizShop._setSort(\'' + escHtml(bizId) + '\',\'' + s.id + '\')" style="padding:8px 14px;border-radius:8px;border:1.5px solid ' + (active ? '#1A3A8F' : 'var(--border,#E8ECF4)') + ';background:' + (active ? '#EEF2FB' : 'var(--card,#fff)') + ';color:' + (active ? '#1A3A8F' : 'var(--text)') + ';font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">' + s.label + '</button>';
          }).join('')
        + '</div>'
        + '<div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">Price range (USD)</div>'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">'
        + '<div style="flex:1;display:flex;align-items:center;gap:5px;background:var(--bg,#F3F5FA);border-radius:10px;padding:9px 12px"><span style="font-size:13px;font-weight:800;color:var(--sub)">$</span><input id="shopMinPrice" type="number" inputmode="decimal" min="0" placeholder="Min" value="' + escHtml(_shopMinPrice || '') + '" style="flex:1;border:none;outline:none;background:transparent;font-size:13px;font-family:inherit;width:100%;min-width:0"></div>'
        + '<span style="font-size:13px;color:var(--sub);flex-shrink:0">to</span>'
        + '<div style="flex:1;display:flex;align-items:center;gap:5px;background:var(--bg,#F3F5FA);border-radius:10px;padding:9px 12px"><span style="font-size:13px;font-weight:800;color:var(--sub)">$</span><input id="shopMaxPrice" type="number" inputmode="decimal" min="0" placeholder="Max" value="' + escHtml(_shopMaxPrice || '') + '" style="flex:1;border:none;outline:none;background:transparent;font-size:13px;font-family:inherit;width:100%;min-width:0"></div>'
        + '</div>'
        + _shopFilterAttrHtml(domCat)
        + '<div style="display:flex;gap:10px;padding-top:4px">'
        + '<button onclick="H._bizShop._clearFilters(\'' + escHtml(bizId) + '\')" style="flex:1;padding:13px;border-radius:10px;border:1.5px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Clear all</button>'
        + '<button onclick="H._bizShop._applyFilters(\'' + escHtml(bizId) + '\')" style="flex:2;padding:13px;border-radius:10px;border:none;background:#1A3A8F;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Apply</button>'
        + '</div>'
        + '</div>'
        + '<button class="sheet-close" onclick="H.closeSheet()">Cancel</button>';
      sheet.classList.add('open');
      bg.classList.add('open');
    },

    _setSort: function (bizId, sort) {
      _shopSort = sort;
      H.closeSheet();
      H.renderPage('BusinessShop', { id: bizId });
    },

    _applyFilters: function (bizId) {
      var minEl = document.getElementById('shopMinPrice');
      var maxEl = document.getElementById('shopMaxPrice');
      _shopMinPrice = minEl ? (minEl.value.trim() || '') : '';
      _shopMaxPrice = maxEl ? (maxEl.value.trim() || '') : '';
      var f = {};
      var condEl   = document.getElementById('shopFCondition'); if (condEl  && condEl.value)        f.condition = condEl.value;
      var genderEl = document.getElementById('shopFGender');    if (genderEl && genderEl.value)      f.gender    = genderEl.value;
      var sizeEl   = document.getElementById('shopFSize');      if (sizeEl  && sizeEl.value.trim())  f.size      = sizeEl.value.trim().toLowerCase();
      var brandEl  = document.getElementById('shopFBrand');     if (brandEl && brandEl.value.trim()) f.brand     = brandEl.value.trim().toLowerCase();
      var fuelEl   = document.getElementById('shopFFuel');      if (fuelEl  && fuelEl.value)         f.fuel      = fuelEl.value;
      var ymEl     = document.getElementById('shopFYearMin');   if (ymEl    && ymEl.value.trim())    f.yearMin   = ymEl.value.trim();
      var yxEl     = document.getElementById('shopFYearMax');   if (yxEl    && yxEl.value.trim())    f.yearMax   = yxEl.value.trim();
      _shopFilters = f;
      H.closeSheet();
      H.renderPage('BusinessShop', { id: bizId });
    },

    _clearFilters: function (bizId) {
      _shopSort = 'default'; _shopMinPrice = ''; _shopMaxPrice = ''; _shopFilters = {};
      H.closeSheet();
      H.renderPage('BusinessShop', { id: bizId });
    },

    _clearPrice: function (bizId) {
      _shopMinPrice = ''; _shopMaxPrice = '';
      H.renderPage('BusinessShop', { id: bizId });
    },

    _clearAttr: function (bizId, key) {
      _shopFilters = Object.assign({}, _shopFilters);
      if (key === 'year') { delete _shopFilters.yearMin; delete _shopFilters.yearMax; }
      else delete _shopFilters[key];
      H.renderPage('BusinessShop', { id: bizId });
    }
  };

  // ── PAGE: Browse / search businesses (storefront discovery) ──
  let _bizQ = '', _bizCat = 'all';

  H.fetchAllActiveBusinesses = async function () {
    const sb = window.supabase; if (!sb) return H.state.businesses || [];
    try {
      const { data, error } = await sb.from('businesses').select('id,owner_user_id,name,logo,cover,description,biz_type,category,phone,whatsapp,email,province,city,suburb,status,verification_level,featured_listing_ids,updated_at').eq('status', 'active').order('created_at', { ascending: false }).limit(20);
      if (error || !Array.isArray(data)) return H.state.businesses || [];
      const serverList = data.map(row => {
        const _cats = (row.category || '').split('|').filter(Boolean);
        return { id: row.id, ownerUserId: row.owner_user_id, name: row.name || '',
          logo: row.logo, cover: row.cover, description: row.description,
          bizType: row.biz_type || 'individual', category: _cats[0] || null, categories: _cats,
          phone: row.phone, whatsapp: row.whatsapp, email: row.email,
          province: row.province, city: row.city, suburb: row.suburb,
          status: row.status, verificationLevel: row.verification_level || 0,
          featuredListingIds: Array.isArray(row.featured_listing_ids) ? row.featured_listing_ids : [],
          updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0 };
      });
      if (typeof H.applyFeedUpdate === 'function') {
        H.applyFeedUpdate({ type: 'businesses_full', data: serverList }, 'poll');
      } else {
        H.state.businesses = H.state.businesses || [];
        serverList.forEach(function (mapped) {
          const i = H.state.businesses.findIndex(b => b.id === mapped.id);
          if (i >= 0) {
            var _prev = H.state.businesses[i];
            if (!mapped.logo && _prev.logo) mapped.logo = _prev.logo;
            if (!mapped.cover && _prev.cover) mapped.cover = _prev.cover;
            H.state.businesses[i] = Object.assign(_prev, mapped);
          } else H.state.businesses.push(mapped);
        });
        saveState();
      }
      return H.state.businesses;
    } catch (e) { return H.state.businesses || []; }
  };

  function bizSearchList() {
    const q = (_bizQ || '').toLowerCase().trim();
    let list = (H.state.businesses || []).filter(b => b.status === 'active');
    if (_bizCat !== 'all') list = list.filter(b => (b.categories && b.categories.length ? b.categories : (b.category ? [b.category] : [])).includes(_bizCat));
    if (q) list = list.filter(b => {
      const cats = b.categories && b.categories.length ? b.categories : (b.category ? [b.category] : []);
      const cn = cats.map(id => ((H.CATEGORIES.find(c => c.id === id) || {}).name || '')).join(' ').toLowerCase();
      if ((b.name || '').toLowerCase().indexOf(q) !== -1) return true;
      if ((b.description || '').toLowerCase().indexOf(q) !== -1) return true;
      if (cn.indexOf(q) !== -1) return true;
      if ((b.city || '').toLowerCase().indexOf(q) !== -1) return true;
      // Match any active listing this shop sells
      return (H.state.listings || []).some(function(l) {
        return l.status === 'active' &&
          (String(l.businessId) === String(b.id) || String(l.sellerId) === String(b.ownerUserId)) &&
          (l.title || '').toLowerCase().indexOf(q) !== -1;
      });
    });
    return list;
  }

  function bizSearchCards() {
    const list = bizSearchList();
    if (!list.length) return `<div style="text-align:center;color:var(--sub);font-size:13px;padding:36px 16px">No stores found. Try a different search.</div>`;
    return list.map(b => {
      const _bizCats = b.categories && b.categories.length ? b.categories : (b.category ? [b.category] : []);
      const catLabel = _bizCats.map(id => ((H.CATEGORIES.find(c => c.id === id) || {}).name || '')).filter(Boolean).join(' / ');
      const loc = [b.city, b.province].filter(Boolean).join(', ');
      const prods = (H.state.listings || []).filter(l => l.businessId === b.id && l.status === 'active').length;
      const verified = (b.verificationLevel || 0) >= 2;
      return `<div onclick="H.openBusinessShop('${b.id}')" style="display:flex;gap:12px;align-items:center;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:8px;padding:12px;margin:0 16px 10px;cursor:pointer">
        <div style="width:52px;height:52px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#1A3A8F,#2245b8);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;border:2px solid #fff;box-shadow:0 2px 8px rgba(26,58,143,0.15)">${b.logo ? `<img src="${escHtml(b.logo)}${b.logo.startsWith('data:') ? '' : '?v=' + (b._updatedAt||b.updatedAt||'')}" style="width:100%;height:100%;object-fit:cover">` : _shopIcon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:5px"><span style="font-size:14.5px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(b.name)}</span>${verified ? H.verifiedBadge(14) : ''}</div>
          <div style="font-size:12px;color:var(--sub);margin-top:2px">${catLabel ? escHtml(catLabel) : ''}${loc ? ' · ' + escHtml(loc) : ''}</div>
          <div style="font-size:11.5px;color:var(--sub2,#98A2B3);margin-top:3px">${prods} product${prods === 1 ? '' : 's'}</div>
        </div>
        <span style="color:#CBD2E0;font-size:18px">›</span>
      </div>`;
    }).join('');
  }

  pages.BusinessSearch = function () {
    const chip = (id, label) => `<button onclick="H._bizSearch.setCat('${id}')" style="flex-shrink:0;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${_bizCat === id ? '#1A3A8F' : 'var(--border,#E8ECF4)'};background:${_bizCat === id ? '#1A3A8F' : 'var(--card,#fff)'};color:${_bizCat === id ? '#fff' : 'var(--text)'}">${label}</button>`;
    return `<div class="page active">
      ${innerTopbar('Stores')}
      <div style="padding:12px 16px 8px">
        <div style="display:flex;align-items:center;gap:8px;background:var(--card,#fff);border:1.5px solid var(--border,#E8ECF4);border-radius:12px;padding:10px 14px">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--sub)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="bizSearchIn" value="${escHtml(_bizQ)}" oninput="H._bizSearch.onQuery(this.value)" placeholder="Search shops or products, e.g. iPhone, Furniture..." style="flex:1;border:none;outline:none;background:none;font-size:14px;color:var(--text);font-family:inherit">
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

    confirmDeleteShop(id) {
      const b = (H.state.businesses || []).find(function(x) { return x.id === id; });
      if (!b) return;
      const u = currentUser(); if (!u || b.ownerUserId !== u.id) { toast('Owner only'); return; }
      H.modal({
        title: 'Delete Your Shop',
        body: `Permanently delete <strong>${escHtml(b.name || 'your shop')}</strong>? All your shop data will be removed. This cannot be undone.`,
        confirmText: 'Delete Shop', danger: true,
        onConfirm: async function() {
          try {
            if (window.supabase) {
              const r = await window.supabase.from('businesses').delete().eq('id', id);
              if (r.error) throw r.error;
            }
            H.state.businesses = (H.state.businesses || []).filter(function(x) { return x.id !== id; });
            H.saveState();
            toast('Your shop has been deleted');
            H.navTo('Home');
          } catch(e) { toast('Could not delete shop'); }
        }
      });
    },

    toggleFeatured: function(listingId) {
      if (!_edit) return;
      _edit.featuredListingIds = _edit.featuredListingIds || [];
      var idx = _edit.featuredListingIds.indexOf(listingId);
      if (idx !== -1) {
        _edit.featuredListingIds.splice(idx, 1);
      } else if (_edit.featuredListingIds.length < 2) {
        _edit.featuredListingIds.push(listingId);
      } else {
        toast('You can feature up to 2 items');
        return;
      }
      renderPage('BusinessEditProfile');
    },

    setType(t) { collectEdit(); _edit.bizType = t; renderPage('BusinessEditProfile'); },
    toggleCategory(catId) {
      collectEdit();
      _edit.categories = _edit.categories || [];
      const idx = _edit.categories.indexOf(catId);
      if (idx >= 0) {
        _edit.categories.splice(idx, 1);
      } else {
        const check = typeof H.bizCatCompat === 'function' ? H.bizCatCompat(_edit.categories, catId) : { ok: true };
        if (!check.ok) { toast(check.msg); return; }
        _edit.categories.push(catId);
      }
      renderPage('BusinessEditProfile');
    },
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

      const updCategories = e.categories && e.categories.length ? e.categories.slice() : [];
      Object.assign(b, {
        name: e.name, description: e.description, bizType: e.bizType, phone: e.phone,
        whatsapp: e.whatsapp, email: e.email, province: e.province, city: e.city,
        suburb: e.suburb, logo: e.logo, cover: e.cover,
        categories: updCategories, category: updCategories[0] || null,
        featuredListingIds: e.featuredListingIds ? e.featuredListingIds.slice() : [], updatedAt: Date.now()
      });
      saveState();
      try { if (typeof H.saveBusinessToCloud === 'function') await H.saveBusinessToCloud(b); } catch (e) { console.warn('saveBusinessToCloud:', e.message); }
      toast('Profile saved');
      _edit = null;
      renderPage('BusinessView', { id: b.id });
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
    H._followInFlight = H._followInFlight || {};
    if (H._followInFlight[id]) return;
    H._followInFlight[id] = true;
    H.state.followedBusinesses = H.state.followedBusinesses || [];
    const b = getBiz(id);
    const sb = window.supabase;
    const wasFollowing = H.isFollowingBusiness(id);
    const prevCount = b ? (b.followerCount || 0) : 0;

    // Optimistic update
    if (wasFollowing) {
      H.state.followedBusinesses = H.state.followedBusinesses.filter(x => x !== id);
      if (b) b.followerCount = Math.max(0, prevCount - 1);
    } else {
      H.state.followedBusinesses.push(id);
      if (b) b.followerCount = prevCount + 1;
      try { if (b && b.ownerUserId && b.ownerUserId !== u.id && H.pushNotif) H.pushNotif(b.ownerUserId, 'New follower', (u.name || 'Someone') + ' followed ' + (b.name || 'your business'), 'info', null, 'BusinessView'); } catch (e) {}
    }
    saveState();

    function _applyFollowUI() {
      const f = H.isFollowingBusiness(id);
      const btn = document.getElementById('bizFollowBtn');
      if (btn) { btn.textContent = f ? 'Following' : 'Follow'; btn.style.cssText = 'flex-shrink:0;border-radius:20px;padding:9px 18px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;' + (f ? 'background:var(--bg,#EEF2FB);color:#1A3A8F;border:1.5px solid #1A3A8F' : 'background:#1A3A8F;color:#fff;border:none'); }
      const bsBtn = document.getElementById('bsFollowBtn');
      if (bsBtn) { bsBtn.textContent = f ? 'Following' : 'Follow Shop'; bsBtn.style.cssText = 'flex-shrink:0;padding:9px 16px;border-radius:8px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:.2px;' + (f ? 'background:var(--bg,#EEF2FB);color:#1A3A8F;border:1.5px solid #1A3A8F' : 'background:#1A3A8F;color:#fff;border:none'); }
      const cnt = document.getElementById('bizFollowerCount');
      if (cnt && b) cnt.textContent = b.followerCount || 0;
    }
    _applyFollowUI();

    function _rollback() {
      if (wasFollowing) {
        if (H.state.followedBusinesses.indexOf(id) === -1) H.state.followedBusinesses.push(id);
      } else {
        H.state.followedBusinesses = H.state.followedBusinesses.filter(x => x !== id);
      }
      if (b) b.followerCount = prevCount;
      saveState();
      _applyFollowUI();
      H._followInFlight[id] = false;
    }

    if (sb) {
      if (wasFollowing) {
        sb.from('business_followers').delete().eq('business_id', id).eq('user_id', u.id)
          .then(function(res) { if (res && res.error) _rollback(); else H._followInFlight[id] = false; }, _rollback);
      } else {
        // ignoreDuplicates generates ON CONFLICT DO NOTHING — no UPDATE RLS needed.
        sb.from('business_followers').upsert({ business_id: id, user_id: u.id }, { onConflict: 'business_id,user_id', ignoreDuplicates: true })
          .then(function(res) { if (res && res.error) _rollback(); else H._followInFlight[id] = false; }, _rollback);
      }
    } else {
      H._followInFlight[id] = false;
    }
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
