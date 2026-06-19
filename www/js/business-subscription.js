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
        ${isOwner && !cur ? `<button class="btn-pri" style="width:100%;margin-top:10px;padding:9px" onclick="H._bizSub.${higher ? 'upgrade' : 'downgrade'}('${b.id}','${p.id}')">${higher ? 'Request Upgrade' : 'Downgrade'}</button>` : ''}
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

        <!-- No in-app payments notice -->
        <div style="background:#EEF2FB;border:1px solid #c7d7f8;border-radius:14px;padding:16px;margin-top:8px">
          <div style="display:flex;align-items:flex-start;gap:10px">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#1A3A8F" stroke-width="2" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <div style="font-size:13px;font-weight:800;color:#1A3A8F;margin-bottom:4px">No payments in the app</div>
              <div style="font-size:12.5px;color:#475569;line-height:1.55">PaMarket does not process payments inside the app. Pressing "Request Upgrade" sends your request to the admin for approval. You will be contacted about payment arrangements before your plan is activated.</div>
              <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
                <a href="https://wa.me/263776543210" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#16a34a;color:#fff;border-radius:10px;padding:8px 14px;font-size:12.5px;font-weight:700;text-decoration:none;-webkit-tap-highlight-color:transparent">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M5.337 3.004A11.924 11.924 0 0 0 0 12.001c0 2.096.543 4.063 1.49 5.789L0 24l6.39-1.677A11.937 11.937 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0a11.924 11.924 0 0 0-6.663 2.004z"/></svg>
                  WhatsApp Us
                </a>
                <a href="mailto:support@pamarket.co.zw" style="display:inline-flex;align-items:center;gap:6px;background:var(--card);color:#1A3A8F;border:1.5px solid #1A3A8F;border-radius:10px;padding:8px 14px;font-size:12.5px;font-weight:700;text-decoration:none;-webkit-tap-highlight-color:transparent">Email Us</a>
              </div>
            </div>
          </div>
        </div>
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
      const cycle = b.billingCycle || 'monthly';
      const amount = p ? (cycle === 'yearly' ? p.price * 10 : p.price) : 0;
      const name = H.planEntitlements(planId).name;
      // Free (or no charge) applies immediately.
      if (planId === 'free' || amount <= 0) {
        setActivePlan(b, planId, cycle);
        toast('Plan changed to ' + name);
        renderPage('BusinessSubscription', { id });
        return;
      }
      // Paid plans are NOT activated on tap. We raise a pending invoice and the
      // plan activates only when an admin confirms the off-app payment. The
      // [planId] tag lets the admin's "Mark paid" action activate the right plan.
      const res = await H.chargeBusiness(id, 'subscription', amount, name + ' plan (' + cycle + ') [' + planId + ']');
      if (!res || !res.ok) { toast('Could not request the upgrade. Please try again.'); return; }
      toast('Upgrade requested. Your ' + name + ' plan activates once we confirm your payment.', 5000);
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
