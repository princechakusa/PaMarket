/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 *
 * MODULE 1 — BUSINESS ONBOARDING
 * Sign Up/Login → Create Business → Details → Category → Plan → Activate.
 * Mirrors the verify.js / post.js page pattern: pages registered on H.pages,
 * onclick handlers on the H._bizOnboard namespace, cloud writes wrapped in
 * try/catch so a missing table degrades gracefully to local-only state.
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
  const goBack      = () => H.goBack();

  // ── Subscription plans (reference) ──────────────────────────
  // Onboarding only needs these to record the owner's selection. The full
  // Subscription System (Module 3) owns pricing/feature enforcement; this list
  // is the selectable surface and must stay in sync with the plan_id CHECK
  // constraint in supabase/schema/businesses.sql.
  H.BIZ_PLANS = [
    { id: 'free',    name: 'Free',    price: 0,  limit: 3,    tagline: 'Get started',     features: ['Up to 3 listings', 'Basic visibility'] },
    { id: 'starter', name: 'Starter', price: 5,  limit: 15,   tagline: 'For small sellers',features: ['Up to 15 listings', 'Standard ranking', 'Basic analytics'] },
    { id: 'pro',     name: 'Pro',     price: 15, limit: 60,   tagline: 'Grow faster',      features: ['Up to 60 listings', 'Higher ranking', 'Full analytics', '1 featured slot'] },
    { id: 'premium', name: 'Premium', price: 40, limit: -1,   tagline: 'Maximum reach',    features: ['Unlimited listings', 'Top ranking', 'Full analytics', 'Featured placement'] }
  ];
  const STEPS = ['details', 'category', 'plan', 'activate'];
  const STEP_LABELS = { details: 'Details', category: 'Category', plan: 'Plan', activate: 'Activate' };

  // In-memory draft for the active onboarding session (one business at a time).
  let _draft = null;

  function blankDraft() {
    const u = currentUser() || {};
    return {
      id: H.uid(),
      ownerUserId: u.id || null,
      name: '', bizType: 'individual', description: '',
      phone: u.phone || '', whatsapp: '', email: u.email || '',
      province: '', city: '', suburb: '',
      category: '', planId: '', billingCycle: 'monthly',
      logo: null, cover: null,
      status: 'draft', onboardingStep: 'details', verificationLevel: 0,
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  function ensureDraft() {
    if (!_draft) {
      // Resume the most recent un-activated business if one exists, else start fresh.
      const u = currentUser();
      const mine = (H.state.businesses || []).filter(b => b.ownerUserId === (u && u.id));
      const pending = mine.find(b => b.status !== 'active' && b.status !== 'suspended');
      _draft = pending ? JSON.parse(JSON.stringify(pending)) : blankDraft();
    }
    return _draft;
  }

  // Persist the draft into H.state.businesses (upsert by id) and to the cloud.
  function persistDraft() {
    _draft.updatedAt = Date.now();
    H.state.businesses = H.state.businesses || [];
    const i = H.state.businesses.findIndex(b => b.id === _draft.id);
    const copy = JSON.parse(JSON.stringify(_draft));
    if (i >= 0) H.state.businesses[i] = copy; else H.state.businesses.push(copy);
    saveState();
    if (typeof H.saveBusinessToCloud === 'function') H.saveBusinessToCloud(copy);
  }

  // ── Cloud helpers (graceful if tables are not migrated yet) ──
  H.saveBusinessToCloud = async function (b) {
    const sb = window.supabase;
    if (!sb || !b) return;
    try {
      const row = {
        id: b.id, owner_user_id: b.ownerUserId,
        name: b.name || '', logo: b.logo || null, cover: b.cover || null,
        description: b.description || null, biz_type: b.bizType || 'individual',
        category: b.category || null, phone: b.phone || null,
        whatsapp: b.whatsapp || null, email: b.email || null,
        province: b.province || null, city: b.city || null, suburb: b.suburb || null,
        status: b.status || 'draft', onboarding_step: b.onboardingStep || 'details',
        verification_level: b.verificationLevel || 0
      };
      const { error } = await sb.from('businesses').upsert(row, { onConflict: 'id' });
      if (error) console.warn('saveBusinessToCloud:', error.message);
    } catch (e) { console.warn('saveBusinessToCloud error:', e); }
  };

  H.saveBusinessSubscriptionToCloud = async function (b) {
    const sb = window.supabase;
    if (!sb || !b || !b.planId) return;
    try {
      // Supersede any existing active subscription, then record the new one.
      await sb.from('business_subscriptions').update({ status: 'downgraded' })
        .eq('business_id', b.id).eq('status', 'active');
      const { error } = await sb.from('business_subscriptions').insert({
        business_id: b.id, plan_id: b.planId,
        billing_cycle: b.billingCycle || 'monthly', status: 'active'
      });
      if (error) console.warn('saveBusinessSubscriptionToCloud:', error.message);
    } catch (e) { console.warn('saveBusinessSubscriptionToCloud error:', e); }
  };

  H.fetchMyBusinesses = async function () {
    const sb = window.supabase;
    const u = currentUser();
    if (!sb || !u) return;
    try {
      const { data, error } = await sb.from('businesses').select('*').eq('owner_user_id', u.id);
      if (error || !Array.isArray(data)) return;
      H.state.businesses = H.state.businesses || [];
      data.forEach(row => {
        const mapped = {
          id: row.id, ownerUserId: row.owner_user_id, name: row.name || '',
          logo: row.logo, cover: row.cover, description: row.description,
          bizType: row.biz_type || 'individual', category: row.category,
          phone: row.phone, whatsapp: row.whatsapp, email: row.email,
          province: row.province, city: row.city, suburb: row.suburb,
          status: row.status || 'draft', onboardingStep: row.onboarding_step || 'details',
          verificationLevel: row.verification_level || 0,
          createdAt: new Date(row.created_at || Date.now()).getTime(),
          updatedAt: new Date(row.updated_at || Date.now()).getTime()
        };
        const i = H.state.businesses.findIndex(b => b.id === mapped.id);
        if (i >= 0) H.state.businesses[i] = Object.assign(H.state.businesses[i], mapped);
        else H.state.businesses.push(mapped);
      });
      saveState();
    } catch (e) { console.warn('fetchMyBusinesses error:', e); }
  };

  // ── Shared UI bits ──────────────────────────────────────────
  function progressBar(step) {
    const idx = STEPS.indexOf(step);
    return `<div style="display:flex;gap:6px;padding:14px 18px 4px">
      ${STEPS.map((s, i) => `
        <div style="flex:1;text-align:center">
          <div style="height:5px;border-radius:4px;background:${i <= idx ? 'linear-gradient(90deg,#F5A623,#ffc55c)' : '#E8ECF4'};transition:background .3s"></div>
          <div style="font-size:10.5px;font-weight:${i === idx ? 800 : 600};color:${i <= idx ? '#1A3A8F' : 'var(--sub)'};margin-top:5px">${STEP_LABELS[s]}</div>
        </div>`).join('')}
    </div>`;
  }

  const field = (label, inner, hint) => `
    <div class="fg" style="margin-bottom:14px">
      <div class="fl">${label}</div>
      ${inner}
      ${hint ? `<div style="font-size:11.5px;color:var(--sub);margin-top:4px">${hint}</div>` : ''}
    </div>`;

  // ── PAGE: Business Onboarding wizard ────────────────────────
  pages.BusinessOnboarding = function (params) {
    const u = currentUser();
    if (!u) return `<div class="page active">${innerTopbar('Create Business')}${H.emptyState('Sign in required', 'Sign in to create a business.', 'Sign In', 'H.authPage()')}</div>`;

    const d = ensureDraft();
    // Allow jumping to a specific step (only as far as already unlocked).
    if (params && params.step && STEPS.indexOf(params.step) <= STEPS.indexOf(d.onboardingStep)) {
      d.onboardingStep = params.step;
    }
    const step = STEPS.includes(d.onboardingStep) ? d.onboardingStep : 'details';

    let body = '';
    if (step === 'details')  body = stepDetails(d);
    if (step === 'category') body = stepCategory(d);
    if (step === 'plan')     body = stepPlan(d);
    if (step === 'activate') body = stepActivate(d);

    return `<div class="page active">
      ${innerTopbar('Create Business')}
      ${progressBar(step)}
      <div class="inner-content" style="padding-bottom:40px">${body}</div>
    </div>`;
  };

  // Step 1 — Business identity + details
  function stepDetails(d) {
    const provOpts = ['<option value="">Select province</option>']
      .concat(H.PROVINCES.map(p => `<option value="${p}" ${d.province === p ? 'selected' : ''}>${p}</option>`)).join('');
    const cities = H.CITIES_BY_PROV[d.province] || [];
    const cityOpts = ['<option value="">Select city / town</option>']
      .concat(cities.map(c => `<option value="${c}" ${d.city === c ? 'selected' : ''}>${c}</option>`)).join('');
    const typeBtn = (id, label, sub) => `
      <button type="button" onclick="H._bizOnboard.setType('${id}')"
        style="flex:1;text-align:left;padding:12px 14px;border-radius:14px;cursor:pointer;font-family:inherit;
        border:1.5px solid ${d.bizType === id ? '#1A3A8F' : 'var(--border,#E8ECF4)'};
        background:${d.bizType === id ? '#EEF2FB' : 'var(--card,#fff)'}">
        <div style="font-size:13.5px;font-weight:800;color:${d.bizType === id ? '#1A3A8F' : 'var(--text)'}">${label}</div>
        <div style="font-size:11px;color:var(--sub);margin-top:2px">${sub}</div>
      </button>`;

    return `
      <div style="font-size:13px;color:var(--sub);line-height:1.55;margin-bottom:16px">Tell buyers who you are. You can refine everything later from your dashboard.</div>
      ${field('Business name', `<input class="fi" id="bzName" placeholder="e.g. Tariro Electronics" value="${escHtml(d.name)}" maxlength="60">`)}
      ${field('Business type', `<div style="display:flex;gap:8px">
        ${typeBtn('individual', 'Individual', 'Sole trader / personal')}
        ${typeBtn('company', 'Company', 'Registered business')}
        ${typeBtn('agency', 'Agency', 'Multi-client agency')}
      </div>`)}
      ${field('Short description', `<textarea class="fi" id="bzDesc" rows="3" placeholder="What does your business sell or offer?" maxlength="300">${escHtml(d.description)}</textarea>`)}
      ${field('Contact phone', `<input class="fi" id="bzPhone" type="tel" placeholder="0771234567" value="${escHtml(d.phone)}">`, 'Buyers use this to call you.')}
      ${field('WhatsApp (optional)', `<input class="fi" id="bzWa" type="tel" placeholder="0771234567" value="${escHtml(d.whatsapp)}">`)}
      ${field('Contact email (optional)', `<input class="fi" id="bzEmail" type="email" placeholder="you@business.com" value="${escHtml(d.email)}">`)}
      ${field('Province', `<select class="fi" id="bzProv" onchange="H._bizOnboard.onProvince(this.value)">${provOpts}</select>`)}
      ${field('City / Town', `<select class="fi" id="bzCity">${cityOpts}</select>`)}
      ${field('Suburb / Area (optional)', `<input class="fi" id="bzSuburb" placeholder="e.g. Avondale" value="${escHtml(d.suburb)}">`)}
      <button class="btn-pri" style="width:100%;margin-top:6px" onclick="H._bizOnboard.next('details')">Continue</button>`;
  }

  // Step 2 — Category
  function stepCategory(d) {
    return `
      <div style="font-size:13px;color:var(--sub);line-height:1.55;margin-bottom:16px">Pick the category that best fits your business. It decides where your listings appear.</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:18px">
        ${H.CATEGORIES.map(c => `
          <button type="button" onclick="H._bizOnboard.setCategory('${c.id}')"
            style="display:flex;align-items:center;gap:10px;padding:14px 12px;border-radius:14px;cursor:pointer;font-family:inherit;text-align:left;
            border:1.5px solid ${d.category === c.id ? '#1A3A8F' : 'var(--border,#E8ECF4)'};
            background:${d.category === c.id ? '#EEF2FB' : 'var(--card,#fff)'};color:${d.category === c.id ? '#1A3A8F' : 'var(--text)'}">
            <span style="flex-shrink:0;color:#1A3A8F">${c.icon}</span>
            <span style="font-size:13.5px;font-weight:700">${c.name}</span>
          </button>`).join('')}
      </div>
      <div style="display:flex;gap:10px">
        <button class="ml-act-btn" style="flex:1;padding:13px" onclick="H._bizOnboard.back('category')">Back</button>
        <button class="btn-pri" style="flex:2" onclick="H._bizOnboard.next('category')">Continue</button>
      </div>`;
  }

  // Step 3 — Plan
  function stepPlan(d) {
    const cycle = d.billingCycle || 'monthly';
    const cycleBtn = (id, label) => `<button type="button" onclick="H._bizOnboard.setCycle('${id}')"
      style="flex:1;padding:9px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;
      border:1.5px solid ${cycle === id ? '#1A3A8F' : 'var(--border,#E8ECF4)'};
      background:${cycle === id ? '#1A3A8F' : 'var(--card,#fff)'};color:${cycle === id ? '#fff' : 'var(--text)'}">${label}</button>`;

    const priceOf = (p) => {
      if (p.price === 0) return 'Free';
      return cycle === 'yearly' ? `$${p.price * 10}/yr` : `$${p.price}/mo`;
    };

    return `
      <div style="font-size:13px;color:var(--sub);line-height:1.55;margin-bottom:14px">Choose a plan to activate your business. You can upgrade or downgrade anytime — even the Free plan must be selected to go live.</div>
      <div style="display:flex;gap:8px;margin-bottom:16px">${cycleBtn('monthly', 'Monthly')}${cycleBtn('yearly', 'Yearly · save 2 months')}</div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px">
        ${H.BIZ_PLANS.map(p => {
          const sel = d.planId === p.id;
          return `<button type="button" onclick="H._bizOnboard.setPlan('${p.id}')"
            style="text-align:left;padding:16px;border-radius:16px;cursor:pointer;font-family:inherit;
            border:2px solid ${sel ? '#1A3A8F' : 'var(--border,#E8ECF4)'};
            background:${sel ? '#EEF2FB' : 'var(--card,#fff)'};box-shadow:0 2px 8px rgba(16,24,40,.04)">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div style="font-size:16px;font-weight:800;color:${sel ? '#1A3A8F' : 'var(--text)'}">${p.name}</div>
              <div style="font-size:15px;font-weight:800;color:#1A3A8F">${priceOf(p)}</div>
            </div>
            <div style="font-size:12px;color:var(--sub);margin:2px 0 8px">${p.tagline}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${p.features.map(f => `<span style="font-size:11px;font-weight:600;color:#1A3A8F;background:#1A3A8F12;border-radius:20px;padding:3px 9px">${f}</span>`).join('')}
            </div>
          </button>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:10px">
        <button class="ml-act-btn" style="flex:1;padding:13px" onclick="H._bizOnboard.back('plan')">Back</button>
        <button class="btn-pri" style="flex:2" onclick="H._bizOnboard.next('plan')">Continue</button>
      </div>`;
  }

  // Step 4 — Activate (review)
  function stepActivate(d) {
    const plan = H.BIZ_PLANS.find(p => p.id === d.planId);
    const cat  = H.CATEGORIES.find(c => c.id === d.category);
    const typeLabel = { individual: 'Individual', company: 'Registered Company', agency: 'Agency' }[d.bizType] || d.bizType;
    const row = (k, v) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--border,#E8ECF4)">
      <span style="font-size:13px;color:var(--sub)">${k}</span>
      <span style="font-size:13px;font-weight:700;color:var(--text);text-align:right">${v}</span></div>`;
    const loc = [d.suburb, d.city, d.province].filter(Boolean).join(', ') || '—';

    return `
      <div style="font-size:13px;color:var(--sub);line-height:1.55;margin-bottom:16px">Review your details, then activate to get your business live on PaMarket.</div>
      <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;padding:4px 16px;margin-bottom:18px">
        ${row('Name', escHtml(d.name) || '—')}
        ${row('Type', typeLabel)}
        ${row('Category', cat ? cat.name : '—')}
        ${row('Phone', escHtml(d.phone) || '—')}
        ${row('Location', escHtml(loc))}
        ${row('Plan', plan ? `${plan.name} · ${d.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}` : '—')}
      </div>
      <div style="display:flex;gap:10px">
        <button class="ml-act-btn" style="flex:1;padding:13px" onclick="H._bizOnboard.back('activate')">Back</button>
        <button class="btn-pri" id="bzActivateBtn" style="flex:2" onclick="H._bizOnboard.activate()">${_mode === 'edit' ? 'Save Changes' : 'Activate Business'}</button>
      </div>`;
  }

  // After-render: restore the selected city in the Details step's dependent dropdown.
  pages.BusinessOnboarding_after = function () {
    const d = _draft;
    if (!d) return;
    const citySel = document.getElementById('bzCity');
    if (citySel && d.city) citySel.value = d.city;
  };

  // ── PAGE: Success ───────────────────────────────────────────
  pages.BusinessActivated = function () {
    const d = _draft || {};
    return `<div class="page active">
      ${innerTopbar('Business Activated')}
      <div class="inner-content" style="text-align:center;padding:48px 24px">
        <div style="width:76px;height:76px;border-radius:50%;background:#ECFDF5;display:flex;align-items:center;justify-content:center;margin:0 auto 18px">
          <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:8px">You're live!</div>
        <div style="font-size:13.5px;color:var(--sub);line-height:1.6;max-width:300px;margin:0 auto 28px">
          <b>${escHtml(d.name || 'Your business')}</b> is now active on PaMarket. Start adding listings to receive leads and track performance.
        </div>
        <button class="btn-pri" style="width:100%;max-width:300px;margin-bottom:10px" onclick="H._bizOnboard.view('${d.id}')">View My Business</button>
        <button class="ml-act-btn" style="width:100%;max-width:300px;padding:13px" onclick="H.navTo('Account')">Go to Account</button>
      </div>
    </div>`;
  };

  // ── PAGE: Business (standalone) ─────────────────────────────
  // The business's own page — opened from the Account row once a business
  // exists. Read-only overview for now; listings/analytics/settings arrive with
  // the Business Dashboard (Module 8) and will mount here.
  let _viewId = null;

  function getBiz(id) {
    return (H.state.businesses || []).find(b => b.id === id) || null;
  }
  function myBusinesses() {
    const u = currentUser();
    return (H.state.businesses || []).filter(b => b.ownerUserId === (u && u.id));
  }

  pages.BusinessView = function (params) {
    const u = currentUser();
    if (!u) return `<div class="page active">${innerTopbar('My Business')}${H.emptyState('Sign in required', 'Sign in to view your business.', 'Sign In', 'H.authPage()')}</div>`;

    const id = (params && params.id) || _viewId;
    const b = getBiz(id) || myBusinesses().find(x => x.status === 'active') || myBusinesses()[0];
    if (!b) {
      return `<div class="page active">${innerTopbar('My Business')}
        ${H.emptyState('No business yet', 'Create your business to start receiving leads.', 'Create a Business', 'H._bizOnboard.open()')}</div>`;
    }
    _viewId = b.id;

    // Still mid-setup → guide them back into the wizard instead of showing a blank profile.
    if (b.status !== 'active') {
      return `<div class="page active">${innerTopbar('My Business')}
        <div class="inner-content" style="text-align:center;padding:40px 24px">
          <div style="font-size:42px;margin-bottom:10px">🚧</div>
          <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">${escHtml(b.name || 'Your business')}</div>
          <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:24px">Setup isn't finished yet. Continue where you left off to activate it.</div>
          <button class="btn-pri" style="width:100%;max-width:300px" onclick="H._bizOnboard.edit('${b.id}')">Continue Setup</button>
        </div></div>`;
    }

    const plan = H.BIZ_PLANS.find(p => p.id === b.planId);
    const cat  = H.CATEGORIES.find(c => c.id === b.category);
    const typeLabel = { individual: 'Individual', company: 'Registered Company', agency: 'Agency' }[b.bizType] || b.bizType;
    const loc = [b.suburb, b.city, b.province].filter(Boolean).join(', ') || '—';
    const detail = (label, val) => val ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--border,#E8ECF4)">
        <span style="font-size:13px;color:var(--sub)">${label}</span>
        <span style="font-size:13px;font-weight:700;color:var(--text);text-align:right;max-width:62%">${val}</span></div>` : '';

    return `<div class="page active">
      ${innerTopbar('My Business')}

      <!-- Hero -->
      <div style="background:linear-gradient(135deg,#1A3A8F 0%,#0f2460 100%);padding:26px 20px;color:#fff">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:62px;height:62px;border-radius:16px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:24px;font-weight:800;overflow:hidden">
            ${b.logo ? `<img src="${escHtml(b.logo)}" style="width:100%;height:100%;object-fit:cover">` : escHtml(H.initials(b.name))}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:19px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(b.name)}</div>
            <div style="font-size:12.5px;color:rgba(255,255,255,.8);margin-top:2px">${typeLabel}${cat ? ' · ' + cat.name : ''}</div>
            <span style="display:inline-block;margin-top:8px;font-size:10.5px;font-weight:800;letter-spacing:.4px;background:#16a34a;color:#fff;border-radius:20px;padding:3px 10px">ACTIVE</span>
          </div>
        </div>
      </div>

      <div class="inner-content" style="padding-bottom:40px">
        <!-- Plan -->
        <div style="display:flex;align-items:center;justify-content:space-between;background:#EEF2FB;border-radius:14px;padding:14px 16px;margin-bottom:16px">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--sub);letter-spacing:.4px">CURRENT PLAN</div>
            <div style="font-size:16px;font-weight:800;color:#1A3A8F;margin-top:2px">${plan ? plan.name : 'Active'}${b.billingCycle ? ` · ${b.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}` : ''}</div>
          </div>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1A3A8F" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        </div>

        <!-- Details -->
        <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;padding:4px 16px;margin-bottom:18px">
          ${detail('Category', cat ? cat.name : '')}
          ${detail('Description', escHtml(b.description || ''))}
          ${detail('Phone', escHtml(b.phone || ''))}
          ${detail('WhatsApp', escHtml(b.whatsapp || ''))}
          ${detail('Email', escHtml(b.email || ''))}
          ${detail('Location', escHtml(loc))}
        </div>

        <button class="btn-pri" style="width:100%;margin-bottom:10px" onclick="H._bizOnboard.edit('${b.id}')">Edit Business Details</button>
        <button class="ml-act-btn" style="width:100%;padding:13px;margin-bottom:18px" onclick="H._bizOnboard.createAnother()">Create Another Business</button>

        <div style="display:flex;gap:10px;align-items:flex-start;background:#FFF8EC;border-radius:14px;padding:14px">
          <span style="font-size:18px">📊</span>
          <div style="font-size:12px;color:var(--sub);line-height:1.55"><b style="color:#1A3A8F">Listings, leads & analytics</b> for this business arrive with the Business Dashboard — coming next.</div>
        </div>
      </div>
    </div>`;
  };

  // ── Handlers ────────────────────────────────────────────────
  // Read the Details-step inputs into the draft (called before re-render so
  // typed values are never lost when a dropdown triggers a redraw).
  function collectDetails() {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : undefined; };
    const d = _draft; if (!d) return;
    const map = { bzName: 'name', bzDesc: 'description', bzPhone: 'phone', bzWa: 'whatsapp', bzEmail: 'email', bzProv: 'province', bzCity: 'city', bzSuburb: 'suburb' };
    Object.keys(map).forEach(id => { const val = v(id); if (val !== undefined) d[map[id]] = val; });
  }

  let _mode = 'create'; // 'create' | 'edit'

  H._bizOnboard = {
    // Called from the Account row. Routes to the right place depending on whether
    // the user already has a business — never dumps them into a blank new wizard.
    openFromAccount() {
      const mine = myBusinesses();
      const active = mine.find(b => b.status === 'active');
      if (active) { this.view(active.id); return; }          // has a live business → its page
      const pending = mine.find(b => b.status !== 'active' && b.status !== 'suspended');
      if (pending) { _mode = 'create'; _draft = JSON.parse(JSON.stringify(pending)); H.openInner('BusinessOnboarding'); return; } // resume setup
      this.open();                                            // none yet → start fresh
    },

    view(id) { _viewId = id || _viewId; H.openInner('BusinessView', { id: _viewId }); },

    edit(id) {
      const b = getBiz(id);
      if (!b) { toast('Business not found'); return; }
      _mode = 'edit';
      _draft = JSON.parse(JSON.stringify(b));
      _draft.onboardingStep = 'details';
      H.openInner('BusinessOnboarding');
    },

    createAnother() { _mode = 'create'; _draft = blankDraft(); H.openInner('BusinessOnboarding'); },

    open() { _mode = 'create'; _draft = null; ensureDraft(); H.openInner('BusinessOnboarding'); },

    setType(t) { ensureDraft(); collectDetails(); _draft.bizType = t; renderPage('BusinessOnboarding'); },

    onProvince(p) { ensureDraft(); collectDetails(); _draft.province = p; _draft.city = ''; renderPage('BusinessOnboarding'); },

    setCategory(c) { ensureDraft(); _draft.category = c; renderPage('BusinessOnboarding'); },

    setCycle(c) { ensureDraft(); _draft.billingCycle = c; renderPage('BusinessOnboarding'); },

    setPlan(p) { ensureDraft(); _draft.planId = p; renderPage('BusinessOnboarding'); },

    next(from) {
      const d = ensureDraft();
      if (from === 'details') {
        collectDetails();
        if (!d.name) { toast('Enter a business name'); return; }
        if (!d.phone) { toast('A contact phone is required'); return; }
        if (!/^(\+263|0)[0-9]{9}$/.test(d.phone)) { toast('Enter a valid Zimbabwe phone (e.g. 0771234567)'); return; }
        if (!d.province || !d.city) { toast('Select your province and city'); return; }
        d.onboardingStep = 'category';
      } else if (from === 'category') {
        if (!d.category) { toast('Pick a category'); return; }
        d.onboardingStep = 'plan';
      } else if (from === 'plan') {
        if (!d.planId) { toast('Select a plan to continue'); return; }
        d.onboardingStep = 'activate';
      }
      persistDraft();
      renderPage('BusinessOnboarding');
    },

    back(from) {
      const d = ensureDraft();
      const i = STEPS.indexOf(from);
      if (i > 0) { d.onboardingStep = STEPS[i - 1]; renderPage('BusinessOnboarding'); }
      else goBack();
    },

    async activate() {
      const d = ensureDraft();
      // Final invariant guard — every prior step must be complete.
      if (!d.name || !d.phone || !d.province || !d.city) { toast('Complete your business details first'); d.onboardingStep = 'details'; renderPage('BusinessOnboarding'); return; }
      if (!d.category) { toast('Pick a category first'); d.onboardingStep = 'category'; renderPage('BusinessOnboarding'); return; }
      if (!d.planId)   { toast('Select a plan first'); d.onboardingStep = 'plan'; renderPage('BusinessOnboarding'); return; }

      const btn = document.getElementById('bzActivateBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Activating…'; }

      const wasEdit = _mode === 'edit';
      d.status = 'active';
      d.onboardingStep = 'done';
      persistDraft();
      if (typeof H.saveBusinessSubscriptionToCloud === 'function') await H.saveBusinessSubscriptionToCloud(d);

      if (wasEdit) {
        _mode = 'create';
        toast('Business updated');
        _viewId = d.id;
        renderPage('BusinessView', { id: d.id });
        return;
      }

      if (typeof H.pushNotif === 'function') {
        try { H.pushNotif(currentUser().id, 'Business activated', `${d.name} is now live on PaMarket.`, 'business'); } catch (e) {}
      }
      toast('Business activated!');
      renderPage('BusinessActivated');
    }
  };

})(window.H = window.H || {});
