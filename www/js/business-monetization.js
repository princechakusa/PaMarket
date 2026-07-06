/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE 11 — BILLING HISTORY
 * Read-only view of a business's Google Play Billing activity: subscription
 * purchases (play_subscriptions) and featured-slot-pack purchases
 * (featured_slot_packs). There is no payment logic here — all purchases are
 * made and verified elsewhere (billing.js triggers the purchase; the
 * verify-play-purchase / verify-play-subscription Edge Functions verify and
 * activate). This module only displays what already happened.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const escHtml = (s) => H.escHtml(s);
  const currentUser = () => H.currentUser();
  const innerTopbar = (...a) => H.innerTopbar(...a);

  function getBiz(id) { return (H.state.businesses || []).find(b => b.id === id) || null; }

  const SUB_STATE_BADGE = {
    active:          ['#EAF7EF', '#0f7a3d', 'Active'],
    in_grace_period: ['#FFF4D6', '#92670A', 'Grace period'],
    on_hold:         ['#FFF4D6', '#92670A', 'On hold'],
    canceled:        ['#FEE4E2', '#B42318', 'Canceled'],
    expired:         ['#F1F5F9', '#64748B', 'Expired'],
    paused:          ['#F1F5F9', '#64748B', 'Paused'],
    pending:         ['#EEF2FF', '#1A3A8F', 'Pending'],
  };
  const PACK_STATUS_BADGE = {
    consumed: ['#EAF7EF', '#0f7a3d', 'Active'],
    verified: ['#EEF2FF', '#1A3A8F', 'Verifying'],
    pending:  ['#FFF4D6', '#92670A', 'Pending'],
    failed:   ['#FEE4E2', '#B42318', 'Failed'],
  };

  async function fetchPlaySubscriptions(businessId) {
    const sb = window.supabase; if (!sb) return [];
    try {
      const { data, error } = await sb.from('play_subscriptions')
        .select('id,product_id,plan_id,billing_cycle,subscription_state,expiry_time,created_at')
        .eq('business_id', businessId).order('created_at', { ascending: false }).limit(20);
      return (!error && Array.isArray(data)) ? data : [];
    } catch (e) { return []; }
  }

  async function fetchSlotPacks(businessId) {
    const sb = window.supabase; if (!sb) return [];
    try {
      const { data, error } = await sb.from('featured_slot_packs')
        .select('id,product_id,extra_slots,status,created_at')
        .eq('business_id', businessId).order('created_at', { ascending: false }).limit(20);
      return (!error && Array.isArray(data)) ? data : [];
    } catch (e) { return []; }
  }

  var _billingData = {};

  pages.BusinessBilling = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Billing')}${H.emptyState('Business not found', '')}</div>`;
    const u = currentUser();
    if (!u || b.ownerUserId !== u.id) return `<div class="page active">${innerTopbar('Billing')}${H.emptyState('Owner only', 'Only the owner can view billing.')}</div>`;

    const data = _billingData[b.id];
    if (!data) {
      return `<div class="page active">${innerTopbar('Billing & Invoices')}<div class="inner-content"><div style="text-align:center;color:var(--sub);font-size:13px;padding:40px 0">Loading purchase history…</div></div></div>`;
    }

    const subRow = (s) => {
      const badge = SUB_STATE_BADGE[s.subscription_state] || SUB_STATE_BADGE.pending;
      const planName = (typeof H.planEntitlements === 'function' ? H.planEntitlements(s.plan_id).name : s.plan_id);
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border,#E8ECF4)">
        <div style="min-width:0"><div style="font-size:13.5px;font-weight:700;color:var(--text)">${escHtml(planName)} · ${escHtml(s.billing_cycle)}</div>
        <div style="font-size:11.5px;color:var(--sub);margin-top:2px">${s.expiry_time ? 'Renews/expires ' + new Date(s.expiry_time).toLocaleDateString() : ''}</div></div>
        <span style="font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:${badge[0]};color:${badge[1]};flex-shrink:0">${badge[2]}</span></div>`;
    };
    const packRow = (p) => {
      const badge = PACK_STATUS_BADGE[p.status] || PACK_STATUS_BADGE.pending;
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border,#E8ECF4)">
        <div style="min-width:0"><div style="font-size:13.5px;font-weight:700;color:var(--text)">+${p.extra_slots} featured slot${p.extra_slots === 1 ? '' : 's'}</div>
        <div style="font-size:11.5px;color:var(--sub);margin-top:2px">${new Date(p.created_at).toLocaleDateString()}</div></div>
        <span style="font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:${badge[0]};color:${badge[1]};flex-shrink:0">${badge[2]}</span></div>`;
    };

    return `<div class="page active">
      ${innerTopbar('Billing & Invoices')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="background:#EEF2FB;border:1px solid #c7d7f8;border-radius:14px;padding:14px 16px;margin-bottom:18px">
          <div style="font-size:13px;font-weight:800;color:#1A3A8F;margin-bottom:4px">Billed through Google Play</div>
          <div style="font-size:12.5px;color:#475569;line-height:1.55">All purchases are made and managed through Google Play. To update your payment method or cancel a subscription, use the Google Play Store app.</div>
        </div>

        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:6px">Subscription History</div>
        <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;padding:4px 16px;margin-bottom:18px">
          ${data.subs.length ? data.subs.map(subRow).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:20px 0">No subscription purchases yet.</div>`}
        </div>

        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:6px">Featured Slot Purchases</div>
        <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;padding:4px 16px">
          ${data.packs.length ? data.packs.map(packRow).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:20px 0">No slot purchases yet.</div>`}
        </div>
      </div>
    </div>`;
  };

  H._bizBilling = {
    open(id) {
      Promise.all([fetchPlaySubscriptions(id), fetchSlotPacks(id)]).then(([subs, packs]) => {
        _billingData[id] = { subs, packs };
        if (H.currentPageName === 'BusinessBilling') H.renderPage('BusinessBilling', { id });
      });
      H.openInner('BusinessBilling', { id });
    }
  };

})(window.H = window.H || {});
