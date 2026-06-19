/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE 11 — MONETIZATION SYSTEM
 * Turns subscription upgrades and featured boosts into real charges against the
 * owner's wallet, records revenue in business_payments, and implements the
 * H.onSubscriptionCharge seam Module 3 calls. Featured/boost fees flow through
 * H.chargeBusiness. Listings themselves never take payment (leads only).
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const escHtml = (s) => H.escHtml(s);
  const toast = (...a) => H.toast(...a);
  const currentUser = () => H.currentUser();
  const innerTopbar = (...a) => H.innerTopbar(...a);
  const saveState = () => H.saveState();

  function getBiz(id) { return (H.state.businesses || []).find(b => b.id === id) || null; }
  function payMap() { H.state.businessPayments = H.state.businessPayments || {}; return H.state.businessPayments; }
  function payOf(id) { return payMap()[id] || []; }

  // Wallet helpers tolerate either field name used across the app.
  H.walletBalance = function (u) { if (!u) return 0; return Number(u.wallet_usd != null ? u.wallet_usd : (u.walletUsd != null ? u.walletUsd : 0)) || 0; };
  function setWallet(u, val) { u.wallet_usd = val; u.walletUsd = val; }

  // Featured pricing (USD).
  H.featuredPrice = function (days) { return Math.round(days * 0.5 * 100) / 100; };

  // Core charge: NO in-app payment (Google-safe). A paid plan/boost records a
  // PENDING invoice in business_payments; the owner pays off-app and an admin
  // marks it paid. The change is applied immediately so the seller isn't blocked;
  // the admin reconciles payment. Free (amount 0) creates no invoice.
  H.chargeBusiness = async function (businessId, type, amount, description) {
    const b = getBiz(businessId);
    const u = currentUser();
    if (!b || !u) return { ok: false, msg: 'Not signed in' };
    amount = Number(amount) || 0;
    if (amount <= 0) return { ok: true };
    const row = { id: H.uid(), businessId, type, amount, description: description || type, status: 'pending', createdAt: Date.now() };
    payMap()[businessId] = [row].concat(payOf(businessId));
    saveState();
    const sb = window.supabase;
    if (sb) { try { await sb.from('business_payments').insert({ id: row.id, business_id: businessId, type, amount, description: row.description, status: 'pending' }); } catch (e) {} }
    return { ok: true, invoice: row, pending: true };
  };

  // Module 3 calls this on upgrade. Free plan is, well, free.
  H.onSubscriptionCharge = async function (planId, cycle, amount) {
    if (!amount || planId === 'free') return { ok: true };
    // businessId isn't passed by Module 3's signature; charge the owner's wallet
    // against the business currently open in the subscription page.
    const bid = (H.currentPageParams && H.currentPageParams.id) || (H._bizSubChargeTarget);
    const res = await H.chargeBusiness(bid, 'subscription', amount, H.planEntitlements(planId).name + ' (' + cycle + ')');
    return res;
  };

  H.fetchBusinessPayments = async function (businessId) {
    const sb = window.supabase; if (!sb || !businessId) return payOf(businessId);
    try {
      const { data, error } = await sb.from('business_payments').select('*').eq('business_id', businessId).order('created_at', { ascending: false });
      if (error || !Array.isArray(data)) return payOf(businessId);
      payMap()[businessId] = data.map(r => ({ id: r.id, businessId: r.business_id, type: r.type, amount: Number(r.amount) || 0, description: r.description, status: r.status, createdAt: new Date(r.created_at || Date.now()).getTime() }));
      saveState();
      return payMap()[businessId];
    } catch (e) { return payOf(businessId); }
  };

  const TYPE_LABEL = { subscription: 'Subscription', featured: 'Featured', boost: 'Boost' };

  const STATUS_BADGE = {
    paid:     ['#EAF7EF', '#0f7a3d', 'Paid'],
    pending:  ['#FFF4D6', '#92670A', 'Awaiting payment'],
    failed:   ['#FEE4E2', '#B42318', 'Failed'],
    refunded: ['#EEF2FF', '#1A3A8F', 'Refunded']
  };

  pages.BusinessBilling = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Billing')}${H.emptyState('Business not found', '')}</div>`;
    const u = currentUser();
    if (!u || b.ownerUserId !== u.id) return `<div class="page active">${innerTopbar('Billing')}${H.emptyState('Owner only', 'Only the owner can view billing.')}</div>`;
    const pays = payOf(b.id);
    const paid = pays.filter(p => p.status === 'paid').reduce((n, p) => n + (p.amount || 0), 0);
    const outstanding = pays.filter(p => p.status === 'pending').reduce((n, p) => n + (p.amount || 0), 0);
    const support = H.state.supportWhatsapp || '';

    const row = (p) => {
      const s = STATUS_BADGE[p.status] || STATUS_BADGE.pending;
      const desc = (p.description || TYPE_LABEL[p.type] || p.type).replace(/\s*\[[a-z0-9]+\]\s*$/i, '');
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border,#E8ECF4)">
        <div style="min-width:0"><div style="font-size:13.5px;font-weight:700;color:var(--text)">${escHtml(desc)}</div>
        <div style="font-size:11.5px;color:var(--sub);margin-top:2px">${TYPE_LABEL[p.type] || p.type} · ${typeof H.timeAgo === 'function' ? H.timeAgo(p.createdAt) : ''}</div></div>
        <div style="text-align:right;flex-shrink:0"><div style="font-size:14px;font-weight:800;color:#1A3A8F">$${(p.amount || 0).toFixed(2)}</div>
        <span style="font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:${s[0]};color:${s[1]}">${s[2]}</span></div></div>`;
    };

    return `<div class="page active">
      ${innerTopbar('Billing & Invoices')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="display:flex;gap:10px;margin-bottom:14px">
          <div style="flex:1;background:linear-gradient(135deg,#F5A623,#e2920f);border-radius:16px;padding:16px;color:#fff">
            <div style="font-size:11px;color:rgba(255,255,255,.85);font-weight:700">OUTSTANDING</div>
            <div style="font-size:22px;font-weight:900;margin-top:2px">$${outstanding.toFixed(2)}</div>
          </div>
          <div style="flex:1;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;padding:16px">
            <div style="font-size:11px;color:var(--sub);font-weight:700">PAID</div>
            <div style="font-size:22px;font-weight:900;color:#1A3A8F;margin-top:2px">$${paid.toFixed(2)}</div>
          </div>
        </div>
        ${outstanding > 0 ? `<div style="display:flex;gap:10px;align-items:flex-start;background:#FFF8EC;border:1px solid #FFE2A8;border-radius:14px;padding:13px 14px;margin-bottom:14px">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#92670A" stroke-width="2" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div style="font-size:12.5px;color:#7a5a12;line-height:1.55">You have <b>$${outstanding.toFixed(2)}</b> awaiting payment. Your plan stays active — contact PaMarket to complete payment and we’ll mark the invoice paid.</div>
        </div>
        ${support ? `<a href="https://wa.me/${escHtml(support)}?text=${encodeURIComponent('Hi PaMarket, I want to pay my business invoice for ' + (b.name || ''))}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:#fff;border-radius:13px;padding:13px;font-size:14px;font-weight:800;text-decoration:none;margin-bottom:18px"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Pay via WhatsApp</a>` : ''}` : ''}
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:6px">Invoices</div>
        <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;padding:4px 16px">
          ${pays.length ? pays.map(row).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:20px 0">No invoices yet.</div>`}
        </div>
      </div>
    </div>`;
  };

  H._bizBilling = { open(id) { H._bizSubChargeTarget = id; H.fetchBusinessPayments(id).then(() => H.renderPage('BusinessBilling', { id })); H.openInner('BusinessBilling', { id }); } };

})(window.H = window.H || {});
