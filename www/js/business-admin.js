/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE 12 — ADMIN CONTROL SYSTEM (Business Platform section)
 * In-app admin view of every business: suspend/activate, set verification level
 * (approve pending), override subscription plan, and a leads/listings summary.
 * Gated to role = 'admin' (admin RLS policies grant the cloud reads/writes).
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const escHtml = (s) => H.escHtml(s);
  const toast = (...a) => H.toast(...a);
  const innerTopbar = (...a) => H.innerTopbar(...a);
  const saveState = () => H.saveState();
  const renderPage = (...a) => H.renderPage(...a);

  function adminList() { H.state.adminBusinesses = H.state.adminBusinesses || []; return H.state.adminBusinesses; }

  H.fetchAllBusinesses = async function () {
    const sb = window.supabase; if (!sb) return adminList();
    try {
      const { data, error } = await sb.from('businesses').select('*').order('created_at', { ascending: false }).limit(200);
      if (error || !Array.isArray(data)) return adminList();
      H.state.adminBusinesses = data.map(r => ({
        id: r.id, ownerUserId: r.owner_user_id, name: r.name, bizType: r.biz_type,
        category: r.category, status: r.status, planId: r.plan_id || 'free',
        verificationLevel: r.verification_level || 0, verificationPending: false,
        city: r.city, province: r.province, createdAt: new Date(r.created_at || Date.now()).getTime()
      }));
      saveState();
      return H.state.adminBusinesses;
    } catch (e) { return adminList(); }
  };

  H.fetchPendingInvoices = async function () {
    const sb = window.supabase; if (!sb) return H.state.adminInvoices || [];
    try {
      const { data, error } = await sb.from('business_payments').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200);
      if (error || !Array.isArray(data)) return H.state.adminInvoices || [];
      H.state.adminInvoices = data.map(r => ({ id: r.id, businessId: r.business_id, type: r.type, amount: Number(r.amount) || 0, description: r.description, createdAt: new Date(r.created_at || Date.now()).getTime() }));
      saveState(); return H.state.adminInvoices;
    } catch (e) { return H.state.adminInvoices || []; }
  };

  H.fetchPendingBizVerifs = async function () {
    const sb = window.supabase; if (!sb) return H.state.adminVerifs || [];
    try {
      const { data, error } = await sb.from('business_verifications').select('*').eq('status', 'pending').order('submitted_at', { ascending: false }).limit(200);
      if (error || !Array.isArray(data)) return H.state.adminVerifs || [];
      H.state.adminVerifs = data.map(r => ({ id: r.id, businessId: r.business_id, level: r.level_requested || 1, idDoc: r.id_doc_path, regDoc: r.reg_doc_path, submittedAt: new Date(r.submitted_at || Date.now()).getTime() }));
      saveState(); return H.state.adminVerifs;
    } catch (e) { return H.state.adminVerifs || []; }
  };

  function bizNameOf(id) { const b = adminList().find(x => x.id === id); return b ? (b.name || 'Business') : 'Business'; }
  function bizOwnerOf(id) { const b = adminList().find(x => x.id === id); return b ? b.ownerUserId : null; }

  pages.BusinessAdmin = function () {
    if (!H.isAdmin || !H.isAdmin()) return `<div class="page active">${innerTopbar('Business Admin')}${H.emptyState('Admins only', 'You do not have access to this area.')}</div>`;
    const list = adminList();
    const planName = (id) => (H.planEntitlements ? H.planEntitlements(id).name : id);
    const stPill = (s) => { const m = { active: ['#166534', '#dcfce7'], suspended: ['#991b1b', '#fee2e2'], draft: ['#475569', '#e2e8f0'], pending_activation: ['#92400e', '#fef3c7'] }[s] || ['#475569', '#e2e8f0']; return `<span style="font-size:10px;font-weight:800;color:${m[0]};background:${m[1]};border-radius:20px;padding:2px 8px">${escHtml(s)}</span>`; };

    const card = (b) => `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="min-width:0"><div style="font-size:14px;font-weight:800;color:var(--text)">${escHtml(b.name || 'Unnamed')}</div>
          <div style="font-size:11.5px;color:var(--sub);margin-top:2px">${escHtml([b.city, b.province].filter(Boolean).join(', ') || '—')} · ${escHtml(b.bizType || '')}</div></div>
        ${stPill(b.status)}
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:700;color:#1A3A8F;background:#1A3A8F12;border-radius:20px;padding:2px 9px">Plan: ${escHtml(planName(b.planId))}</span>
        <span style="font-size:11px;font-weight:700;color:#b45309;background:#FFF8EC;border-radius:20px;padding:2px 9px">Verify L${b.verificationLevel || 0}</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        ${(b.status === 'pending_activation' || b.status === 'draft')
          ? `<button onclick="H._bizAdmin.setStatus('${b.id}','active')" style="flex:1;padding:8px;border-radius:9px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">Approve</button>
             <button onclick="H._bizAdmin.setStatus('${b.id}','suspended')" style="flex:1;padding:8px;border-radius:9px;border:1px solid #FECACA;background:#FFF1F0;color:#EF4444;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Reject</button>`
          : b.status === 'suspended'
            ? `<button onclick="H._bizAdmin.setStatus('${b.id}','active')" style="flex:1;padding:8px;border-radius:9px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Activate</button>`
            : `<button onclick="H._bizAdmin.setStatus('${b.id}','suspended')" style="flex:1;padding:8px;border-radius:9px;border:1px solid #FECACA;background:#FFF1F0;color:#EF4444;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Suspend</button>`}
        <button onclick="H._bizAdmin.cycleVerify('${b.id}')" style="flex:1;padding:8px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Set verify</button>
        <button onclick="H._bizAdmin.cyclePlan('${b.id}')" style="flex:1;padding:8px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Set plan</button>
      </div>
    </div>`;

    const invoices = H.state.adminInvoices || [];
    const verifs   = H.state.adminVerifs || [];

    const invCard = (p) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--border,#E8ECF4)">
      <div style="min-width:0"><div style="font-size:13px;font-weight:700;color:var(--text)">${escHtml(bizNameOf(p.businessId))}</div>
        <div style="font-size:11px;color:var(--sub);margin-top:1px">${escHtml((p.description || p.type).replace(/\s*\[[a-z0-9]+\]\s*$/i, ''))} · ${typeof H.timeAgo === 'function' ? H.timeAgo(p.createdAt) : ''}</div></div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0"><span style="font-size:14px;font-weight:800;color:#1A3A8F">$${(p.amount || 0).toFixed(2)}</span>
        <button onclick="H._bizAdmin.markPaid('${p.id}')" style="padding:7px 12px;border-radius:9px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">Mark paid</button></div></div>`;

    const verCard = (v) => `<div style="padding:11px 0;border-bottom:1px solid var(--border,#E8ECF4)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="min-width:0"><div style="font-size:13px;font-weight:700;color:var(--text)">${escHtml(bizNameOf(v.businessId))}</div>
        <div style="font-size:11px;color:var(--sub);margin-top:1px">Level ${v.level} requested · ${typeof H.timeAgo === 'function' ? H.timeAgo(v.submittedAt) : ''}</div></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        ${v.idDoc ? `<button onclick="H._bizAdmin.viewDoc('${escHtml(v.idDoc)}')" style="padding:7px 10px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">ID doc</button>` : ''}
        ${v.regDoc ? `<button onclick="H._bizAdmin.viewDoc('${escHtml(v.regDoc)}')" style="padding:7px 10px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">Business doc</button>` : ''}
        <button onclick="H._bizAdmin.approveVerify('${v.id}','${v.businessId}',${v.level})" style="flex:1;min-width:90px;padding:8px;border-radius:9px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">Approve</button>
        <button onclick="H._bizAdmin.rejectVerify('${v.id}','${v.businessId}')" style="flex:1;min-width:90px;padding:8px;border-radius:9px;border:1px solid #FECACA;background:#FFF1F0;color:#EF4444;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">Reject</button>
      </div></div>`;

    const queue = (title, count, inner) => `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:4px 16px 8px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 6px">
        <div style="font-size:13px;font-weight:800;color:var(--text)">${title}</div>
        ${count ? `<span style="font-size:11px;font-weight:800;background:#FEE4E2;color:#B42318;border-radius:20px;padding:2px 9px">${count}</span>` : ''}</div>
      ${inner}</div>`;

    return `<div class="page active">
      ${innerTopbar('Business Platform — Admin')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#EEF2FB;border-radius:12px;padding:12px 14px;margin-bottom:14px">
          <div style="font-size:13px;color:var(--sub)">Total businesses</div>
          <div style="font-size:16px;font-weight:800;color:#1A3A8F">${list.length}</div>
        </div>
        ${(() => {
          const pendingBiz = list.filter(b => b.status === 'pending_activation' || b.status === 'draft');
          return queue('Businesses awaiting approval', pendingBiz.length,
            pendingBiz.length ? pendingBiz.map(card).join('') : `<div style="font-size:12.5px;color:var(--sub);padding:8px 0 12px">No businesses awaiting approval.</div>`);
        })()}
        ${queue('Pending invoices', invoices.length, invoices.length ? invoices.map(invCard).join('') : `<div style="font-size:12.5px;color:var(--sub);padding:8px 0 12px">No invoices awaiting payment.</div>`)}
        ${queue('Verification requests', verifs.length, verifs.length ? verifs.map(verCard).join('') : `<div style="font-size:12.5px;color:var(--sub);padding:8px 0 12px">No pending verification requests.</div>`)}
        <div style="font-size:13px;font-weight:800;color:var(--text);margin:4px 0 8px">All businesses</div>
        ${list.length ? list.map(card).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:24px 0">No businesses loaded. Pull to refresh or check admin access.</div>`}
      </div>
    </div>`;
  };

  const PLANS = ['free', 'starter', 'pro', 'premium'];

  H._bizAdmin = {
    open() {
      H.openInner('BusinessAdmin');
      Promise.all([H.fetchAllBusinesses(), H.fetchPendingInvoices(), H.fetchPendingBizVerifs()])
        .then(() => renderPage('BusinessAdmin'));
    },
    _find(id) { return adminList().find(b => b.id === id); },

    // Mark a pending invoice paid (admin reconciles off-app payment). If the
    // invoice is a plan upgrade ("... [planid]"), this is also what ACTIVATES the
    // plan — paid plans never activate until the admin confirms payment here.
    async markPaid(id) {
      const inv = (H.state.adminInvoices || []).find(x => x.id === id);
      H.state.adminInvoices = (H.state.adminInvoices || []).filter(x => x.id !== id); saveState();
      const sb = window.supabase;
      if (sb) { try { await sb.from('business_payments').update({ status: 'paid' }).eq('id', id); } catch (e) {} }
      if (inv && inv.type === 'subscription' && inv.description) {
        const m = inv.description.match(/\[([a-z0-9]+)\]\s*$/i);
        if (m && sb) {
          const planId = m[1];
          const cycle = /\(yearly\)/i.test(inv.description) ? 'yearly' : 'monthly';
          try { await sb.from('business_subscriptions').update({ status: 'downgraded' }).eq('business_id', inv.businessId).eq('status', 'active'); } catch (e) {}
          try { await sb.from('business_subscriptions').insert({ business_id: inv.businessId, plan_id: planId, billing_cycle: cycle, status: 'active' }); } catch (e) {}
          try { await sb.from('businesses').update({ plan_id: planId }).eq('id', inv.businessId); } catch (e) {}
          const b = this._find(inv.businessId); if (b) b.planId = planId;
          const owner = bizOwnerOf(inv.businessId);
          if (owner && H.pushNotif) H.pushNotif(owner, 'Plan activated', 'Your ' + planId.toUpperCase() + ' plan is now active.', 'info', null, 'BusinessView');
        }
      }
      toast('Invoice marked paid'); renderPage('BusinessAdmin');
    },

    // Approve a verification request: set the business verification level + notify owner.
    async approveVerify(vid, bizId, level) {
      level = Number(level) || 1;
      const sb = window.supabase;
      if (sb) {
        try { await sb.from('business_verifications').update({ status: 'approved' }).eq('id', vid); } catch (e) {}
        try { await sb.from('businesses').update({ verification_level: level }).eq('id', bizId); } catch (e) {}
      }
      const b = this._find(bizId); if (b) b.verificationLevel = level;
      H.state.adminVerifs = (H.state.adminVerifs || []).filter(x => x.id !== vid); saveState();
      try { const owner = bizOwnerOf(bizId); if (owner && H.pushNotif) H.pushNotif(owner, 'Business Verified', (bizNameOf(bizId)) + ' is now verified.', 'info', null, 'BusinessView'); } catch (e) {}
      toast('Verification approved'); renderPage('BusinessAdmin');
    },

    async rejectVerify(vid, bizId) {
      const sb = window.supabase; if (sb) { try { await sb.from('business_verifications').update({ status: 'rejected' }).eq('id', vid); } catch (e) {} }
      H.state.adminVerifs = (H.state.adminVerifs || []).filter(x => x.id !== vid); saveState();
      try { const owner = bizOwnerOf(bizId); if (owner && H.pushNotif) H.pushNotif(owner, 'Verification Not Approved', 'Your business verification needs more detail. Please resubmit.', 'report', null, 'BusinessView'); } catch (e) {}
      toast('Verification rejected'); renderPage('BusinessAdmin');
    },

    // Open a private verification document via a signed URL.
    async viewDoc(path) {
      const sb = window.supabase; if (!sb || !path) { toast('Document unavailable'); return; }
      try {
        const { data, error } = await sb.storage.from('verification-docs').createSignedUrl(path, 3600);
        if (error || !data || !data.signedUrl) { toast('Could not open document'); return; }
        window.open(data.signedUrl, '_blank');
      } catch (e) { toast('Could not open document'); }
    },
    async setStatus(id, status) {
      const prev = this._find(id);
      const wasPending = prev && (prev.status === 'pending_activation' || prev.status === 'draft');
      if (prev) { prev.status = status; saveState(); }
      const sb = window.supabase; if (sb) { try { await sb.from('businesses').update({ status }).eq('id', id); } catch (e) {} }
      // Notify the owner of the moderation decision.
      try {
        const owner = bizOwnerOf(id);
        if (owner && H.pushNotif) {
          if (status === 'active') {
            H.pushNotif(owner, 'Business approved', bizNameOf(id) + ' is now live on PaMarket.', 'business', null, 'BusinessView');
          } else if (status === 'suspended') {
            H.pushNotif(owner, wasPending ? 'Business not approved' : 'Business suspended',
              wasPending ? bizNameOf(id) + ' was not approved. Please review your details and resubmit.'
                         : bizNameOf(id) + ' has been suspended. Contact support for details.',
              'report', null, 'BusinessView');
          }
        }
      } catch (e) {}
      toast(status === 'active' ? 'Business approved' : (status === 'suspended' && wasPending ? 'Business rejected' : 'Business ' + status));
      renderPage('BusinessAdmin');
    },
    async cycleVerify(id) {
      const b = this._find(id); if (!b) return;
      b.verificationLevel = ((b.verificationLevel || 0) + 1) % 4; saveState();
      const sb = window.supabase; if (sb) { try { await sb.from('businesses').update({ verification_level: b.verificationLevel }).eq('id', id); } catch (e) {} }
      toast('Verification level ' + b.verificationLevel); renderPage('BusinessAdmin');
    },
    async cyclePlan(id) {
      const b = this._find(id); if (!b) return;
      const i = (PLANS.indexOf(b.planId) + 1) % PLANS.length; b.planId = PLANS[i]; saveState();
      const sb = window.supabase; if (sb) { try { await sb.from('businesses').update({ plan_id: b.planId }).eq('id', id); } catch (e) {} }
      toast('Plan: ' + b.planId); renderPage('BusinessAdmin');
    }
  };

})(window.H = window.H || {});
