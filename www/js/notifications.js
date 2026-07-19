/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const { escHtml, timeAgo, uid, toast } = H;
  const saveState = () => H.saveState();
  const pages = H.pages;

  function sb() {
    return (window.supabase && typeof window.supabase.from === 'function') ? window.supabase : null;
  }

  // ── Push helper (called from anywhere) ────────────────────
  H.pushNotif = function (uid_, title, body, type, imageUrl, deepLink, conversationId) {
    H.state.notifs = H.state.notifs || {};
    H.state.notifs[uid_] = H.state.notifs[uid_] || [];
    const n = {
      id: uid(), t: Date.now(), read: false,
      title, body, type: type || _inferType(title),
      imageUrl: imageUrl || null,
      deepLink: deepLink || null,
      conversationId: conversationId || null
    };
    H.state.notifs[uid_].unshift(n);
    if (H.state.notifs[uid_].length > 100) H.state.notifs[uid_].length = 100;
    saveState();
    H._updateNotifBadge();

    // Cloud persistence of CROSS-USER notifications is now handled exclusively by
    // server-side security-definer triggers (messages, reviews, business_leads,
    // rental_* events). The notifications INSERT policy is self-only
    // (auth.uid() = user_id), so a client insert for another user is rejected by
    // RLS anyway. We therefore only persist when the target is the CURRENT user
    // (e.g. a self/system notice), which RLS permits. This keeps a single source
    // of truth for cross-user delivery and avoids doomed inserts.
    const cu = H.currentUser && H.currentUser();
    const isSelf = cu && String(cu.id) === String(uid_);
    const c = sb();
    if (c && isSelf) {
      c.from('notifications').insert({
        id: n.id, user_id: uid_, title: n.title, body: n.body,
        type: n.type, read: false, created_at: n.t,
        meta: { deepLink: deepLink || null, imageUrl: imageUrl || null, conversationId: conversationId || null }
      }).then(r => { if (r && r.error) console.warn('notif insert failed:', r.error.message); });
    }
  };

  H._updateNotifBadge = function () {
    const u = H.currentUser(); if (!u) return;
    const count = (H.state.notifs[u.id] || []).filter(n => !n.read && n.type !== 'message').length;
    // Update the home header bell badge (rendered as span inside the bell div)
    document.querySelectorAll('[data-notif-badge]').forEach(b => {
      b.textContent = count > 9 ? '9+' : count;
      b.style.display = count ? '' : 'none';
    });
    // Legacy selectors
    const legacy = document.querySelector('[data-nav="Notifications"] .badge') || document.querySelector('.hdr-ic .badge');
    if (legacy) {
      legacy.textContent = count > 9 ? '9+' : count;
      legacy.style.display = count ? '' : 'none';
    }
  };

  // ── Hash-based change detection helpers ──────────────────
  function _notifHash(userId) {
    const list = (H.state.notifs && H.state.notifs[userId]) || [];
    return list.map(n => n.id + (n.read ? '1' : '0')).join(',');
  }

  let _notifRenderTimer = null;
  function _maybeRenderNotifs(userId) {
    if (H.currentPageName !== 'Notifications') return;
    const newHash = _notifHash(userId);
    if (newHash === H._lastNotifHash) return;
    H._lastNotifHash = newHash;
    if (_notifRenderTimer) clearTimeout(_notifRenderTimer);
    _notifRenderTimer = setTimeout(function () {
      _notifRenderTimer = null;
      if (H.currentPageName === 'Notifications') H.renderPage('Notifications');
    }, 300);
  }

  // ── Sync from Supabase ────────────────────────────────────
  H.syncNotifications = async function () {
    const c = sb(); if (!c) return;
    const u = H.currentUser(); if (!u) return;
    try {
      // Rental notifications are excluded here — they belong only in the
      // Rental Business Platform's own notification list (RB.loadNotifications
      // in rentals-business.js), never mixed into the personal feed. Scoped
      // on the explicit `category` column (not a type-string pattern match —
      // fragile, unindexed, and one typo'd type would silently break
      // isolation) per the production audit.
      let res = await c.from('notifications')
        .select('id, user_id, title, body, type, read, created_at, meta, image_url').eq('user_id', u.id)
        .or('category.is.null,category.neq.rental')
        .order('created_at', { ascending: false }).limit(20);
      // If the full select 400s (image_url column not yet in this DB), retry without it
      if (res.error && /image_url|column|PGRST/i.test((res.error.message || '') + (res.error.code || ''))) {
        res = await c.from('notifications')
          .select('id, user_id, title, body, type, read, created_at, meta').eq('user_id', u.id)
          .or('category.is.null,category.neq.rental')
          .order('created_at', { ascending: false }).limit(20);
      }
      if (res.error || !res.data) return;
      H.state.notifs = H.state.notifs || {};
      const local = H.state.notifs[u.id] || [];
      const clearedAt = (H.state.notifsClearedAt && H.state.notifsClearedAt[u.id]) || 0;
      const localIds = new Set(local.map(n => n.id));
      res.data.forEach(r => {
        const t = new Date(r.created_at).getTime();
        // Skip notifications that existed before the last clear
        if (clearedAt && t <= clearedAt) return;
        const existing = local.find(n => n.id === r.id);
        if (existing) {
          if (r.read && !existing.read) existing.read = true;
        } else if (!localIds.has(r.id)) {
          local.unshift({
            id: r.id, t, read: !!r.read,
            title: r.title || '', body: r.body || '',
            type: r.type || _inferType(r.title),
            imageUrl: (r.meta && r.meta.imageUrl) || r.image_url || null,
            deepLink: (r.meta && r.meta.deepLink) || r.deep_link || null
          });
        }
      });
      // Remove items deleted on server (or another device)
      const serverIds = new Set(res.data.map(r => r.id));
      const pruned = local.filter(n => serverIds.has(n.id));
      pruned.sort((a, b) => b.t - a.t);
      if (pruned.length > 100) pruned.length = 100;
      H.state.notifs[u.id] = pruned;
      saveState();
      H._updateNotifBadge();
      _maybeRenderNotifs(u.id);
    } catch (e) {
      console.warn('syncNotifications error:', e.message);
    }
  };

  // ── Real-time subscription ────────────────────────────────
  H._setupRealtimeNotifs = function () {
    const c = sb(); if (!c || typeof c.channel !== 'function') return;
    const u = H.currentUser(); if (!u) return;
    if (H._notifChannel) {
      try { c.removeChannel(H._notifChannel); } catch (e) {}
      H._notifChannel = null;
    }
    H._notifChannel = c.channel('notifications:' + u.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: 'user_id=eq.' + u.id
      }, payload => {
        const r = payload.new; if (!r) return;
        // Rental notifications never enter the personal feed — see the
        // matching exclusion in syncNotifications above. Scoped on category,
        // not a type-string pattern.
        if (r.category === 'rental') return;
        H.state.notifs = H.state.notifs || {};
        const list = H.state.notifs[u.id] = H.state.notifs[u.id] || [];
        if (!list.some(n => n.id === r.id)) {
          list.unshift({
            id: r.id, t: new Date(r.created_at).getTime(),
            read: !!r.read, title: r.title || '', body: r.body || '',
            type: r.type || _inferType(r.title),
            imageUrl: (r.meta && r.meta.imageUrl) || r.image_url || null,
            deepLink: (r.meta && r.meta.deepLink) || r.deep_link || null
          });
          if (list.length > 100) list.length = 100;
          saveState();
          H._updateNotifBadge();
          _maybeRenderNotifs(u.id);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'notifications',
        filter: 'user_id=eq.' + u.id
      }, payload => {
        const oldId = payload.old && payload.old.id; if (!oldId) return;
        H.state.notifs = H.state.notifs || {};
        const list = H.state.notifs[u.id] = H.state.notifs[u.id] || [];
        const idx = list.findIndex(n => n.id === oldId);
        if (idx !== -1) {
          list.splice(idx, 1);
          saveState();
          H._updateNotifBadge();
          _maybeRenderNotifs(u.id);
        }
      })
      .subscribe(function (status) {
        if (H.RT && typeof H.RT._onChannelStatus === 'function') H.RT._onChannelStatus('notifications', status);
      });
  };

  // ── Mark single notification as read (cloud-aware) ────────
  H.markNotifRead = async function (notifId) {
    const u = H.currentUser(); if (!u) return;
    const list = H.state.notifs[u.id] || [];
    const n = list.find(x => x.id === notifId);
    if (!n || n.read) return;
    n.read = true;
    saveState();
    H._updateNotifBadge();
    const c = sb();
    if (c) {
      c.from('notifications').update({ read: true }).eq('id', notifId)
        .then(r => { if (r && r.error) console.warn('notif read update failed:', r.error.message); });
    }
  };

  // ── Mark all as read ──────────────────────────────────────
  H.markAllNotifsRead = async function () {
    const u = H.currentUser(); if (!u) return;
    const list = H.state.notifs[u.id] || [];
    const unreadIds = list.filter(n => !n.read).map(n => n.id);
    if (!unreadIds.length) { toast('No unread notifications'); return; }
    list.forEach(n => { n.read = true; });
    saveState();
    H._updateNotifBadge();
    H.renderPage('Notifications');
    toast('Marked all as read');
    const c = sb();
    if (c) {
      // Scoped to non-rental — without this, marking personal notifications
      // read also silently marked the same user's unread rental
      // notifications as read, clearing their business badge count too.
      c.from('notifications').update({ read: true }).eq('user_id', u.id).eq('read', false)
        .or('category.is.null,category.neq.rental')
        .then(r => { if (r && r.error) console.warn('mark-all update failed:', r.error.message); });
    }
  };

  // ── Delete single notification ────────────────────────────
  H.deleteNotif = async function (notifId) {
    const u = H.currentUser(); if (!u) return;
    const list = H.state.notifs[u.id] || [];
    const idx = list.findIndex(n => n.id === notifId);
    if (idx === -1) return;
    list.splice(idx, 1);
    saveState();
    H._updateNotifBadge();
    H.renderPage('Notifications');
    const c = sb();
    if (c) {
      c.from('notifications').delete().eq('id', notifId)
        .then(r => { if (r && r.error) console.warn('notif delete failed:', r.error.message); });
    }
  };

  // ── Clear all notifications ───────────────────────────────
  H.clearAllNotifs = async function () {
    const u = H.currentUser(); if (!u) return;
    const list = H.state.notifs[u.id] || [];
    if (!list.length) { toast('No notifications to clear'); return; }
    H.state.notifs[u.id] = [];
    H.state.notifsClearedAt = H.state.notifsClearedAt || {};
    H.state.notifsClearedAt[u.id] = Date.now();
    saveState();
    H._updateNotifBadge();
    H.renderPage('Notifications');
    toast('Cleared all notifications');
    const c = sb();
    if (c) {
      // Only delete the notifications this page actually shows (non-rental).
      // Without the category filter, clearing personal notifications also
      // silently deleted the same user's rental notification history.
      c.from('notifications').delete().eq('user_id', u.id).or('category.is.null,category.neq.rental')
        .then(r => { if (r && r.error) console.warn('notif clear failed:', r.error.message); });
    }
  };

  // ── Pull-to-refresh handler hook ──────────────────────────
  H._refreshNotifications = async function () {
    // Force a re-render after pull-to-refresh by clearing the cached hash
    H._lastNotifHash = null;
    await H.syncNotifications();
    // If syncNotifications didn't trigger a re-render (no changes), force one
    if (H.currentPageName === 'Notifications') H.renderPage('Notifications');
  };

  // ── Date section label ────────────────────────────────────
  function _dayLabel(t) {
    const d = new Date(t), now = new Date();
    const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (same(d, now)) return 'Today';
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (same(d, y)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }

  // ── CSS class helpers ─────────────────────────────────────
  function _notifTypeClass(type) {
    const m = { boost:'ni-boost', verify:'ni-verify', message:'ni-msg', ban:'ni-ban', report:'ni-report', sale:'ni-sale', review:'ni-review', lead:'ni-sale', info:'ni-info', job_alert:'ni-job', security:'ni-security' };
    return m[type] || 'ni-info';
  }
  function _notifNavClass(type) {
    const m = { message:'nn-msg', sale:'nn-blue', verify:'nn-blue', boost:'nn-gold', ban:'nn-red', report:'nn-red', review:'nn-purple', lead:'nn-blue', job_alert:'nn-job', security:'nn-red', info:'nn-blue',
      listing_approved:'nn-blue', listing_rejected:'nn-red', listing_flagged:'nn-red', price_drop:'nn-gold', saved_search_match:'nn-blue', listing_expiry:'nn-red', stale_listing:'nn-gold', view_milestone:'nn-gold',
      job_application:'nn-job', job_shortlisted:'nn-job', job_declined:'nn-job', personalized_recommendation:'nn-blue' };
    return m[type] || 'nn-blue';
  }
  function _notifDotColor(type) {
    const m = { message:'#16A34A', sale:'#1D4ED8', boost:'#CA8A04', lead:'#1A3A8F', job_alert:'#475569', verify:'#1A3A8F', ban:'#DC2626', report:'#C2410C', review:'#7C3AED', security:'#DC2626', info:'#1A3A8F',
      listing_approved:'#1D4ED8', listing_rejected:'#DC2626', listing_flagged:'#DC2626', price_drop:'#CA8A04', saved_search_match:'#1A3A8F', listing_expiry:'#DC2626', stale_listing:'#CA8A04', view_milestone:'#CA8A04',
      job_application:'#475569', job_shortlisted:'#16A34A', job_declined:'#475569', personalized_recommendation:'#1A3A8F' };
    return m[type] || '#1A3A8F';
  }
  function _notifNavHint(type, deepLink) {
    if (deepLink && /^https?:\/\//i.test(deepLink)) return 'Open ›';
    const m = { message:'Messages ›', sale:'View listing ›', boost:'Boost again ›', verify:'View profile ›', ban:'View account ›', report:'View report ›', review:'Review ›', lead:'View lead ›', job_alert:'View job ›', security:'Security ›',
      listing_approved:'View listing ›', listing_rejected:'Edit listing ›', listing_flagged:'View listing ›', price_drop:'View listing ›', saved_search_match:'View listing ›', listing_expiry:'Renew ›', stale_listing:'Boost ad ›', view_milestone:'Boost ad ›',
      job_application:'View applicants ›', job_shortlisted:'View status ›', job_declined:'View status ›', personalized_recommendation:'View listing ›' };
    return m[type] || (deepLink ? 'Open ›' : 'View ›');
  }

  // ── Type inference & visual mapping ───────────────────────
  function _inferType(title) {
    const t = (title || '').toLowerCase();
    if (t.includes('boost') || t.includes('featured')) return 'boost';
    if (t.includes('verif')) return 'verify';
    if (t.includes('message') || t.includes('reply')) return 'message';
    if (t.includes('ban') || t.includes('suspend')) return 'ban';
    if (t.includes('report')) return 'report';
    if (t.includes('sold') || t.includes('paid') || t.includes('payment')) return 'sale';
    if (t.includes('review') || t.includes('appeal')) return 'review';
    if (t.includes('lead') || t.includes('interested') || t.includes('contacted your shop')) return 'lead';
    if (t.includes('job') || t.includes('hiring') || t.includes('vacancy') || t.includes('position')) return 'job_alert';
    if (t.includes('security') || t.includes('sign-in') || t.includes('login')) return 'security';
    if (t.includes('draft') || t.includes('unfinished') || t.includes('saved')) return 'info';
    if (t.includes('promo') || t.includes('discount') || t.includes('offer') || t.includes('deal')) return 'info';
    return 'info';
  }

  function _notifIcon(type) {
    const s = 'width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round';
    const map = {
      boost:   `<svg viewBox="0 0 24 24" style="${s}"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      verify:  `<svg viewBox="0 0 24 24" style="${s}"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
      message: `<svg viewBox="0 0 24 24" style="${s}"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
      ban:     `<svg viewBox="0 0 24 24" style="${s}"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
      report:  `<svg viewBox="0 0 24 24" style="${s}"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
      sale:    `<svg viewBox="0 0 24 24" style="${s}"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      review:    `<svg viewBox="0 0 24 24" style="${s}"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      lead:      `<svg viewBox="0 0 24 24" style="${s}"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2"/><path d="M19 8v6M16 11h6"/></svg>`,
      job_alert: `<svg viewBox="0 0 24 24" style="${s}"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
      security:  `<svg viewBox="0 0 24 24" style="${s}"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      info:      `<svg viewBox="0 0 24 24" style="${s}"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`
    };
    return map[type] || map.info;
  }

  function _notifBg(type) {
    const map = {
      boost: 'rgba(245,166,35,.12)', verify: 'rgba(29,155,240,.12)',
      message: 'rgba(34,197,94,.12)', ban: 'rgba(255,59,48,.12)',
      report: 'rgba(255,149,0,.12)', sale: 'rgba(0,122,255,.12)',
      review: 'rgba(139,92,246,.12)', lead: 'rgba(26,58,143,.12)', info: 'var(--bg2)',
      job_alert: 'rgba(84,110,122,.12)', security: 'rgba(255,59,48,.1)'
    };
    return map[type] || 'var(--bg2)';
  }

  function _notifColor(type) {
    const map = {
      boost: '#F5A623', verify: '#1D9BF0', message: '#22C55E',
      ban: '#FF3B30', report: '#FF9500', sale: '#007AFF',
      review: '#8B5CF6', lead: '#1A3A8F', info: '#1A3A8F',
      job_alert: '#546E7A', security: '#FF3B30'
    };
    return map[type] || '#1A3A8F';
  }

  // ── Notification tap navigation ───────────────────────────
  const _openChat = (id) => { if (typeof H.openChat === 'function') H.openChat(id); else H.openInner('Chat', { id }); };

  function _findNotif(id) {
    var u = H.currentUser && H.currentUser(); if (!u) return null;
    var list = (H.state.notifs && H.state.notifs[u.id]) || [];
    return list.find(function (x) { return x.id === id; }) || null;
  }

  // Navigational notification types jump straight to a screen. Everything else
  // (admin broadcasts / info / announcements) opens a detail view so the user can
  // read the full message and see the shared image.
  var _NAV_TYPES = { message: 1, sale: 1, boost: 1, verify: 1, review: 1, lead: 1, ban: 1, report: 1, job_alert: 1, security: 1 };

  H._closeNotifDetail = function () { var m = document.getElementById('notifDetailModal'); if (m) m.remove(); };

  // Render the broadcast/info detail overlay from a plain object. Used both by an
  // in-app tap (looked up by id) and by a notification-tray tap (built straight
  // from the push payload, so it works even on a cold start).
  function _renderNotifDetail(d) {
    if (!d) return;
    if (document.getElementById('notifDetailModal')) return;
    var image = d.image || d.imageUrl || '';
    var imgSafe = image.replace(/'/g, "\\'");
    var img = image
      ? '<img src="' + escHtml(image) + '" onclick="H.viewImage&&H.viewImage(\'' + imgSafe + '\')" style="width:100%;max-height:260px;object-fit:cover;border-radius:14px;margin-bottom:14px;cursor:zoom-in" onerror="this.style.display=\'none\'">'
      : '';
    var openBtn = d.deepLink
      ? '<button onclick="H._closeNotifDetail();H._notifNavigate(\'' + escHtml(d.deepLink) + '\',\'' + escHtml(d.type || '') + '\')" style="width:100%;padding:13px;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:8px">Open</button>'
      : '';
    var timeLine = d.t ? '<div style="font-size:11px;color:var(--sub);margin-bottom:16px">' + timeAgo(d.t) + '</div>' : '<div style="margin-bottom:8px"></div>';
    var ov = document.createElement('div');
    ov.id = 'notifDetailModal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(16,24,40,.55);z-index:9600;display:flex;align-items:center;justify-content:center;padding:22px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)';
    ov.innerHTML =
      '<div style="background:var(--card);border-radius:18px;max-width:380px;width:100%;max-height:86vh;overflow-y:auto;padding:18px;font-family:Inter,sans-serif;box-shadow:0 20px 60px rgba(16,24,40,.32)">'
      + img
      + '<div style="font-size:17px;font-weight:800;color:var(--text);margin-bottom:6px;line-height:1.3">' + escHtml(d.title || '') + '</div>'
      + '<div style="font-size:14px;color:var(--text);line-height:1.6;white-space:pre-wrap;margin-bottom:8px">' + escHtml(d.body || '') + '</div>'
      + timeLine
      + openBtn
      + '<button onclick="H._closeNotifDetail()" style="width:100%;padding:12px;background:' + (d.deepLink ? 'transparent' : '#1A3A8F') + ';color:' + (d.deepLink ? 'var(--sub)' : '#fff') + ';border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Close</button>'
      + '</div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) H._closeNotifDetail(); });
    document.body.appendChild(ov);
  }

  H._openNotifDetail = function (id) {
    var n = _findNotif(id); if (!n) return;
    _renderNotifDetail({ title: n.title, body: n.body, image: n.imageUrl, deepLink: n.deepLink, type: n.type, t: n.t });
  };

  // Open the detail straight from a push payload (tray tap / cold start).
  H._openNotifDetailFromData = function (d) { _renderNotifDetail(d || {}); };

  H._notifNavigate = function (link, type, id) {
    // Admin broadcasts / info / announcements → open the detail view (full text +
    // shared image) instead of bouncing to Home.
    if (id && !_NAV_TYPES[type]) { H._openNotifDetail(id); return; }
    if (link) {
      // External URL — open in system browser
      if (/^https?:\/\//i.test(link)) {
        try {
          if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
            window.Capacitor.Plugins.Browser.open({ url: link });
          } else {
            window.open(link, '_blank', 'noopener,noreferrer');
          }
        } catch (e) { window.open(link, '_blank', 'noopener,noreferrer'); }
        return;
      }
      // "chat:convId" shorthand (used by push notifications)
      const chatShort = link.match(/^chat:(.+)$/i);
      if (chatShort) { _openChat(chatShort[1]); return; }
      // Named in-app route: "Chat?id=xxx", "Detail?id=xxx", "Messages", …
      const routeMatch = link.match(/^([A-Za-z][\w-]*)(?:\?(.*))?$/);
      if (routeMatch) {
        const page = routeMatch[1];
        const params = {};
        if (routeMatch[2]) { try { new URLSearchParams(routeMatch[2]).forEach((v, k) => { params[k] = v; }); } catch (e) {} }
        if ((page === 'Chat' || page === 'chat') && params.id) { _openChat(params.id); return; }
        const _rootPages = ['Home','Browse','Messages','Post','Account','Notifications'];
        if (Object.keys(params).length) { H.openInner(page, params); return; }
        if (_rootPages.indexOf(page) !== -1) H.navTo(page);
        else H.openInner(page);
        return;
      }
      // Legacy listing deep link containing id=xxx
      const idMatch = link.match(/(?:[?&]|^)id=([a-zA-Z0-9_-]+)/);
      if (idMatch) { H.openInner('Detail', { id: idMatch[1] }); return; }
    }
    // No usable deep link — navigate based on notification type
    const t = type || '';
    if (t === 'message')                                                       { H.navTo('Messages'); return; }
    if (t === 'sale' || t === 'boost' || t === 'verify' || t === 'review' || t === 'lead' || t === 'ban' || t === 'report' || t === 'security') { H.navTo('Account'); return; }
    if (t === 'job_alert')                                                     { H.navTo('Browse'); return; }
    // info / system / unknown — go to Home so something always happens
    H.navTo('Home');
  };

  // Category tab definitions for the notifications page
  var _NOTIF_TABS = [
    { id: 'all',      label: 'All',           types: null },
    { id: 'listings', label: 'Active Ads',     types: ['sale', 'boost', 'review'] },
    { id: 'business', label: 'Business Leads', types: ['lead'] },
    { id: 'jobs',     label: 'Job Alerts',     types: ['job_alert'] },
    { id: 'account',  label: 'Account',        types: ['verify', 'ban', 'report', 'security'] },
    { id: 'promo',    label: 'Promotions',     types: ['info', 'system'] }
  ];

  H._notifTab = H._notifTab || 'all';

  H._setNotifTab = function (tabId) {
    H._notifTab = tabId;
    const list = document.getElementById('notifList');
    if (list) {
      const u = H.currentUser(); if (!u) return;
      const allItems = (H.state.notifs[u.id] || []).slice().sort(function(a, b) { return b.t - a.t; });
      list.innerHTML = _renderNotifItems(allItems, tabId);
    }
    document.querySelectorAll('[data-notif-tab]').forEach(function(el) {
      var active = el.dataset.notifTab === tabId;
      el.classList.toggle('active', active);
    });
  };

  function _matchesTab(n, tabId) {
    // Chat messages have their own Messages tab in-app; exclude any legacy
    // 'message'-type rows from the notification center entirely.
    if ((n.type || _inferType(n.title)) === 'message') return false;
    if (tabId === 'all') return true;
    var tab = _NOTIF_TABS.find(function(t) { return t.id === tabId; });
    if (!tab || !tab.types) return true;
    var type = n.type || _inferType(n.title);
    return tab.types.indexOf(type) !== -1;
  }

  function _renderNotifItems(list, tabId) {
    var filtered = list.filter(function(n) { return _matchesTab(n, tabId); });
    if (!filtered.length) {
      return '<div style="text-align:center;padding:60px 20px">'
        + '<div style="width:64px;height:64px;border-radius:50%;background:#EEF2FF;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">'
        + '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#1A3A8F" stroke-width="1.6" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
        + '</div>'
        + '<div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">Nothing here</div>'
        + '<div style="font-size:13px;color:var(--sub)">No notifications in this category yet.</div>'
        + '</div>';
    }
    var lastDay = '';
    return filtered.map(function(n) {
      var type = n.type || _inferType(n.title);
      var safeLink = n.deepLink ? escHtml(n.deepLink) : '';
      var tapAction = 'H.markNotifRead(\'' + n.id + '\');var el=this;el.classList.remove(\'unread\');var dot=el.querySelector(\'[data-unread-dot]\');if(dot)dot.remove();H._notifNavigate(' + (safeLink ? '\'' + safeLink + '\'' : 'null') + ',\'' + type + '\',\'' + n.id + '\');';
      var day = _dayLabel(n.t);
      var sep = '';
      if (day !== lastDay) { lastDay = day; sep = '<div class="notif-section-label">' + escHtml(day) + '</div>'; }
      var iconHtml = n.imageUrl
        ? '<img src="' + escHtml(n.imageUrl) + '" class="notif-thumb" onerror="this.style.display=\'none\'">'
        : '<div class="notif-icon ' + _notifTypeClass(type) + '">' + _notifIcon(type) + '</div>';
      var dotColor = _notifDotColor(type);
      var delBtn = '<button class="notif-del" onclick="event.stopPropagation();H.deleteNotif(\'' + n.id + '\')" aria-label="Delete">'
        + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
        + '</button>';
      return sep + '<div class="notif-item' + (n.read ? '' : ' unread') + '" onclick="' + tapAction + '">'
        + iconHtml
        + '<div class="notif-body">'
        + '<div class="notif-title">' + escHtml(n.title || '') + '</div>'
        + '<div class="notif-desc">' + escHtml(n.body || '') + '</div>'
        + '<div class="notif-footer">'
        + '<span class="notif-time">' + timeAgo(n.t) + '</span>'
        + '<span class="notif-nav ' + _notifNavClass(type) + '">' + _notifNavHint(type, n.deepLink) + '</span>'
        + '</div></div>'
        + (n.read ? '' : '<span data-unread-dot class="notif-unread-dot" style="background:' + dotColor + '"></span>')
        + delBtn
        + '</div>';
    }).join('');
  }

  // ── Notifications page ────────────────────────────────────
  pages.Notifications = function () {
    const u = H.currentUser();
    if (!u) {
      return '<div class="page active">' + H.innerTopbar('Notifications')
        + H.emptyState('No notifications yet', 'Important updates and app notices will appear here. Log in to see account alerts.', 'Login to continue', "H.requireAuth('Login to continue')")
        + '</div>';
    }
    const list = (H.state.notifs[u.id] || []).slice().sort((a, b) => b.t - a.t);
    const unreadCount = list.filter(n => !n.read).length;
    const activeTab = H._notifTab || 'all';

    const tabsHtml = _NOTIF_TABS.map(t => {
      const tabCount = t.types ? list.filter(n => !n.read && t.types.indexOf(n.type || _inferType(n.title)) !== -1).length : unreadCount;
      const isActive = t.id === activeTab;
      return '<button data-notif-tab="' + t.id + '" class="notif-tab-pill' + (isActive ? ' active' : '') + '" onclick="H._setNotifTab(\'' + t.id + '\')">'
        + escHtml(t.label)
        + (tabCount > 0 ? '<span class="notif-tab-badge">' + (tabCount > 9 ? '9+' : tabCount) + '</span>' : '')
        + '</button>';
    }).join('');

    return `<div class="page active">
      <div class="inner-topbar">
        <button class="back" onclick="H.goBack()" aria-label="Go back">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="inner-topbar-title">Notifications${unreadCount ? ' <span class="notif-count-badge">' + unreadCount + '</span>' : ''}</div>
        <div style="display:flex;gap:2px">
          ${unreadCount ? '<button class="notif-hdr-btn" onclick="H.markAllNotifsRead()">Read all</button>' : ''}
          ${list.length ? '<button class="notif-hdr-btn dim" onclick="H.clearAllNotifs()">Clear</button>' : ''}
        </div>
      </div>

      <div class="notif-tab-strip">
        ${tabsHtml}
      </div>

      <div id="notifList" style="padding-bottom:16px">
        ${_renderNotifItems(list, activeTab)}
      </div>

      <div class="notif-settings-row" onclick="H.openInner('NotifSettings')">
        <div class="nsr-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <span class="nsr-label">Notification Preferences</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#A1A1AA" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div style="height:32px"></div>
    </div>`;
  };

  pages.Notifications_after = function () {
    if (!H.currentUser()) return;
    // Fix 1 & 3 — Mark all notifications as read when the page opens and clear the badge
    const u = H.currentUser();
    const list = (H.state.notifs && H.state.notifs[u.id]) || [];
    const hadUnread = list.some(n => !n.read);
    if (hadUnread) {
      list.forEach(n => { n.read = true; });
      saveState();
      H._updateNotifBadge();
      if (H.updateNotifBadge) H.updateNotifBadge();
      // Persist read state to the server so viewed notifications don't come
      // back as "new" after a refresh, on another device, or after a cache clear.
      const c = sb();
      if (c) {
        c.from('notifications').update({ read: true }).eq('user_id', u.id).eq('read', false)
          .then(r => { if (r && r.error) console.warn('notif read-sync failed:', r.error.message); });
      }
    }
    // Sync from Supabase whenever the page is opened
    if (typeof H.syncNotifications === 'function') H.syncNotifications();
    // Make sure real-time subscription is alive
    if (typeof H._setupRealtimeNotifs === 'function') H._setupRealtimeNotifs();
  };

  // ── Notification settings ─────────────────────────────────
  pages.NotifSettings = function () {
    const u = H.currentUser();
    if (!u) {
      return '<div class="page active">' + H.innerTopbar('Notification Preferences')
        + H.emptyState('Sign in required', 'Sign in to manage notification preferences.', null, null)
        + '</div>';
    }
    u.settings = u.settings || {};

    const rows = [
      ['newEnq',    'New Enquiries',          'When someone messages you about a listing',         'message'],
      ['priceDrop', 'Price Drops',            'When a saved ad drops in price',                    'dollar'],
      ['sec',       'Security Alerts',        'New sign-in or suspicious account activity',        'shield'],
      ['promo',     'Tips & Promotions',      'Selling tips, platform updates, discounts',         'star'],
      ['sms',       'SMS Alerts',             'Critical alerts via SMS (carrier rates may apply)', 'smartphone']
    ];

    const settingsIcon = (iconKey) => {
      const style = 'width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle;margin-right:4px';
      const icons = {
        message:    `<svg viewBox="0 0 24 24" style="${style}"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        dollar:     `<svg viewBox="0 0 24 24" style="${style}"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
        clock:      `<svg viewBox="0 0 24 24" style="${style}"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        shield:     `<svg viewBox="0 0 24 24" style="${style}"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        star:       `<svg viewBox="0 0 24 24" style="${style}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
        smartphone: `<svg viewBox="0 0 24 24" style="${style}"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`
      };
      return icons[iconKey] || '';
    };

    return `<div class="page active">${H.innerTopbar('Notification Preferences')}
      <div style="padding:0 14px 100px">

        <div style="background:linear-gradient(135deg,#1A3A8F 0%,#0f2460 100%);border-radius:20px;padding:20px;margin:14px 0 16px;color:#fff;box-shadow:0 8px 24px rgba(26,58,143,.25);display:flex;align-items:center;gap:13px">
          <div style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#F5A623" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
          <div><div style="font-size:17px;font-weight:800">Notifications</div><div style="font-size:12.5px;color:rgba(255,255,255,.82);margin-top:1px">Choose what you hear about. Push needs app permission.</div></div>
        </div>

        <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:18px;overflow:hidden;box-shadow:0 2px 10px rgba(16,24,40,.04)">
          ${rows.map(([k, t, s, iconName], idx) => {
            const on = u.settings[k] !== false;
            const trackBg = on ? '#16a34a' : 'rgba(120,120,128,0.3)';
            const knobLeft = on ? '22px' : '3px';
            const border = idx < rows.length - 1 ? 'border-bottom:1px solid var(--border,#EEF1F6);' : '';
            return `
            <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;${border}">
              <div style="width:38px;height:38px;border-radius:11px;background:rgba(26,58,143,.08);color:#1A3A8F;display:flex;align-items:center;justify-content:center;flex-shrink:0">${settingsIcon(iconName)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:14.5px;font-weight:700;color:var(--text)">${t}</div>
                <div style="font-size:12px;color:var(--sub);line-height:1.45;margin-top:1px">${s}</div>
              </div>
              <button
                onclick="H.toggleSetting('${k}',this)"
                role="switch"
                aria-checked="${on ? 'true' : 'false'}"
                aria-label="${t}"
                style="position:relative;display:inline-block;width:46px;height:26px;border-radius:13px;background:${trackBg};border:none;cursor:pointer;flex-shrink:0;padding:0;transition:background 0.2s;outline:none;-webkit-tap-highlight-color:transparent">
                <span style="position:absolute;top:3px;left:${knobLeft};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);transition:left 0.2s"></span>
              </button>
            </div>`;
          }).join('')}
        </div>

        <div style="display:flex;gap:10px;align-items:flex-start;background:#EEF2FB;border-radius:14px;padding:14px;margin-top:16px">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1A3A8F" stroke-width="2" style="flex-shrink:0;margin-top:1px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <div style="font-size:12px;color:var(--sub);line-height:1.55"><b style="color:#1A3A8F">Privacy:</b> PaMarket never sells your notification preferences or contact details. You can also turn off all notifications from your device settings.</div>
        </div>
      </div>
    </div>`;
  };

  H.toggleSetting = function (k, btn) {
    const u = H.currentUser(); if (!u) return;
    u.settings = u.settings || {};
    u.settings[k] = !(u.settings[k] !== false);
    const on = u.settings[k];
    // Update track background
    btn.style.background = on ? '#34C759' : 'rgba(120,120,128,0.3)';
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    // Slide the knob
    const knob = btn.querySelector('span');
    if (knob) knob.style.left = on ? '22px' : '3px';
    saveState();
    toast(on ? 'Enabled' : 'Disabled');
  };

})(window.H);
