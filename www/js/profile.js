/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;

  const activeCount = uid => (H.state.listings || []).filter(l => l.sellerId === uid && l.status === 'active').length;
  const soldCount   = uid => (H.state.listings || []).filter(l => l.sellerId === uid && l.status === 'sold').length;

  const IC = {
    pencil: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/><line x1="15" y1="5" x2="19" y2="9"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    star:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    phone:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg>',
    idCard: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M10 14h4"/><circle cx="10" cy="17" r="1"/></svg>',
    check:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
    alert:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  const starFill  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const starEmpty = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const stars = n => Array.from({length:5}, (_,i) => i < Math.round(n) ? starFill : starEmpty).join('');

  pages.Profile = function (params) {
    const viewId = params && params.id;
    const u = viewId
      ? (H.state.users || []).find(x => x.id === viewId)
      : H.currentUser();

    if (!u) return H.emptyState('Not logged in', 'Please sign in to continue', 'Sign In', "H.authPage()");

    const isOwn      = !viewId || (H.currentUser() && viewId === H.currentUser().id);
    const uPrivacy   = u.privacySettings || {};
    const verified   = u.verified
      ? `<span class="verified">${IC.check} Verified</span>`
      : `<span class="unverified">${IC.alert} Not Verified</span>`;
    const avgRating  = (u.ratings && u.ratings.length)
      ? (u.ratings.reduce((a,b) => a+b, 0) / u.ratings.length).toFixed(1) : '0';
    const ratingCount = u.ratings ? u.ratings.length : 0;
    const showActivityDot = uPrivacy.showActivity === true;

    return `<div class="page active">
      ${H.innerTopbar(isOwn ? 'My Profile' : H.escHtml(u.name))}
      <div class="profile-hero">
        <div class="profile-pic" style="position:relative">
          ${u.avatar
            ? `<img src="${u.avatar}" alt="${H.escHtml(u.name)}">`
            : `<div class="profile-initials">${H.initials(u.name)}</div>`}
          ${showActivityDot ? `<div style="position:absolute;bottom:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid var(--card,#fff)"></div>` : ''}
        </div>
        <div class="profile-info">
          <div class="profile-name">${H.escHtml(u.name || 'User')}</div>
          <div class="profile-phone">${IC.phone} ${H.escHtml(u.phone || 'No phone')}</div>
          <div class="profile-status">${verified}</div>
          ${isOwn && uPrivacy.profilePublic === false ? `<div style="display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:4px 10px;background:#fef3c7;border:1px solid #fcd34d;border-radius:20px;font-size:11px;font-weight:700;color:#92400e"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Your profile is set to private</div>` : ''}
        </div>
      </div>

      <div class="profile-stats">
        <div class="stat-box"><div class="stat-val">${activeCount(u.id)}</div><div class="stat-label">Active Ads</div></div>
        <div class="stat-box"><div class="stat-val">${avgRating}</div><div class="stat-label">Rating (${ratingCount})</div></div>
        <div class="stat-box"><div class="stat-val">${soldCount(u.id)}</div><div class="stat-label">Sold</div></div>
      </div>

      ${isOwn ? `
      <div class="form-wrap">
        <button class="btn-pri" onclick="H.openInner('EditProfile')">${IC.pencil} Edit Profile</button>
        <button class="btn-sec" onclick="H.openInner('ProfileVerify')">${IC.shield} Verify Identity</button>
        <button class="btn-sec" onclick="H.openInner('Reviews')">${IC.star} Reviews & Ratings</button>
      </div>` : `
      <div class="form-wrap">
        ${uPrivacy.allowMessages === false
          ? `<button class="btn-pri" disabled style="opacity:0.5;cursor:not-allowed">Messaging turned off</button>`
          : `<button class="btn-pri" onclick="H.startChatWith('${u.id}', null)">Message ${H.escHtml(u.name)}</button>`}
        <button class="btn-sec" onclick="H.reportUser('${u.id}')">Report User</button>
      </div>`}

      <div class="section-box">
        <div class="section-title">Account Info</div>
        <div class="info-row"><span class="info-label">Email</span><span class="info-val">${H.escHtml(u.email || 'N/A')}</span></div>
        <div class="info-row"><span class="info-label">Joined</span><span class="info-val">${new Date(u.joinedAt || u.createdAt || Date.now()).toLocaleDateString()}</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="info-val">${H.escHtml(u.status || 'Active')}</span></div>
        ${u.bio ? `<div class="info-row"><span class="info-label">Bio</span><span class="info-val">${H.escHtml(u.bio)}</span></div>` : ''}
      </div>

      <div class="section-box">
        <div class="section-title">Active Listings</div>
        <div class="listing-list">
          ${(H.state.listings || []).filter(l => l.sellerId === u.id && l.status === 'active').slice(0,6).map(H.renderListCard).join('')
            || '<div style="color:var(--sub);padding:16px;font-size:13px">No active listings</div>'}
        </div>
      </div>
      <div style="height:24px"></div>
    </div>`;
  };

  pages.EditProfile = function () {
    const u = H.currentUser();
    if (!u) return H.emptyState('Not logged in', 'Please sign in');

    return `<div class="page active">
      ${H.innerTopbar('Edit Profile')}
      <div class="form-wrap">
        <div style="display:flex;flex-direction:column;align-items:center;padding:8px 0 16px">
          <div style="width:80px;height:80px;border-radius:50%;overflow:hidden;background:#1A3A8F14;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#1A3A8F;margin-bottom:10px;border:2.5px solid #1A3A8F22">
            ${u.avatar ? `<img id="avatarPreview" src="${H.escHtml(u.avatar)}" style="width:100%;height:100%;object-fit:cover">` : `<span id="avatarPreview">${H.initials(u.name)}</span>`}
          </div>
          <label for="profilePicFile" style="font-size:13px;font-weight:600;color:#1A3A8F;cursor:pointer;background:#1A3A8F14;padding:7px 16px;border-radius:20px">Change Photo</label>
          <input type="file" id="profilePicFile" accept="image/*" capture="user" style="display:none" onchange="H._editProfile.onPicChange(event)">
        </div>
        <div class="fg"><div class="fl">Full Name <span style="color:#EF4444">*</span></div>
          <input class="fi" id="editName" value="${H.escHtml(u.name || '')}" placeholder="Your full name" maxlength="60">
        </div>
        <div class="fg"><div class="fl">Phone Number</div>
          <input class="fi" id="editPhone" value="${H.escHtml(u.phone || '')}" placeholder="+263 77 123 4567" type="tel" maxlength="16">
          <div style="font-size:11px;color:var(--sub);margin-top:4px">International format, e.g. +263 77 123 4567</div>
        </div>
        <div class="fg"><div class="fl">Email</div>
          <input class="fi" value="${H.escHtml(u.email || '')}" disabled style="opacity:.6;cursor:not-allowed">
          <div style="font-size:11px;color:var(--sub);margin-top:4px">Email cannot be changed here</div>
        </div>
        <div class="fg"><div class="fl">Bio</div>
          <textarea class="fi" rows="3" id="editBio" placeholder="Tell buyers about yourself..." maxlength="200">${H.escHtml(u.bio || '')}</textarea>
        </div>
        <div id="editSaveMsg" style="display:none;font-size:13px;color:#16A34A;text-align:center;padding:8px 0;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#16A34A" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Saved!</div>
        <div id="editErrMsg"  style="display:none;font-size:13px;color:#EF4444;text-align:center;padding:8px 0"></div>
        <div class="btn-group">
          <button id="editSaveBtn" class="btn-pri" onclick="H._editProfile.save()">Save Changes</button>
          <button class="btn-sec" onclick="H.openInner('ChangePassword')">Change Password</button>
          <button class="btn-sec" onclick="H.goBack()">Cancel</button>
        </div>
        <div style="border-top:1px solid var(--border);margin-top:20px;padding-top:16px">
          <div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Danger Zone</div>
          <button onclick="H._editProfile.deleteCV()" style="width:100%;padding:13px;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;color:#DC2626;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px">Delete My CV / Candidate Profile</button>
          <button onclick="H._editProfile.deleteAccount()" style="width:100%;padding:13px;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;color:#DC2626;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#DC2626" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Delete Account</button>
        </div>
      </div>
    </div>`;
  };

  pages.EditProfile_after = function () {
    H._editProfile = {
      onPicChange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { H.toast('Photo must be under 3 MB'); return; }
        const compressed = await H.compressImage(file, 400, 0.82);
        const u = H.currentUser();
        u.avatar = compressed;
        H.saveState();
        const prev = document.getElementById('avatarPreview');
        if (prev) { prev.outerHTML = `<img id="avatarPreview" src="${compressed}" style="width:100%;height:100%;object-fit:cover">`; }
      },
      save: async () => {
        const u = H.currentUser();
        const name  = (document.getElementById('editName')?.value || '').trim();
        const phone = (document.getElementById('editPhone')?.value || '').trim();
        const bio   = (document.getElementById('editBio')?.value || '').trim();
        const btn   = document.getElementById('editSaveBtn');
        const errEl = document.getElementById('editErrMsg');
        const okEl  = document.getElementById('editSaveMsg');
        const showErr = (msg) => { if(errEl){errEl.textContent=msg;errEl.style.display='';} H.toast(msg); };
        if (!name || name.length < 2) { showErr('Please enter your full name (min 2 characters)'); return; }
        if (phone && !/^\+?[0-9\s\-]{7,16}$/.test(phone)) { showErr('Phone number looks invalid. Use format: +263 77 123 4567'); return; }
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
        if (errEl) errEl.style.display = 'none';
        u.name  = name;
        if (phone) u.phone = phone;
        u.bio   = bio;
        H.saveState();
        const c = window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null;
        if (c) {
          const res = await c.from('profiles').upsert({ id: u.id, name: u.name, phone: u.phone || null, bio: u.bio || null, avatar: u.avatar || null, updated_at: new Date().toISOString() });
          if (res && res.error) console.warn('Profile sync failed:', res.error.message);
        }
        if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
        if (okEl) { okEl.style.display = ''; setTimeout(() => { if(okEl) okEl.style.display='none'; }, 2500); }
        H.toast('Profile updated!');
      },
      deleteCV() {
        H.modal({
          title: 'Delete CV / Candidate Profile?',
          body: 'This will permanently remove your professional profile and CV from PaMarket. Your listings will not be affected.',
          confirmText: 'Delete CV',
          cancelText: 'Cancel',
          danger: true,
          onConfirm() {
            const u = H.currentUser();
            if (!u) return;
            delete u.cv;
            delete u.jobTitle;
            delete u.skills;
            H.saveState();
            if (window.supabase && typeof window.supabase.from === 'function') {
              window.supabase.from('profiles').update({ cv: null, job_title: null, skills: null }, { returning: 'minimal' }).eq('id', u.id).catch(() => {});
            }
            H.toast('CV deleted');
            H.renderPage('EditProfile');
          },
        });
      },
      deleteAccount() {
        H.modal({
          title: 'Delete Account?',
          body: `<div style="font-size:14px;color:var(--text);line-height:1.7">
            <p style="margin:0 0 10px;color:#DC2626;font-weight:700;display:flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#DC2626" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> This cannot be undone.</p>
            <p style="margin:0 0 8px">All your listings, messages, and profile data will be permanently removed.</p>
            <p style="margin:0">Type <strong>DELETE</strong> below to confirm:</p>
            <input id="deleteConfirmInput" class="fi" style="margin-top:10px" placeholder="Type DELETE">
          </div>`,
          confirmText: 'Delete My Account',
          cancelText: 'Cancel',
          danger: true,
          onConfirm() {
            const inp = document.getElementById('deleteConfirmInput');
            if (!inp || inp.value.trim() !== 'DELETE') { H.toast('Type DELETE to confirm'); return; }
            const u = H.currentUser();
            if (!u) return;
            H.state.listings = (H.state.listings || []).filter(l => l.sellerId !== u.id);
            H.state.conversations = (H.state.conversations || []).filter(c => !(c.members || []).includes(u.id));
            H.state.users = (H.state.users || []).filter(x => x.id !== u.id);
            H.state.currentUserId = null;
            H.saveState();
            if (window.supabase && window.supabase.auth) {
              window.supabase.auth.signOut().catch(() => {}).finally(() => window.location.reload());
            } else {
              window.location.reload();
            }
          },
        });
      },
    };
  };

  pages.MyListings = function () {
    const u = H.currentUser();
    if (!u) return H.emptyState('Not logged in', 'Please sign in');
    const all      = (H.state.listings || []).filter(l => l.sellerId === u.id);
    const active   = all.filter(l => l.status === 'active');
    const pending  = all.filter(l => l.status === 'pending');
    const sold     = all.filter(l => l.status === 'sold');
    const rejected = all.filter(l => l.status === 'rejected');
    const btn = (label, fn, c, bg, bo) =>
      `<button onclick="${fn}" style="flex:1;padding:8px 2px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;background:${bg};color:${c};border:1.5px solid ${bo};font-family:inherit;white-space:nowrap">${label}</button>`;
    const actionBars = {
      active:   (id) => { const l=(H.state.listings||[]).find(x=>x.id===id); const isJob=l&&l.cat==='jobs'; return btn('Edit',`H._myListings.edit('${id}')`,'#1A3A8F','#EFF6FF','#BFDBFE')+btn(isJob?'Mark Filled':'Mark Sold',`H._myListings.markSold('${id}')`,'#16a34a','#dcfce7','#bbf7d0')+btn('Delete',`H._myListings.del('${id}')`,'#ef4444','#fef2f2','#fecaca'); },
      pending:  (id) => btn('Edit',`H._myListings.edit('${id}')`,'#1A3A8F','#EFF6FF','#BFDBFE')+btn('Delete',`H._myListings.del('${id}')`,'#ef4444','#fef2f2','#fecaca'),
      sold:     (id) => btn('Post Again',`H._myListings.reactivate('${id}')`,'#1A3A8F','#EFF6FF','#BFDBFE')+btn('Delete',`H._myListings.del('${id}')`,'#ef4444','#fef2f2','#fecaca'),
      rejected: (id) => btn('Edit & Resubmit',`H._myListings.edit('${id}')`,'#D97706','#FFFBEB','#FDE68A')+btn('Delete',`H._myListings.del('${id}')`,'#ef4444','#fef2f2','#fecaca'),
    };
    const myCard = (l, status) => `<div style="margin-bottom:14px">${H.renderListCard(l)}<div style="display:flex;gap:6px;margin-top:6px">${(actionBars[status]||actionBars.active)(l.id)}</div></div>`;
    const section = (list, label, status) => list.length
      ? `<div style="padding:12px">${list.map(l => myCard(l, status)).join('')}</div>`
      : `<div style="color:var(--sub);padding:32px 20px;text-align:center;font-size:13px">No ${label.toLowerCase()} listings</div>`;
    return `<div class="page active">
      ${H.innerTopbar('My Listings')}
      <div class="listing-tabs">
        <button class="tab active" data-tab="active">Active (${active.length})</button>
        <button class="tab" data-tab="pending">Pending (${pending.length})</button>
        <button class="tab" data-tab="sold">Sold / Filled (${sold.length})</button>
        <button class="tab" data-tab="rejected">Rejected (${rejected.length})</button>
      </div>
      <div class="tabs-content">
        <div class="tab-content active" data-tab="active">${section(active,'Active','active')}</div>
        <div class="tab-content" data-tab="pending">${section(pending,'Pending','pending')}</div>
        <div class="tab-content" data-tab="sold">${section(sold,'Sold / Filled','sold')}</div>
        <div class="tab-content" data-tab="rejected">${section(rejected,'Rejected','rejected')}</div>
      </div>
      <div style="height:24px"></div>
    </div>`;
  };

  pages.MyListings_after = function () {
    document.querySelectorAll('.listing-tabs .tab').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.listing-tabs .tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        const el = document.querySelector(`.tab-content[data-tab="${e.target.dataset.tab}"]`);
        if (el) el.classList.add('active');
      });
    });
    H._myListings = {
      edit: (id) => { const l=(H.state.listings||[]).find(x=>x.id===id); H.openInner(l&&l.cat==='jobs'?'EditJob':'EditListing',{listingId:id}); },
      markSold: (id) => { const l=(H.state.listings||[]).find(x=>x.id===id); if(!l)return; l.status='sold'; l.soldAt=Date.now(); H.saveState(); if(window.supabase&&typeof window.supabase.from==='function') window.supabase.from('listings').update({status:'sold'}).eq('id',id); H.toast(l.cat==='jobs' ? 'Job marked as filled' : 'Listing marked as sold'); H.renderPage('MyListings'); },
      del: (id) => { if(!window.confirm('Delete this listing permanently?'))return; H.state.listings=(H.state.listings||[]).filter(x=>x.id!==id); H.saveState(); H.toast('Listing deleted'); H.renderPage('MyListings'); },
      reactivate: (id) => { const l=(H.state.listings||[]).find(x=>x.id===id); if(!l)return; l.status='active'; delete l.soldAt; l.renewedAt=Date.now(); H.saveState(); if(window.supabase&&typeof window.supabase.from==='function') window.supabase.from('listings').update({status:'active'}).eq('id',id); H.toast(l.cat==='jobs' ? 'Job reopened!' : 'Listing reactivated!'); H.renderPage('MyListings'); },
    };
  };

  pages.EditListing = function (params) {
    const id = params && params.listingId;
    const l  = id ? (H.state.listings || []).find(x => x.id === id) : null;
    if (!l) return `<div class="page active">${H.innerTopbar('Edit Listing')}${H.emptyState('Listing not found','')}</div>`;
    return `<div class="page active">
      ${H.innerTopbar('Edit Listing')}
      <div class="form-wrap">
        <div class="fg"><div class="fl">Title</div><input class="fi" id="elTitle" value="${H.escHtml(l.title || '')}" placeholder="Listing title" maxlength="80"></div>
        <div class="fg"><div class="fl">Price (USD)</div><input class="fi" id="elPrice" type="number" min="0" value="${H.escHtml(String(l.price || ''))}" placeholder="0"></div>
        <div class="fg"><div class="fl">Description</div><textarea class="fi" id="elDesc" rows="5" placeholder="Describe your item...">${H.escHtml(l.description || '')}</textarea></div>
        <div id="elErr" style="display:none;color:#ef4444;font-size:13px;font-weight:600;padding:6px 0"></div>
        <button id="elSaveBtn" class="btn-pri" onclick="H._editListing.save('${id}')">Save Changes</button>
        <button class="btn-sec" onclick="H.goBack()">Cancel</button>
      </div>
    </div>`;
  };

  pages.EditListing_after = function () {
    H._editListing = {
      save: (id) => {
        const title = document.getElementById('elTitle')?.value.trim();
        const price = parseFloat(document.getElementById('elPrice')?.value);
        const desc  = document.getElementById('elDesc')?.value.trim();
        const errEl = document.getElementById('elErr');
        const btn   = document.getElementById('elSaveBtn');
        const showErr = (m) => { if(errEl){errEl.textContent=m;errEl.style.display='';} };
        if (!title) { showErr('Title is required'); return; }
        if (isNaN(price) || price < 0) { showErr('Enter a valid price'); return; }
        if (!desc) { showErr('Description is required'); return; }
        const l = (H.state.listings || []).find(x => x.id === id);
        if (!l) { showErr('Listing not found'); return; }
        l.title=title; l.price=price; l.description=desc; l.updatedAt=Date.now();
        if (l.status === 'rejected') l.status = 'pending';
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
        H.saveState();
        H.toast('Listing updated!');
        H.goBack();
      }
    };
  };

  pages.Favorites = function () {
    const u = H.currentUser();
    if (!u) return H.emptyState('Not logged in', 'Please sign in');
    const saved = (H.state.saves && H.state.saves[u.id]) || [];
    const list  = (H.state.listings || []).filter(l => saved.includes(l.id) && l.status === 'active');
    const savedCard = (l) =>
      `<div style="margin-bottom:14px">
        ${H.renderListCard(l)}
        <div style="display:flex;gap:6px;margin-top:6px">
          <button onclick="H._favorites.unsave('${l.id}')" style="flex:1;padding:9px 4px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:#fef2f2;color:#ef4444;border:1.5px solid #fecaca;font-family:inherit">Remove</button>
          <button onclick="H.openListing('${l.id}')" style="flex:2;padding:9px 4px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:#EFF6FF;color:#1A3A8F;border:1.5px solid #BFDBFE;font-family:inherit">View Listing</button>
        </div>
      </div>`;
    return `<div class="page active">
      ${H.innerTopbar(list.length ? `Saved & Favorites (${list.length})` : 'Saved & Favorites')}
      <div style="padding:14px">
        ${list.length ? list.map(savedCard).join('') : H.emptyState('No saved listings', 'Tap the heart on any listing to save it', 'Browse', "H.navTo('Browse')")}
      </div>
      <div style="height:24px"></div>
    </div>`;
  };

  pages.Favorites_after = function () {
    H._favorites = {
      unsave: (id) => {
        const u = H.currentUser(); if (!u) return;
        H.state.saves = H.state.saves || {};
        H.state.saves[u.id] = (H.state.saves[u.id] || []).filter(sid => sid !== id);
        H.saveState();
        H.toast('Removed from saved');
        H.renderPage('Favorites');
      }
    };
  };

  pages.ProfileVerify = function () {
    const u = H.currentUser();
    if (!u) return H.emptyState('Not logged in', 'Please sign in');
    if (u.verified) return `<div class="page active">${H.innerTopbar('Identity Verification')}<div class="section-box" style="text-align:center;padding:32px 20px"><div style="margin-bottom:12px;display:flex;justify-content:center"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px">Identity Verified</div><div style="font-size:14px;color:var(--sub)">You have a verified badge on all your listings.</div><div style="font-size:12px;color:var(--sub);margin-top:8px">Verified on ${new Date(u.verifiedAt || Date.now()).toLocaleDateString()}</div></div></div>`;
    if (u.verificationPending) return `<div class="page active">${H.innerTopbar('Identity Verification')}<div class="section-box" style="text-align:center;padding:32px 20px"><div style="margin-bottom:12px;display:flex;justify-content:center"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#fbbf24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px">Verification Pending</div><div style="font-size:14px;color:var(--sub)">Your request is under review. We will notify you within 24 hours.</div><button onclick="H._profileVerify.cancelPending()" style="margin-top:18px;padding:10px 28px;background:var(--bg);color:var(--sub);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel request</button></div></div>`;
    return `<div class="page active">
      ${H.innerTopbar('Verify Identity')}
      <div class="section-box" style="text-align:center;padding:20px 20px 14px">
        <div style="margin-bottom:10px;display:flex;justify-content:center"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px">Identity Verification</div>
        <div style="font-size:13px;color:var(--sub)">Submit your ID and a selfie. Review takes up to 24 hours.</div>
      </div>
      <div class="form-wrap">
        <div class="fg"><div class="fl">ID Type</div><select class="fi" id="idType"><option>National ID</option><option>Passport</option><option>Driver&#39;s License</option></select></div>
        <div class="fg"><div class="fl">ID Number</div><input class="fi" id="idNum" placeholder="Enter your ID number"></div>
        <div class="fg">
          <div class="fl">Selfie Photo <span style="font-weight:400;color:var(--sub);font-size:11px">(center your face in the oval)</span></div>
          <div style="position:relative;width:220px;height:280px;margin:0 auto 10px;border-radius:14px;overflow:hidden;background:#111">
            <div id="selfiePH" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1a1a2e;gap:8px">
              <div style="display:flex;justify-content:center"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
              <div style="font-size:12px;color:rgba(255,255,255,.65);text-align:center;padding:0 16px">Tap Camera or Upload to add your selfie</div>
            </div>
            <video id="selfieVid" autoplay playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none;transform:scaleX(-1)"></video>
            <canvas id="selfieCanvas" style="display:none"></canvas>
            <div id="selfiePrev" style="display:none;position:absolute;inset:0"><img id="selfieImg" style="width:100%;height:100%;object-fit:cover"></div>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
              <div style="width:130px;height:170px;border-radius:50%;border:3px solid rgba(255,255,255,.88);box-shadow:0 0 0 9999px rgba(0,0,0,.48)"></div>
            </div>
          </div>
          <div style="display:flex;gap:8px;max-width:220px;margin:0 auto">
            <button id="selfieStartBtn" onclick="H._profileVerify.startCamera()" style="flex:1;padding:10px;background:#1A3A8F;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg> Camera</button>
            <button id="selfieCapBtn" onclick="H._profileVerify.captureSelfie()" style="display:none;flex:1;padding:10px;background:#059669;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;align-items:center;justify-content:center;gap:4px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Capture</button>
            <button id="selfieRetakeBtn" onclick="H._profileVerify.retakeSelfie()" style="display:none;flex:1;padding:10px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;align-items:center;justify-content:center;gap:4px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg> Retake</button>
            <label for="selfieFile" style="flex:1;display:flex;align-items:center;justify-content:center;padding:10px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;cursor:pointer">Upload</label>
            <input type="file" id="selfieFile" accept="image/*" capture="user" style="display:none" onchange="H._profileVerify.handleSelfieFile(this)">
          </div>
        </div>
        <div class="fg"><div class="fl">ID Photo (Front)</div>
          <label class="img-upload-zone" for="idPhotoFront"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><div class="img-upload-title" id="idPhotoLabel">Upload front of ID</div><div class="img-upload-sub">National ID, Passport or Driver&#39;s License</div></label>
          <input type="file" id="idPhotoFront" accept="image/*" capture="environment" style="display:none" onchange="H._profileVerify.previewIdPhoto(this)">
        </div>
        <button class="btn-pri" onclick="H._profileVerify.submit()">Submit for Verification</button>
      </div>
    </div>`;
  };

  pages.ProfileVerify_after = function () {
    H._profileVerify = {
      _stream: null,
      _selfieData: null,

      startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          H.toast('Camera not available — please upload a selfie photo.');
          return;
        }
        const btn = document.getElementById('selfieStartBtn');
        if (btn) btn.style.display = 'none';
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } } })
          .then(stream => {
            this._stream = stream;
            const vid = document.getElementById('selfieVid');
            const ph  = document.getElementById('selfiePH');
            const cap = document.getElementById('selfieCapBtn');
            if (vid) { vid.srcObject = stream; vid.style.display = 'block'; }
            if (ph)  ph.style.display = 'none';
            if (cap) cap.style.display = 'flex';
          })
          .catch(() => {
            H.toast('Camera permission denied — use Upload instead.');
            const btn2 = document.getElementById('selfieStartBtn');
            if (btn2) btn2.style.display = 'flex';
          });
      },

      captureSelfie() {
        const vid    = document.getElementById('selfieVid');
        const canvas = document.getElementById('selfieCanvas');
        if (!vid || !canvas) return;
        canvas.width  = vid.videoWidth  || 480;
        canvas.height = vid.videoHeight || 640;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(vid, 0, 0);
        this._selfieData = canvas.toDataURL('image/jpeg', 0.85);
        if (this._stream) { this._stream.getTracks().forEach(t => t.stop()); this._stream = null; }
        vid.style.display = 'none';
        const prev    = document.getElementById('selfiePrev');
        const img     = document.getElementById('selfieImg');
        const capBtn  = document.getElementById('selfieCapBtn');
        const retake  = document.getElementById('selfieRetakeBtn');
        if (prev)   prev.style.display = 'block';
        if (img)    img.src = this._selfieData;
        if (capBtn) capBtn.style.display = 'none';
        if (retake) retake.style.display = 'flex';
        H.toast('Selfie captured');
      },

      retakeSelfie() {
        this._selfieData = null;
        const prev   = document.getElementById('selfiePrev');
        const retake = document.getElementById('selfieRetakeBtn');
        if (prev)   prev.style.display = 'none';
        if (retake) retake.style.display = 'none';
        this.startCamera();
      },

      handleSelfieFile(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          this._selfieData = e.target.result;
          const ph      = document.getElementById('selfiePH');
          const vid     = document.getElementById('selfieVid');
          const prev    = document.getElementById('selfiePrev');
          const img     = document.getElementById('selfieImg');
          const startBtn = document.getElementById('selfieStartBtn');
          const capBtn  = document.getElementById('selfieCapBtn');
          const retake  = document.getElementById('selfieRetakeBtn');
          if (ph)       ph.style.display = 'none';
          if (vid)      vid.style.display = 'none';
          if (prev)     prev.style.display = 'block';
          if (img)      img.src = this._selfieData;
          if (startBtn) startBtn.style.display = 'none';
          if (capBtn)   capBtn.style.display = 'none';
          if (retake)   retake.style.display = 'flex';
        };
        reader.readAsDataURL(file);
      },

      previewIdPhoto(input) {
        const label = document.getElementById('idPhotoLabel');
        if (input.files && input.files[0] && label) label.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg> ID photo selected';
      },

      async submit() {
        const idType = document.getElementById('idType')?.value || 'National ID';
        const idNum  = (document.getElementById('idNum')?.value || '').trim();
        if (!idNum) { H.toast('Please enter your ID number'); return; }
        if (!this._selfieData) { H.toast('Please take or upload a selfie photo'); return; }
        if (this._stream) { this._stream.getTracks().forEach(t => t.stop()); this._stream = null; }
        const btn = document.querySelector('.btn-pri[onclick="H._profileVerify.submit()"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
        const u = H.currentUser();
        const sb = window.supabase;

        const doSubmit = async (idDocData) => {
          try {
            if (!sb) throw new Error('Not connected to server');
            const { error: vErr } = await sb.from('verifications').upsert({
              user_id: u.id,
              id_doc: idDocData || null,
              selfie: this._selfieData,
              status: 'pending',
              submitted_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            if (vErr) throw vErr;
            const { error: pErr } = await sb.from('profiles').update({
              verification_pending: true,
              updated_at: new Date().toISOString()
            }).eq('id', u.id);
            if (pErr) throw pErr;
            u.verificationPending    = true;
            u.verification_pending   = true;
            u.verificationIdType     = idType;
            u.verificationIdNum      = idNum;
            H.saveState();
            H.toast('Verification submitted! Admin will review within 24 hours.');
            H.goBack();
          } catch (e) {
            if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
            H.toast('Failed to submit: ' + (e.message || 'Check your connection'));
          }
        };

        const idFile = document.getElementById('idPhotoFront');
        if (idFile && idFile.files && idFile.files[0]) {
          const reader = new FileReader();
          reader.onload = e => doSubmit(e.target.result);
          reader.readAsDataURL(idFile.files[0]);
        } else {
          doSubmit(null);
        }
      },

      async cancelPending() {
        const u = H.currentUser();
        u.verificationPending  = false;
        u.verification_pending = false;
        H.saveState();
        const sb = window.supabase;
        if (sb) {
          await sb.from('profiles').update({ verification_pending: false }).eq('id', u.id);
          await sb.from('verifications').delete().eq('user_id', u.id);
        }
        H.toast('Verification request cancelled');
        H.renderPage('ProfileVerify');
      }
    };
  };

  pages.Reviews = function (params) {
    const viewId = params && params.id;
    const me = H.currentUser();
    const u  = viewId ? (H.state.users || []).find(x => x.id === viewId) : me;
    if (!u) return '<div class="page active">' + H.innerTopbar('Reviews') + H.emptyState('User not found', '', null, null) + '</div>';
    const isOwn = !viewId || (me && viewId === me.id);
    const reviews = u.reviews || [];
    const avg = reviews.length ? (reviews.reduce((a,r) => a + (r.rating||0), 0) / reviews.length).toFixed(1) : null;
    const dist = [5,4,3,2,1].map(n => ({ n, count: reviews.filter(r => Math.round(r.rating||0)===n).length }));
    const maxDist = Math.max(1, ...dist.map(d => d.count));
    const alreadyReviewed = me && reviews.some(r => r.reviewerId === me.id);
    return `<div class="page active">
      ${H.innerTopbar(isOwn ? 'My Reviews' : H.escHtml(u.name) + '\'s Reviews')}
      <div style="background:var(--card);padding:20px 16px;border-bottom:1px solid var(--border)">
        <div style="display:flex;gap:20px;align-items:center">
          <div style="text-align:center">
            <div style="font-size:52px;font-weight:900;color:var(--text);line-height:1">${avg || '–'}</div>
            <div style="display:flex;justify-content:center;gap:2px;margin:6px 0">${avg ? stars(parseFloat(avg)) : stars(0)}</div>
            <div style="font-size:12px;color:var(--sub)">${reviews.length} review${reviews.length===1?'':'s'}</div>
          </div>
          <div style="flex:1">
            ${dist.map(d => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><div style="font-size:11px;color:var(--sub);width:8px">${d.n}</div><div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;background:#f59e0b;width:${Math.round((d.count/maxDist)*100)}%;border-radius:3px;transition:width .3s"></div></div><div style="font-size:11px;color:var(--sub);width:14px;text-align:right">${d.count}</div></div>`).join('')}
          </div>
        </div>
        ${!isOwn && me && !alreadyReviewed ? `<button onclick="H.leaveReview('${u.id}')" style="width:100%;margin-top:16px;padding:12px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">Leave a Review</button>` : ''}
        ${!isOwn && me && alreadyReviewed ? `<div style="text-align:center;margin-top:14px;font-size:13px;color:var(--sub)">You have already reviewed this seller</div>` : ''}
      </div>
      <div style="padding:12px 14px 88px">
        ${reviews.length ? reviews.slice().sort((a,b) => b.date - a.date).slice(0,20).map(r => `
          <div style="background:var(--card);border-radius:14px;padding:14px;margin-bottom:10px;border:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
              <div><div style="font-size:14px;font-weight:700;color:var(--text)">${H.escHtml(r.reviewerName || 'Anonymous')}</div><div style="display:flex;gap:2px;margin-top:3px">${stars(r.rating||0)}</div></div>
              <div style="font-size:12px;color:var(--sub)">${H.timeAgo(r.date)}</div>
            </div>
            ${r.text ? `<div style="font-size:13px;color:var(--text);line-height:1.6;margin-top:8px">${H.escHtml(r.text)}</div>` : ''}
          </div>`).join('') : `<div style="text-align:center;padding:48px 20px"><div style="display:flex;justify-content:center;margin-bottom:12px"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div><div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px">No reviews yet</div><div style="font-size:13px;color:var(--sub)">Reviews from buyers will appear here after transactions</div></div>`}
      </div>
    </div>`;
  };

  H.leaveReview = function (sellerId) {
    const me = H.currentUser();
    if (!me) { H.requireAuth('Sign in to leave a review'); return; }
    if (sellerId === me.id) { H.toast('You cannot review yourself'); return; }
    H.modal({
      title: 'Leave a Review',
      body: `<div style="text-align:center;margin-bottom:14px"><div style="font-size:13px;color:var(--sub);margin-bottom:10px">Tap to rate your experience</div><div id="starPicker" style="display:flex;justify-content:center;gap:8px">${[1,2,3,4,5].map(n => `<button data-star="${n}" onclick="H._pickStar(${n})" style="background:none;border:none;cursor:pointer;padding:4px;line-height:1"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--sub)"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>`).join('')}</div></div><textarea id="reviewText" rows="3" placeholder="Share your experience with this seller…" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:12px;font-size:13px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box;resize:vertical;font-family:Inter,sans-serif"></textarea>`,
      confirmText: 'Submit Review',
      onConfirm: () => {
        const rating = H._selectedStar || 0;
        const text   = (document.getElementById('reviewText') || {}).value || '';
        if (!rating) { H.toast('Please select a star rating'); return false; }
        H._submitReview(sellerId, rating, text);
      }
    });
  };

  H._selectedStar = 0;
  H._pickStar = function (n) {
    H._selectedStar = n;
    const btns = document.querySelectorAll('#starPicker button');
    btns.forEach(function(b) {
      const v = parseInt(b.getAttribute('data-star'));
      const filled = v <= n;
      b.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="${filled ? '#f59e0b' : 'none'}" stroke="${filled ? '#f59e0b' : 'currentColor'}" stroke-width="2" style="color:${filled ? '#f59e0b' : 'var(--sub)'}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    });
  };

  H._submitReview = function (sellerId, rating, text) {
    const me = H.currentUser(); if (!me) return;
    const seller = (H.state.users || []).find(x => x.id === sellerId); if (!seller) return;
    seller.reviews  = seller.reviews  || [];
    seller.ratings  = seller.ratings  || [];
    const dup = seller.reviews.find(r => r.reviewerId === me.id);
    if (dup) { H.toast('You have already reviewed this seller'); return; }
    const review = { id: H.uid(), reviewerId: me.id, reviewerName: me.name || 'User', rating, text, date: Date.now() };
    seller.reviews.unshift(review);
    seller.ratings.push(rating);
    H.saveState();
    var _sb = window.supabase;
    if (_sb && typeof _sb.from === 'function') {
      _sb.from('reviews').insert({
        seller_id: sellerId, reviewer_id: me.id,
        reviewer_name: me.name || 'User', rating: rating,
        body: text || null, created_at: new Date().toISOString()
      }).then(function(res) {
        if (res && res.error) console.warn('Review sync failed:', res.error.message);
      });
    }
    H.pushNotif(sellerId, 'New Review', me.name + ' left you a ' + rating + '-star review', 'review');
    H.toast('Review submitted. Thank you!');
    H.renderPage('Reviews', {id: sellerId});
  };

  H._openAppliedJobs = function () { H.openInner('AppliedJobs'); };

  // ── JOB SEEKER PROFILE — READ-ONLY VIEW (LinkedIn-style) ──
  pages.JobSeekerProfile = function () {
    const u = H.currentUser();
    if (!u) return H.emptyState('Not logged in', 'Please sign in');

    const cv       = u.cv || {};
    const exp      = cv.experience || [];
    const edu      = cv.education  || [];
    const skills   = (u.skills || (cv.skills || []).join(',') || '').split(',').map(s => s.trim()).filter(Boolean);
    const headline = u.jobTitle || cv.headline || '';
    const bio      = u.bio || cv.summary || '';
    const location = u.city || cv.location || '';
    const jobTypes = (u.jobTypes || '').split(',').map(s => s.trim()).filter(Boolean);
    const salary   = u.expectedSalary || cv.expectedSalary || '';
    const hasProfile = !!(headline || bio || skills.length || exp.length || edu.length);

    const sec = (title, icon, content) => `
      <div style="background:#fff;border-radius:16px;margin-bottom:12px;border:1px solid #E4E8F0;overflow:hidden">
        <div style="padding:14px 16px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #F0F4FF">
          <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#1A3A8F;text-transform:uppercase;letter-spacing:.5px">${icon}${title}</div>
          ${title==='Experience'?`<button onclick="H._cvProfile.addExp()" style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#1A3A8F;color:#fff;border:none;cursor:pointer">+ Add</button>`:''}
          ${title==='Education'?`<button onclick="H._cvProfile.addEdu()" style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#1A3A8F;color:#fff;border:none;cursor:pointer">+ Add</button>`:''}
        </div>
        <div style="padding:14px 16px">${content}</div>
      </div>`;

    const expHtml = exp.length ? exp.map((e, i) => `
      <div style="padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #F0F4FF">
        <div style="font-size:14px;font-weight:700;color:var(--text)">${H.escHtml(e.title||'')}</div>
        <div style="font-size:13px;color:#1A3A8F;font-weight:600;margin-top:2px">${H.escHtml(e.company||'')}</div>
        <div style="font-size:12px;color:#667085;margin-top:2px">${H.escHtml(e.duration||'')}${e.current?' · Current':''}</div>
        ${e.desc?`<div style="font-size:13px;color:var(--sub);margin-top:6px;line-height:1.55">${H.escHtml(e.desc)}</div>`:''}
        <div style="display:flex;gap:8px;margin-top:8px">
          <button onclick="H._cvProfile.editExp(${i})" style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#EFF6FF;color:#1A3A8F;border:1px solid #BFDBFE;cursor:pointer">Edit</button>
          <button onclick="H._cvProfile.delExp(${i})"  style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;cursor:pointer">Remove</button>
        </div>
      </div>`).join('')
      : '<div style="color:#667085;font-size:13px">No experience added yet</div>';

    const eduHtml = edu.length ? edu.map((e, i) => `
      <div style="padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #F0F4FF">
        <div style="font-size:14px;font-weight:700;color:var(--text)">${H.escHtml(e.degree||'')}</div>
        <div style="font-size:13px;color:#1A3A8F;font-weight:600;margin-top:2px">${H.escHtml(e.school||'')}</div>
        <div style="font-size:12px;color:#667085;margin-top:2px">${H.escHtml(e.year||'')}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button onclick="H._cvProfile.editEdu(${i})" style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#EFF6FF;color:#1A3A8F;border:1px solid #BFDBFE;cursor:pointer">Edit</button>
          <button onclick="H._cvProfile.delEdu(${i})"  style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;cursor:pointer">Remove</button>
        </div>
      </div>`).join('')
      : '<div style="color:#667085;font-size:13px">No education added yet</div>';

    const skillsHtml = skills.length
      ? skills.map(s => `<span style="display:inline-block;background:#EFF6FF;color:#1A3A8F;border:1px solid #BFDBFE;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;margin:0 4px 6px 0">${H.escHtml(s)}</span>`).join('')
      : '<div style="color:#667085;font-size:13px">No skills added yet</div>';

    const jtHtml = jobTypes.length
      ? jobTypes.map(t => `<span style="display:inline-block;background:#F0FDF4;color:#15803d;border:1px solid #BBF7D0;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;margin:0 4px 6px 0">${H.escHtml(t)}</span>`).join('')
      : '<div style="color:#667085;font-size:13px">Not set</div>';

    const contactHtml = (() => {
      const rows = [];
      if (u.whatsappFull || u.whatsappNum) rows.push(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#25D366" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><span style="font-size:13px;color:var(--text)">+${H.escHtml(u.whatsappFull||u.whatsappNum||'')}</span></div>`);
      if (u.contactMethod) rows.push(`<div style="font-size:13px;color:#667085">Preferred: <strong style="color:var(--text)">${H.escHtml(u.contactMethod)}</strong></div>`);
      if (u.linkedinUrl)   rows.push(`<div style="margin-top:6px;font-size:13px"><a href="${H.escHtml(u.linkedinUrl)}" target="_blank" style="color:#1A3A8F;font-weight:600">LinkedIn Profile</a></div>`);
      if (u.websiteUrl)    rows.push(`<div style="margin-top:4px;font-size:13px"><a href="${H.escHtml(u.websiteUrl)}" target="_blank" style="color:#1A3A8F;font-weight:600">Portfolio / Website</a></div>`);
      return rows.length ? rows.join('') : '<div style="color:#667085;font-size:13px">No contact info added yet</div>';
    })();

    const resumeHtml = (u.cvFileUrl || u.cvFileName)
      ? `<div style="display:flex;align-items:center;gap:10px;background:#F8FAFF;border:1px solid #BFDBFE;border-radius:10px;padding:10px 14px">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#1A3A8F" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${H.escHtml(u.cvFileName||'Resume')}</div></div>
          ${u.cvFileUrl?`<a href="${H.escHtml(u.cvFileUrl)}" target="_blank" style="font-size:12px;font-weight:700;color:#1A3A8F;text-decoration:none;flex-shrink:0">View</a>`:''}
        </div>`
      : '<div style="color:#667085;font-size:13px">No resume uploaded yet</div>';

    if (!hasProfile) {
      return `<div class="page active">
        ${H.innerTopbar('My Job Profile')}
        <div style="padding:40px 24px;text-align:center">
          <div style="width:72px;height:72px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#1A3A8F" stroke-width="1.5"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
          </div>
          <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:8px">You don't have a job profile yet</div>
          <div style="font-size:13px;color:#667085;line-height:1.6;margin-bottom:24px">Create your profile so employers in Hire Talent can find and contact you.</div>
          <button onclick="H.openInner('CandidateProfile')" style="width:100%;max-width:280px;padding:14px;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit">Create Job Profile</button>
        </div>
      </div>`;
    }

    return `<div class="page active">
      ${H.innerTopbar('My Job Profile')}
      <div style="padding:0 14px 100px">

        <!-- Profile Header Card -->
        <div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);border-radius:20px;padding:20px;margin:14px 0;display:flex;gap:14px;align-items:flex-start">
          <div style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:22px;font-weight:800;color:#fff;border:2.5px solid rgba(255,255,255,.4)">
            ${u.avatar?`<img src="${H.escHtml(u.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:H.initials(u.name)}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:17px;font-weight:800;color:#fff">${H.escHtml(u.name||'')}</div>
            ${headline?`<div style="font-size:13px;color:rgba(255,255,255,.9);font-weight:600;margin-top:3px">${H.escHtml(headline)}</div>`:''}
            ${location?`<div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px;display:flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${H.escHtml(location)}</div>`:''}
            ${u.openToWork?`<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(34,197,94,.25);border:1px solid rgba(34,197,94,.5);border-radius:20px;padding:3px 10px;margin-top:6px"><svg viewBox="0 0 24 24" width="10" height="10" fill="#22c55e" stroke="none"><circle cx="12" cy="12" r="12"/></svg><span style="font-size:11px;font-weight:700;color:#86efac">Open to Work</span></div>`:''}
          </div>
        </div>

        ${u.verified?`<div style="display:flex;align-items:center;gap:6px;background:#ECFDF5;border:1.5px solid #6EE7B7;border-radius:10px;padding:10px 14px;margin-bottom:12px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size:13px;font-weight:700;color:#059669">Identity Verified</span></div>`:''}

        ${bio?sec('About','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/></svg> ',`<div style="font-size:13px;color:var(--text);line-height:1.65">${H.escHtml(bio)}</div>`):''}

        ${sec('Skills','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> ', skillsHtml)}
        ${jobTypes.length?sec('Job Type / Availability','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg> ', jtHtml):''}
        ${salary?sec('Expected Salary','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> ',`<div style="font-size:14px;font-weight:700;color:var(--text)">${H.escHtml(String(salary))}</div>`):''}
        ${sec('Work Experience','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg> ', expHtml)}
        ${sec('Education','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> ', eduHtml)}
        ${sec('Contact & Links','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg> ', contactHtml)}
        ${sec('Resume / CV','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ', resumeHtml)}

      </div>

      <!-- Fixed bottom Edit button -->
      <div style="position:fixed;bottom:0;left:0;right:0;background:#fff;padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid #E4E8F0;z-index:200">
        <button onclick="H.openInner('CandidateProfile')" style="width:100%;padding:14px;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Profile
        </button>
      </div>
    </div>`;
  };

  pages.JobSeekerProfile_after = function () {
    function captureDraft() {
      const u = H.currentUser();
      if (!u) return;
      u.cv = u.cv || {};
      const headlineEl = document.getElementById('cvHeadline');
      const summaryEl = document.getElementById('cvSummary');
      const skillsEl = document.getElementById('cvSkills');
      const certsEl = document.getElementById('cvCerts');
      const salaryEl = document.getElementById('cvSalary');
      const locationEl = document.getElementById('cvLocation');
      const visibleEl = document.getElementById('cvVisible');
      if (headlineEl) u.cv.headline = headlineEl.value.trim();
      if (summaryEl) u.cv.summary = summaryEl.value.trim();
      if (skillsEl) u.cv.skills = skillsEl.value.split(',').map(s => s.trim()).filter(Boolean);
      if (certsEl) u.cv.certs = certsEl.value.split('\n').map(s => s.trim()).filter(Boolean);
      if (salaryEl) u.cv.expectedSalary = parseFloat(salaryEl.value) || null;
      if (locationEl) u.cv.location = locationEl.value.trim();
      if (visibleEl) u.cv.visible = visibleEl.checked;
    }
    H._cvProfile = {
      save() {
        const u = H.currentUser();
        if (!u) return;
        captureDraft();
        // Make visible in HireTalent if they have a headline or experience
        if (u.cv.visible && (u.cv.headline || u.cv.summary || (u.cv.experience && u.cv.experience.length))) {
          u.openToWork = true;
        }
        u.jobTitle = u.cv.headline || u.jobTitle || '';
        u.skills = (u.cv.skills || []).join(', ');
        H.saveState();
        const sb = window.supabase;
        if (sb && typeof sb.from === 'function') {
          sb.from('profiles').upsert({
            id: u.id, cv: u.cv,
            job_title: u.jobTitle || null,
            skills: u.skills || null,
            city: u.cv.location || null,
            open_to_work: u.openToWork || false,
            updated_at: new Date().toISOString()
          }).then(r => { if (r && r.error) console.warn('CV sync:', r.error.message); });
        }
        H.toast('Job profile saved!');
        H.goBack();
      },
      addExp() {
        captureDraft();
        H.modal({
          title: 'Add Work Experience',
          body: `<div style="display:flex;flex-direction:column;gap:8px">
            <input id="expTitle" class="fi" placeholder="Job Title *">
            <input id="expCompany" class="fi" placeholder="Company Name *">
            <input id="expDuration" class="fi" placeholder="Duration e.g. Jan 2020 – Dec 2022">
            <label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="expCurrent">Still working here</label>
            <textarea id="expDesc" class="fi" rows="3" placeholder="Role description / responsibilities..."></textarea>
          </div>`,
          confirmText: 'Add',
          onConfirm: () => {
            const title   = (document.getElementById('expTitle')?.value || '').trim();
            const company = (document.getElementById('expCompany')?.value || '').trim();
            if (!title || !company) { H.toast('Title and company are required'); return false; }
            const u = H.currentUser();
            u.cv = u.cv || {};
            u.cv.experience = u.cv.experience || [];
            u.cv.experience.push({
              title, company,
              duration: (document.getElementById('expDuration')?.value || '').trim(),
              current:  document.getElementById('expCurrent')?.checked || false,
              desc:     (document.getElementById('expDesc')?.value || '').trim()
            });
            H.saveState();
            H.renderPage('JobSeekerProfile');
          }
        });
      },
      addEdu() {
        captureDraft();
        H.modal({
          title: 'Add Education',
          body: `<div style="display:flex;flex-direction:column;gap:8px">
            <input id="eduDegree" class="fi" placeholder="Degree / Certificate *">
            <input id="eduSchool" class="fi" placeholder="School / University *">
            <input id="eduYear" class="fi" placeholder="Year e.g. 2018">
          </div>`,
          confirmText: 'Add',
          onConfirm: () => {
            const degree = (document.getElementById('eduDegree')?.value || '').trim();
            const school = (document.getElementById('eduSchool')?.value || '').trim();
            if (!degree || !school) { H.toast('Degree and school are required'); return false; }
            const u = H.currentUser();
            u.cv = u.cv || {};
            u.cv.education = u.cv.education || [];
            u.cv.education.push({
              degree, school,
              year: (document.getElementById('eduYear')?.value || '').trim()
            });
            H.saveState();
            H.renderPage('JobSeekerProfile');
          }
        });
      },
      editExp(i) {
        captureDraft();
        const u = H.currentUser();
        const e = (u.cv && u.cv.experience && u.cv.experience[i]) || {};
        H.modal({
          title: 'Edit Work Experience',
          body: `<div style="display:flex;flex-direction:column;gap:8px">
            <input id="expTitle" class="fi" value="${H.escHtml(e.title||'')}" placeholder="Job Title *">
            <input id="expCompany" class="fi" value="${H.escHtml(e.company||'')}" placeholder="Company Name *">
            <input id="expDuration" class="fi" value="${H.escHtml(e.duration||'')}" placeholder="Duration">
            <label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="expCurrent" ${e.current?'checked':''}>Still working here</label>
            <textarea id="expDesc" class="fi" rows="3" placeholder="Description...">${H.escHtml(e.desc||'')}</textarea>
          </div>`,
          confirmText: 'Save',
          onConfirm: () => {
            const title   = (document.getElementById('expTitle')?.value || '').trim();
            const company = (document.getElementById('expCompany')?.value || '').trim();
            if (!title || !company) { H.toast('Title and company are required'); return false; }
            u.cv.experience[i] = {
              title, company,
              duration: (document.getElementById('expDuration')?.value || '').trim(),
              current:  document.getElementById('expCurrent')?.checked || false,
              desc:     (document.getElementById('expDesc')?.value || '').trim()
            };
            H.saveState();
            H.renderPage('JobSeekerProfile');
          }
        });
      },
      editEdu(i) {
        captureDraft();
        const u = H.currentUser();
        const e = (u.cv && u.cv.education && u.cv.education[i]) || {};
        H.modal({
          title: 'Edit Education',
          body: `<div style="display:flex;flex-direction:column;gap:8px">
            <input id="eduDegree" class="fi" value="${H.escHtml(e.degree||'')}" placeholder="Degree *">
            <input id="eduSchool" class="fi" value="${H.escHtml(e.school||'')}" placeholder="School *">
            <input id="eduYear" class="fi" value="${H.escHtml(e.year||'')}" placeholder="Year">
          </div>`,
          confirmText: 'Save',
          onConfirm: () => {
            const degree = (document.getElementById('eduDegree')?.value || '').trim();
            const school = (document.getElementById('eduSchool')?.value || '').trim();
            if (!degree || !school) { H.toast('Required fields missing'); return false; }
            u.cv.education[i] = { degree, school, year: (document.getElementById('eduYear')?.value || '').trim() };
            H.saveState();
            H.renderPage('JobSeekerProfile');
          }
        });
      },
      delExp(i) {
        const u = H.currentUser();
        if (!u.cv || !u.cv.experience) return;
        u.cv.experience.splice(i, 1);
        H.saveState();
        H.renderPage('JobSeekerProfile');
      },
      delEdu(i) {
        const u = H.currentUser();
        if (!u.cv || !u.cv.education) return;
        u.cv.education.splice(i, 1);
        H.saveState();
        H.renderPage('JobSeekerProfile');
      }
    };
  };

})(window.H = window.H || {});
