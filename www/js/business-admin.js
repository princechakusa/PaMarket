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
      const { data, error } = await sb.from('businesses').select('*').order('created_at', { ascending: false }).limit(500);
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
        ${b.status === 'suspended'
          ? `<button onclick="H._bizAdmin.setStatus('${b.id}','active')" style="flex:1;padding:8px;border-radius:9px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Activate</button>`
          : `<button onclick="H._bizAdmin.setStatus('${b.id}','suspended')" style="flex:1;padding:8px;border-radius:9px;border:1px solid #FECACA;background:#FFF1F0;color:#EF4444;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Suspend</button>`}
        <button onclick="H._bizAdmin.cycleVerify('${b.id}')" style="flex:1;padding:8px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Set verify</button>
        <button onclick="H._bizAdmin.cyclePlan('${b.id}')" style="flex:1;padding:8px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Set plan</button>
      </div>
    </div>`;

    return `<div class="page active">
      ${innerTopbar('Business Platform — Admin')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#EEF2FB;border-radius:12px;padding:12px 14px;margin-bottom:14px">
          <div style="font-size:13px;color:var(--sub)">Total businesses</div>
          <div style="font-size:16px;font-weight:800;color:#1A3A8F">${list.length}</div>
        </div>
        ${list.length ? list.map(card).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:24px 0">No businesses loaded. Pull to refresh or check admin access.</div>`}
      </div>
    </div>`;
  };

  const PLANS = ['free', 'starter', 'pro', 'premium'];

  H._bizAdmin = {
    open() { H.openInner('BusinessAdmin'); H.fetchAllBusinesses().then(() => renderPage('BusinessAdmin')); },
    _find(id) { return adminList().find(b => b.id === id); },
    async setStatus(id, status) {
      const b = this._find(id); if (b) { b.status = status; saveState(); }
      const sb = window.supabase; if (sb) { try { await sb.from('businesses').update({ status }).eq('id', id); } catch (e) {} }
      toast('Business ' + status); renderPage('BusinessAdmin');
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
