/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE 3 — SUBSCRIPTION SYSTEM
 * Single source of truth for plan entitlements + the subscription lifecycle
 * (active / scheduled / downgraded / expired) on top of the business_subscriptions
 * table from Module 1. Other modules read H.planEntitlements() — no scattered
 * limit literals. No payment here: H.onSubscriptionCharge is the Module 11 seam.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const escHtml = (s) => H.escHtml(s);
  const toast = (...a) => H.toast(...a);
  const currentUser = () => H.currentUser();
  const innerTopbar = (...a) => H.innerTopbar(...a);
  const saveState = () => H.saveState();
  const renderPage = (...a) => H.renderPage(...a);

  // ── Entitlements catalogue (single source of truth) ──────────
  H.PLAN_ENTITLEMENTS = {
    free:    { name: 'Free',    listingLimit: 3,  staffLimit: 0,        featuredSlots: 0, analytics: 'none',  rank: 0 },
    starter: { name: 'Starter', listingLimit: 15, staffLimit: 2,        featuredSlots: 0, analytics: 'basic', rank: 1 },
    pro:     { name: 'Pro',     listingLimit: 60, staffLimit: 10,       featuredSlots: 1, analytics: 'full',  rank: 2 },
    premium: { name: 'Premium', listingLimit: -1, staffLimit: Infinity, featuredSlots: 3, analytics: 'full',  rank: 3 }
  };
  H.planEntitlements = function (planId) { return H.PLAN_ENTITLEMENTS[planId] || H.PLAN_ENTITLEMENTS.free; };

  function getBiz(id) { return (H.state.businesses || []).find(b => b.id === id) || null; }
  function subsMap() { H.state.businessSubs = H.state.businessSubs || {}; return H.state.businessSubs; }
  function subsOf(id) { return subsMap()[id] || []; }

  // The active subscription, accounting for lapsed period when auto-renew is off.
  H.activeSubscription = function (businessId) {
    const rows = subsOf(businessId);
    let act = rows.find(s => s.status === 'active');
    if (act && act.currentPeriodEnd && !act.autoRenew && Date.now() > act.currentPeriodEnd) return null; // expired
    return act || null;
  };

  // Derived entitlements for a business — expired/none falls back to Free,
  // the business itself is NEVER locked out (subscription controls access, not existence).
  H.businessEntitlements = function (businessId) {
    const b = getBiz(businessId);
    const act = H.activeSubscription(businessId);
    const planId = (act && act.planId) || (b && b.planId) || 'free';
    const expired = !act && (b && b.planId && b.planId !== 'free');
    return H.planEntitlements(expired ? 'free' : planId);
  };

  // Apply due scheduled downgrades / expiries. Called on boot.
  H.processSubscriptionExpiry = function () {
    const now = Date.now();
    let changed = false;
    Object.keys(subsMap()).forEach(bid => {
      const rows = subsOf(bid);
      const act = rows.find(s => s.status === 'active');
      const sched = rows.find(s => s.status === 'scheduled');
      if (act && act.currentPeriodEnd && now > act.currentPeriodEnd) {
        if (sched) { // apply scheduled downgrade
          act.status = 'downgraded'; sched.status = 'active';
          sched.currentPeriodEnd = periodEnd(sched.billingCycle);
          const b = getBiz(bid); if (b) { b.planId = sched.planId; b.billingCycle = sched.billingCycle; }
          changed = true;
        } else if (!act.autoRenew) {
          act.status = 'expired';
          const b = getBiz(bid); if (b) { b.planId = 'free'; }
          changed = true;
        } else { // auto-renew: roll the period forward + raise a renewal invoice
          act.currentPeriodEnd = periodEnd(act.billingCycle);
          changed = true;
          // Google-safe: a paid renewal raises a PENDING invoice (admin marks paid).
          const b = getBiz(bid);
          const plan = (H.BIZ_PLANS || []).find(p => p.id === (act.planId || (b && b.planId)));
          const amount = plan ? (act.billingCycle === 'yearly' ? plan.price * 10 : plan.price) : 0;
          if (amount > 0 && typeof H.chargeBusiness === 'function') {
            H.chargeBusiness(bid, 'subscription', amount, (plan ? plan.name : 'Plan') + ' renewal (' + (act.billingCycle || 'monthly') + ')');
          }
        }
      }
    });
    if (changed) saveState();
  };

  function periodEnd(cycle) {
    const d = new Date();
    if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1);
    return d.getTime();
  }

  // Payment seam — Module 11 (Monetization) overrides this. Default: grant free.
  H.onSubscriptionCharge = H.onSubscriptionCharge || async function (planId, cycle, amount) { return { ok: true }; };

  // ── Cloud ────────────────────────────────────────────────────
  H.fetchBusinessSubscriptions = async function (businessId) {
    const sb = window.supabase; if (!sb || !businessId) return subsOf(businessId);
    try {
      const { data, error } = await sb.from('business_subscriptions').select('*').eq('business_id', businessId);
      if (error || !Array.isArray(data)) return subsOf(businessId);
      subsMap()[businessId] = data.map(r => ({
        id: r.id, businessId: r.business_id, planId: r.plan_id, billingCycle: r.billing_cycle,
        status: r.status, autoRenew: r.auto_renew !== false,
        currentPeriodEnd: r.current_period_end ? new Date(r.current_period_end).getTime() : null,
        createdAt: new Date(r.created_at || Date.now()).getTime()
      }));
      saveState();
      return subsMap()[businessId];
    } catch (e) { return subsOf(businessId); }
  };

  async function cloudUpsertSub(row) {
    const sb = window.supabase; if (!sb) return;
    try {
      await sb.from('business_subscriptions').upsert({
        id: row.id, business_id: row.businessId, plan_id: row.planId, billing_cycle: row.billingCycle,
        status: row.status, auto_renew: row.autoRenew,
        current_period_end: row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toISOString() : null
      }, { onConflict: 'id' });
    } catch (e) { console.warn('cloudUpsertSub:', e); }
  }

  // ── PAGE: Subscription ───────────────────────────────────────
  pages.BusinessSubscription = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Subscription')}${H.emptyState('Business not found', '')}</div>`;
    const u = currentUser();
    const isOwner = !!(u && b.ownerUserId === u.id);

    const act = H.activeSubscription(b.id);
    const ent = H.businessEntitlements(b.id);
    const curPlanId = (act && act.planId) || b.planId || 'free';
    const sched = subsOf(b.id).find(s => s.status === 'scheduled');
    const renewal = act && act.currentPeriodEnd ? new Date(act.currentPeriodEnd).toLocaleDateString() : '—';

    // Usage
    const staffUsed = ((H.state.businessStaff || {})[b.id] || []).filter(s => s.status !== 'removed').length;
    const listUsed = (H.state.listings || []).filter(l => l.businessId === b.id).length;
    const bar = (label, used, limit) => {
      const lim = limit < 0 || limit === Infinity ? '∞' : limit;
      const pct = (limit < 0 || limit === Infinity) ? 8 : Math.min(100, limit ? Math.round(used / limit * 100) : 0);
      return `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="color:var(--sub)">${label}</span><span style="font-weight:700;color:var(--text)">${used} / ${lim}</span></div>
        <div style="height:7px;background:#E8ECF4;border-radius:5px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#1A3A8F,#2952cc)"></div></div>
      </div>`;
    };

    const planCard = (p) => {
      const cur = p.id === curPlanId;
      const ents = H.planEntitlements(p.id);
      const higher = ents.rank > H.planEntitlements(curPlanId).rank;
      const price = (cyc => p.price === 0 ? 'Free' : (cyc === 'yearly' ? `$${p.price * 10}/yr` : `$${p.price}/mo`))(b.billingCycle);
      return `<div style="border:2px solid ${cur ? '#1A3A8F' : 'var(--border,#E8ECF4)'};border-radius:16px;padding:15px;margin-bottom:10px;background:${cur ? '#EEF2FB' : 'var(--card,#fff)'}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:15px;font-weight:800;color:${cur ? '#1A3A8F' : 'var(--text)'}">${p.name}${cur ? ' · Current' : ''}</div>
          <div style="font-size:14px;font-weight:800;color:#1A3A8F">${price}</div>
        </div>
        <div style="font-size:11.5px;color:var(--sub);margin-top:4px">${ents.listingLimit < 0 ? 'Unlimited' : ents.listingLimit} listings · ${ents.staffLimit === Infinity ? '∞' : ents.staffLimit} staff · ${ents.featuredSlots} featured</div>
        ${isOwner && !cur ? `<button class="btn-pri" style="width:100%;margin-top:10px;padding:9px" onclick="H._bizSub.${higher ? 'upgrade' : 'downgrade'}('${b.id}','${p.id}')">${higher ? 'Upgrade' : 'Downgrade'}</button>` : ''}
      </div>`;
    };

    return `<div class="page active">
      ${innerTopbar('Subscription')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="background:linear-gradient(135deg,#1A3A8F,#0f2460);border-radius:18px;padding:20px;color:#fff;margin-bottom:18px">
          <div style="font-size:12px;color:rgba(255,255,255,.75);font-weight:700;letter-spacing:.4px">CURRENT PLAN</div>
          <div style="font-size:24px;font-weight:800;margin-top:2px">${escHtml(ent.name)}</div>
          <div style="font-size:12.5px;color:rgba(255,255,255,.8);margin-top:4px">${b.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} · ${act ? 'Renews ' + renewal : 'No active billing period'}</div>
          ${sched ? `<div style="font-size:12px;color:#F5A623;margin-top:6px;font-weight:700">Scheduled: ${escHtml(H.planEntitlements(sched.planId).name)} from ${new Date(act.currentPeriodEnd).toLocaleDateString()}</div>` : ''}
        </div>

        <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;padding:16px;margin-bottom:18px">
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:12px">Usage</div>
          ${bar('Listings', listUsed, ent.listingLimit)}
          ${bar('Staff seats', staffUsed, ent.staffLimit)}
        </div>

        ${isOwner ? `<div style="display:flex;gap:8px;margin-bottom:16px">
          <button onclick="H._bizSub.setCycle('${b.id}','monthly')" style="flex:1;padding:9px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;border:1.5px solid ${b.billingCycle !== 'yearly' ? '#1A3A8F' : 'var(--border,#E8ECF4)'};background:${b.billingCycle !== 'yearly' ? '#1A3A8F' : 'var(--card,#fff)'};color:${b.billingCycle !== 'yearly' ? '#fff' : 'var(--text)'}">Monthly</button>
          <button onclick="H._bizSub.setCycle('${b.id}','yearly')" style="flex:1;padding:9px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;border:1.5px solid ${b.billingCycle === 'yearly' ? '#1A3A8F' : 'var(--border,#E8ECF4)'};background:${b.billingCycle === 'yearly' ? '#1A3A8F' : 'var(--card,#fff)'};color:${b.billingCycle === 'yearly' ? '#fff' : 'var(--text)'}">Yearly · save 2 months</button>
        </div>` : ''}

        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:10px">Plans</div>
        ${H.BIZ_PLANS.map(planCard).join('')}
      </div>
    </div>`;
  };

  // ── Handlers ─────────────────────────────────────────────────
  function setActivePlan(b, planId, cycle) {
    // Supersede any active row, write a new active one.
    const rows = subsOf(b.id);
    rows.forEach(s => { if (s.status === 'active') s.status = 'downgraded'; });
    const row = { id: H.uid(), businessId: b.id, planId, billingCycle: cycle || b.billingCycle || 'monthly',
      status: 'active', autoRenew: true, currentPeriodEnd: planId === 'free' ? null : periodEnd(cycle || b.billingCycle), createdAt: Date.now() };
    subsMap()[b.id] = rows.concat(row);
    b.planId = planId; b.billingCycle = row.billingCycle; b.updatedAt = Date.now();
    saveState();
    cloudUpsertSub(row);
    if (typeof H.saveBusinessToCloud === 'function') H.saveBusinessToCloud(b);
  }

  H._bizSub = {
    open(id) { H.fetchBusinessSubscriptions(id).then(() => renderPage('BusinessSubscription', { id })); H.openInner('BusinessSubscription', { id }); },

    async upgrade(id, planId) {
      const b = getBiz(id); if (!b) return;
      const p = H.BIZ_PLANS.find(x => x.id === planId);
      const amount = p ? (b.billingCycle === 'yearly' ? p.price * 10 : p.price) : 0;
      const charge = await H.onSubscriptionCharge(planId, b.billingCycle, amount);
      if (!charge || !charge.ok) { toast('Could not change plan — please try again'); return; }
      setActivePlan(b, planId, b.billingCycle);
      if (charge.pending) toast('Upgraded to ' + H.planEntitlements(planId).name + ' — invoice created. Open Billing to pay.', 4500);
      else toast('Plan changed to ' + H.planEntitlements(planId).name);
      renderPage('BusinessSubscription', { id });
    },

    downgrade(id, planId) {
      const b = getBiz(id); if (!b) return;
      const act = H.activeSubscription(id);
      if (!act || !act.currentPeriodEnd || planId === 'free') {
        // No active paid period → apply immediately.
        setActivePlan(b, planId, b.billingCycle);
        toast('Plan changed to ' + H.planEntitlements(planId).name);
        renderPage('BusinessSubscription', { id }); return;
      }
      // Schedule at period end.
      const rows = subsOf(id).filter(s => s.status !== 'scheduled');
      const row = { id: H.uid(), businessId: id, planId, billingCycle: b.billingCycle, status: 'scheduled', autoRenew: true, currentPeriodEnd: null, createdAt: Date.now() };
      subsMap()[id] = rows.concat(row);
      saveState(); cloudUpsertSub(row);
      toast('Downgrade scheduled for end of period');
      renderPage('BusinessSubscription', { id });
    },

    setCycle(id, cycle) {
      const b = getBiz(id); if (!b) return;
      b.billingCycle = cycle; b.updatedAt = Date.now();
      const act = H.activeSubscription(id);
      if (act) { act.billingCycle = cycle; act.currentPeriodEnd = act.planId === 'free' ? null : periodEnd(cycle); cloudUpsertSub(act); }
      saveState();
      if (typeof H.saveBusinessToCloud === 'function') H.saveBusinessToCloud(b);
      renderPage('BusinessSubscription', { id });
    }
  };

})(window.H = window.H || {});
