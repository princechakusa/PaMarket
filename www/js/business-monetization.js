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

  // Core charge: deducts from the owner's wallet, records a payment row.
  H.chargeBusiness = async function (businessId, type, amount, description) {
    const b = getBiz(businessId);
    const u = currentUser();
    if (!b || !u) return { ok: false, msg: 'Not signed in' };
    amount = Number(amount) || 0;
    if (amount > 0) {
      const bal = H.walletBalance(u);
      if (bal < amount) return { ok: false, msg: 'Insufficient wallet balance — top up to continue' };
      setWallet(u, Math.round((bal - amount) * 100) / 100);
      const sb = window.supabase;
      if (sb) { try { await sb.from('profiles').update({ wallet_usd: H.walletBalance(u) }).eq('id', u.id); } catch (e) {} }
    }
    const row = { id: H.uid(), businessId, type, amount, description: description || type, status: 'paid', createdAt: Date.now() };
    payMap()[businessId] = [row].concat(payOf(businessId));
    saveState();
    const sb = window.supabase;
    if (sb) { try { await sb.from('business_payments').insert({ id: row.id, business_id: businessId, type, amount, description: row.description, status: 'paid' }); } catch (e) {} }
    return { ok: true };
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

  pages.BusinessBilling = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Billing')}${H.emptyState('Business not found', '')}</div>`;
    const u = currentUser();
    if (!u || b.ownerUserId !== u.id) return `<div class="page active">${innerTopbar('Billing')}${H.emptyState('Owner only', 'Only the owner can view billing.')}</div>`;
    const bal = H.walletBalance(u);
    const pays = payOf(b.id);
    const spent = pays.filter(p => p.status === 'paid').reduce((n, p) => n + (p.amount || 0), 0);

    const row = (p) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border,#E8ECF4)">
      <div><div style="font-size:13.5px;font-weight:700;color:var(--text)">${escHtml(p.description || TYPE_LABEL[p.type] || p.type)}</div>
      <div style="font-size:11.5px;color:var(--sub);margin-top:2px">${TYPE_LABEL[p.type] || p.type} · ${typeof H.timeAgo === 'function' ? H.timeAgo(p.createdAt) : ''}</div></div>
      <div style="font-size:14px;font-weight:800;color:#1A3A8F">$${(p.amount || 0).toFixed(2)}</div></div>`;

    return `<div class="page active">
      ${innerTopbar('Billing & Payments')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="display:flex;gap:10px;margin-bottom:16px">
          <div style="flex:1;background:linear-gradient(135deg,#1A3A8F,#0f2460);border-radius:16px;padding:16px;color:#fff">
            <div style="font-size:11px;color:rgba(255,255,255,.75);font-weight:700">WALLET</div>
            <div style="font-size:22px;font-weight:800;margin-top:2px">$${bal.toFixed(2)}</div>
          </div>
          <div style="flex:1;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;padding:16px">
            <div style="font-size:11px;color:var(--sub);font-weight:700">TOTAL SPENT</div>
            <div style="font-size:22px;font-weight:800;color:#1A3A8F;margin-top:2px">$${spent.toFixed(2)}</div>
          </div>
        </div>
        <button class="btn-pri" style="width:100%;margin-bottom:18px" onclick="H.openInner && H.openInner('TopUp')">Top Up Wallet</button>
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:6px">Payment history</div>
        <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;padding:4px 16px">
          ${pays.length ? pays.map(row).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:20px 0">No payments yet.</div>`}
        </div>
      </div>
    </div>`;
  };

  H._bizBilling = { open(id) { H._bizSubChargeTarget = id; H.fetchBusinessPayments(id).then(() => H.renderPage('BusinessBilling', { id })); H.openInner('BusinessBilling', { id }); } };

})(window.H = window.H || {});
