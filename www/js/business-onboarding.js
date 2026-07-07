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
  // Prices must match the real Google Play Console subscription prices
  // exactly (shop_starter/shop_pro/shop_premium) — Google's own purchase
  // sheet is the actual source of truth and will show these prices
  // regardless of what's displayed here, but this label must never
  // contradict it.
  H.BIZ_PLANS = [
    { id: 'free',    name: 'Free',    price: 0,     limit: 3,    tagline: 'Get started',     features: ['Up to 3 listings', 'Basic visibility'] },
    { id: 'starter', name: 'Starter', price: 9.99,  limit: 15,   tagline: 'For small sellers',features: ['Up to 15 listings', 'Standard ranking', 'Basic analytics'] },
    { id: 'pro',     name: 'Pro',     price: 19.99, limit: 60,   tagline: 'Grow faster',      features: ['Up to 60 listings', 'Higher ranking', 'Full analytics', '1 featured slot'] },
    { id: 'premium', name: 'Premium', price: 29.99, limit: -1,   tagline: 'Maximum reach',    features: ['Unlimited listings', 'Top ranking', 'Full analytics', 'Featured placement'] }
  ];

  // ── Category compatibility ───────────────────────────────────
  // Affinity groups: a business may only pick from ONE non-universal group.
  // Services and Other are universal — they pair with any group.
  H.BIZ_CAT_GROUPS = [
    { id: 'home',      label: 'Home & Property',        cats: ['property', 'furniture', 'rooms'] },
    { id: 'transport', label: 'Vehicles & Transport',   cats: ['vehicles'] },
    { id: 'style',     label: 'Fashion & Electronics',  cats: ['fashion', 'kids', 'electronics'] },
    { id: 'nature',    label: 'Agriculture & Pets',     cats: ['agriculture', 'pets'] },
    { id: 'work',      label: 'Jobs & Recruitment',     cats: ['jobs'] },
    { id: 'universal', label: 'Universal',              cats: ['services', 'other'] },
  ];

  // Returns { ok: true } or { ok: false, msg: '...' }
  H.bizCatCompat = function (existing, newCat) {
    var groups   = H.BIZ_CAT_GROUPS;
    var univCats = (groups.find(function(g){ return g.id === 'universal'; }) || {}).cats || [];
    if (univCats.includes(newCat)) return { ok: true };

    var newGroup = groups.find(function(g){ return g.id !== 'universal' && g.cats.includes(newCat); });
    if (!newGroup) return { ok: true };

    var usedGroups = [];
    (existing || []).forEach(function(c) {
      if (univCats.includes(c)) return;
      var g = groups.find(function(gr){ return gr.id !== 'universal' && gr.cats.includes(c); });
      if (g && !usedGroups.find(function(x){ return x.id === g.id; })) usedGroups.push(g);
    });

    if (usedGroups.length === 0 || usedGroups.find(function(g){ return g.id === newGroup.id; })) return { ok: true };

    var clash = usedGroups[0];
    return {
      ok:  false,
      msg: newGroup.label + ' does not match ' + clash.label + '. Choose categories from the same type of business.'
    };
  };
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
      categories: [], category: '', planId: '', billingCycle: 'monthly',
      logo: null, cover: null,
      status: 'draft', onboardingStep: 'details', verificationLevel: 0,
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  function ensureDraft() {
    if (!_draft) {
      // Resume a still-incomplete draft only. A business already submitted for
      // review (pending_activation), live (active) or suspended must NOT reopen
      // as an editable onboarding draft — edits go through BusinessView instead.
      const u = currentUser();
      const mine = (H.state.businesses || []).filter(b => b.ownerUserId === (u && u.id));
      const draft = mine.find(b => b.status === 'draft');
      _draft = draft ? JSON.parse(JSON.stringify(draft)) : blankDraft();
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
  // Columns that may be absent on a not-yet-migrated database. If Postgres
  // rejects the write with "could not find column X", we strip X and retry so
  // onboarding still completes instead of looping on a 400. Run
  // supabase/migrations/stabilize_schema_2026_06.sql to enable these features.
  const _BIZ_OPTIONAL_COLS = ['featured_listing_ids'];

  H.saveBusinessToCloud = async function (b) {
    const sb = window.supabase;
    if (!sb || !b) return { ok: false };
    const row = {
      id: b.id, owner_user_id: b.ownerUserId,
      name: b.name || '', logo: b.logo || null, cover: b.cover || null,
      description: b.description || null, biz_type: b.bizType || 'individual',
      category: (Array.isArray(b.categories) && b.categories.length ? b.categories.join('|') : (b.category || null)), phone: b.phone || null,
      whatsapp: b.whatsapp || null, email: b.email || null,
      province: b.province || null, city: b.city || null, suburb: b.suburb || null,
      status: b.status || 'draft', onboarding_step: b.onboardingStep || 'details',
      verification_level: b.verificationLevel || 0,
      featured_listing_ids: (b.featuredListingIds && b.featuredListingIds.length) ? b.featuredListingIds : null,
      updated_at: new Date().toISOString()
    };
    // Try the full row, then progressively drop optional columns the DB rejects.
    for (let attempt = 0; attempt <= _BIZ_OPTIONAL_COLS.length; attempt++) {
      try {
        const { error } = await sb.from('businesses').upsert(row, { onConflict: 'id' });
        if (!error) return { ok: true };
        // PostgREST schema-cache miss reports code PGRST204 / "could not find the X column".
        const missing = _BIZ_OPTIONAL_COLS.find(function (c) {
          return c in row && (error.message || '').indexOf(c) !== -1;
        });
        if (missing) { delete row[missing]; continue; } // retry without it
        console.warn('saveBusinessToCloud:', error.message);
        return { ok: false, error: error };
      } catch (e) {
        console.warn('saveBusinessToCloud error:', e);
        return { ok: false, error: e };
      }
    }
    return { ok: false };
  };

  H.saveBusinessSubscriptionToCloud = async function (b) {
    const sb = window.supabase;
    if (!sb || !b || !b.planId) return;
    // Paid plans are NEVER recorded from the client — they activate only
    // through a verified Google Play purchase (verify-play-subscription →
    // activate_play_subscription). The DB additionally enforces this with a
    // restrictive RLS policy (client inserts limited to plan_id='free'), so
    // this early-return is UX, not the security boundary. Picking a paid
    // plan during onboarding just routes the owner to the upgrade purchase
    // on their Subscription page.
    if (b.planId !== 'free') return;
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
      const { data, error } = await sb.from('businesses').select('id,owner_user_id,name,logo,cover,description,biz_type,category,phone,whatsapp,email,province,city,suburb,status,onboarding_step,verification_level,created_at,updated_at').eq('owner_user_id', u.id).limit(10);
      if (error || !Array.isArray(data)) return;
      H.state.businesses = H.state.businesses || [];
      data.forEach(row => {
        const mapped = {
          id: row.id, ownerUserId: row.owner_user_id, name: row.name || '',
          logo: row.logo, cover: row.cover, description: row.description,
          bizType: row.biz_type || 'individual', categories: (row.category || '').split('|').filter(Boolean), category: (row.category || '').split('|')[0] || null,
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

  // Step 2 — Category (multi-select)
  function stepCategory(d) {
    const sel = Array.isArray(d.categories) ? d.categories : (d.category ? [d.category] : []);
    return `
      <div style="font-size:13px;color:var(--sub);line-height:1.55;margin-bottom:6px">Select all categories that match your business. You can pick more than one.</div>
      ${sel.length ? `<div style="font-size:12px;color:#1A3A8F;font-weight:700;margin-bottom:12px">${sel.length} selected</div>` : `<div style="font-size:12px;color:var(--sub);margin-bottom:12px">None selected yet</div>`}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:18px">
        ${H.CATEGORIES.map(c => {
          const active = sel.includes(c.id);
          return `<button type="button" onclick="H._bizOnboard.setCategory('${c.id}')"
            style="display:flex;align-items:center;gap:10px;padding:14px 12px;border-radius:14px;cursor:pointer;font-family:inherit;text-align:left;position:relative;
            border:1.5px solid ${active ? '#1A3A8F' : 'var(--border,#E8ECF4)'};
            background:${active ? '#EEF2FB' : 'var(--card,#fff)'};color:${active ? '#1A3A8F' : 'var(--text)'}">
            <span style="flex-shrink:0;color:#1A3A8F">${c.icon}</span>
            <span style="font-size:13.5px;font-weight:700;flex:1">${c.name}</span>
            ${active ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#1A3A8F" stroke-width="3" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </button>`;
        }).join('')}
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
          const popular = p.id === 'pro';
          return `<button type="button" onclick="H._bizOnboard.setPlan('${p.id}')"
            style="position:relative;text-align:left;padding:16px;border-radius:16px;cursor:pointer;font-family:inherit;
            border:2px solid ${sel ? '#1A3A8F' : (popular ? '#F5A623' : 'var(--border,#E8ECF4)')};
            background:${sel ? '#EEF2FB' : 'var(--card,#fff)'};box-shadow:0 2px 8px rgba(16,24,40,.04)">
            ${popular ? `<span style="position:absolute;top:-9px;right:14px;background:#F5A623;color:#fff;font-size:9.5px;font-weight:900;letter-spacing:.4px;padding:3px 9px;border-radius:20px">MOST POPULAR</span>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div style="display:flex;align-items:center;gap:9px">
                <span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;border:2px solid ${sel ? '#1A3A8F' : 'var(--border,#CBD2E0)'};background:${sel ? '#1A3A8F' : 'transparent'};display:flex;align-items:center;justify-content:center">${sel ? '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</span>
                <div style="font-size:16px;font-weight:800;color:${sel ? '#1A3A8F' : 'var(--text)'}">${p.name}</div>
              </div>
              <div style="font-size:15px;font-weight:800;color:#1A3A8F">${priceOf(p)}</div>
            </div>
            <div style="font-size:12px;color:var(--sub);margin:6px 0 8px 27px">${p.tagline}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-left:27px">
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
    const selCats = Array.isArray(d.categories) ? d.categories : (d.category ? [d.category] : []);
    const catLabel = selCats.map(id => ((H.CATEGORIES.find(c => c.id === id) || {}).name || '')).filter(Boolean).join(', ') || '—';
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
        ${row('Categories', escHtml(catLabel))}
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
      ${innerTopbar('Submitted for Review')}
      <div class="inner-content" style="text-align:center;padding:48px 24px">
        <div style="width:76px;height:76px;border-radius:50%;background:#FEF6E7;display:flex;align-items:center;justify-content:center;margin:0 auto 18px">
          <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#B45309" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
        </div>
        <div style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:8px">Submitted for review</div>
        <div style="font-size:13.5px;color:var(--sub);line-height:1.6;max-width:320px;margin:0 auto 28px">
          <b>${escHtml(d.name || 'Your business')}</b> has been sent for approval. We review new shops to keep PaMarket safe, and you will be notified once it is approved and live. You can prepare your listings in the meantime.
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
    if (!u) return `<div class="page active">${innerTopbar('Seller Center')}${H.emptyState('Sign in required', 'Sign in to view your business.', 'Sign In', 'H.authPage()')}</div>`;

    const id = (params && params.id) || _viewId;
    const b = getBiz(id) || myBusinesses().find(x => x.status === 'active') || myBusinesses()[0];
    if (!b) {
      return `<div class="page active">${innerTopbar('Seller Center')}
        ${H.emptyState('No business yet', 'Create your business to start receiving leads.', 'Create a Business', 'H._bizOnboard.open()')}</div>`;
    }
    _viewId = b.id;

    // Not live yet → show the right state: still a draft (resume wizard),
    // submitted for review (waiting on admin), or suspended.
    if (b.status !== 'active') {
      if (b.status === 'pending_activation') {
        return `<div class="page active">${innerTopbar('Seller Center')}
          <div class="inner-content" style="text-align:center;padding:40px 24px">
            <div style="width:64px;height:64px;border-radius:50%;background:#FEF6E7;display:flex;align-items:center;justify-content:center;margin:0 auto 14px"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#B45309" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 7 12 12 15 14"/></svg></div>
            <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">${escHtml(b.name || 'Your business')}</div>
            <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:24px">Submitted for review. We will notify you once it is approved and live.</div>
            <button class="ml-act-btn" style="width:100%;max-width:300px;padding:13px" onclick="H.navTo('Account')">Go to Account</button>
          </div></div>`;
      }
      if (b.status === 'suspended') {
        return `<div class="page active">${innerTopbar('Seller Center')}
          <div class="inner-content" style="text-align:center;padding:40px 24px">
            <div style="width:64px;height:64px;border-radius:50%;background:#FFF1F0;display:flex;align-items:center;justify-content:center;margin:0 auto 14px"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#EF4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
            <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">${escHtml(b.name || 'Your business')}</div>
            <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:24px">This business has been suspended. Please contact support if you believe this was a mistake.</div>
            <button class="ml-act-btn" style="width:100%;max-width:300px;padding:13px" onclick="H.navTo('Account')">Go to Account</button>
          </div></div>`;
      }
      return `<div class="page active">${innerTopbar('Seller Center')}
        <div class="inner-content" style="text-align:center;padding:40px 24px">
          <div style="width:64px;height:64px;border-radius:50%;background:#EEF2FB;display:flex;align-items:center;justify-content:center;margin:0 auto 14px"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#1A3A8F" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">${escHtml(b.name || 'Your business')}</div>
          <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:24px">Setup isn't finished yet. Continue where you left off to submit it for review.</div>
          <button class="btn-pri" style="width:100%;max-width:300px" onclick="H._bizOnboard.edit('${b.id}')">Continue Setup</button>
        </div></div>`;
    }

    const plan = H.BIZ_PLANS.find(p => p.id === b.planId);
    const _vCats = b.categories && b.categories.length ? b.categories : (b.category ? [b.category] : []);
    const catLabel = _vCats.map(id => ((H.CATEGORIES.find(c => c.id === id) || {}).name || '')).filter(Boolean).join(' / ') || '';
    const typeLabel = { individual: 'Individual', company: 'Registered Company', agency: 'Agency' }[b.bizType] || b.bizType;
    const loc = [b.suburb, b.city, b.province].filter(Boolean).join(', ') || '—';
    const detail = (label, val) => val ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--border,#E8ECF4)">
        <span style="font-size:13px;color:var(--sub)">${label}</span>
        <span style="font-size:13px;font-weight:700;color:var(--text);text-align:right;max-width:62%">${val}</span></div>` : '';

    return `<div class="page active">
      ${innerTopbar('Seller Center')}

      <!-- Hero -->
      <div style="background:linear-gradient(135deg,#1A3A8F 0%,#0f2460 100%);padding:26px 20px;color:#fff">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:62px;height:62px;border-radius:16px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:24px;font-weight:800;overflow:hidden">
            ${b.logo ? `<img src="${escHtml(b.logo)}${b.logo.startsWith('data:') ? '' : '?v=' + (b._updatedAt||b.updatedAt||'')}" style="width:100%;height:100%;object-fit:cover">` : escHtml(H.initials(b.name))}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:19px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(b.name)}</div>
            <div style="font-size:12.5px;color:rgba(255,255,255,.8);margin-top:2px">${typeLabel}${catLabel ? ' · ' + catLabel : ''}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              ${(b.verificationLevel||0) >= 2 ? '<span style="font-size:10px;font-weight:800;background:#EAF7EF;color:#0f7a3d;border-radius:20px;padding:3px 9px">✓ Verified</span>' : ''}
              <span style="font-size:10px;font-weight:800;background:#FFE9C7;color:#92670A;border-radius:20px;padding:3px 9px">${(plan ? plan.name : 'Free').toUpperCase()}</span>
              <span style="font-size:10px;font-weight:800;background:rgba(255,255,255,.2);color:#cfe9d6;border-radius:20px;padding:3px 9px">● Active</span>
            </div>
          </div>
          ${myBusinesses().length > 1 ? `<button onclick="H._bizOnboard.switcher()" style="align-self:flex-start;background:rgba(255,255,255,.16);border:none;color:#fff;font-size:11px;font-weight:700;padding:6px 11px;border-radius:20px;cursor:pointer;font-family:inherit">Switch ▾</button>` : ''}
        </div>

        <!-- Live dashboard -->
        ${(() => {
          const mine = (H.state.listings || []).filter(l => l.businessId === b.id);
          const views = mine.reduce((n, l) => n + (l.views || 0), 0);
          const activeL = mine.filter(l => l.status === 'active').length;
          const leads = ((H.state.businessLeads || {})[b.id] || []);
          const newLeads = leads.filter(l => l.status === 'new').length;
          const boosts = mine.filter(l => typeof H.isFeatured === 'function' && H.isFeatured(l)).length;
          const vstr = views >= 1000 ? (views/1000).toFixed(1).replace(/\.0$/,'') + 'k' : String(views);
          const sc = (val, label) => `<div style="background:rgba(255,255,255,.12);border-radius:12px;padding:9px 6px;text-align:center"><div style="font-size:18px;font-weight:900;line-height:1">${val}</div><div style="font-size:9.5px;color:#cfe0ff;margin-top:3px;font-weight:600">${label}</div></div>`;
          return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px">${sc(activeL,'Listings')}${sc(newLeads,'New leads')}${sc(vstr,'Views')}${sc(boosts,'Boosts')}</div>`;
        })()}
      </div>

      <div class="inner-content" style="padding-bottom:40px">
        <!-- Quick actions -->
        <div style="display:flex;gap:9px;margin:14px 0 4px">
          <button onclick="H._bizListings.open('${b.id}')" style="flex:1;background:linear-gradient(135deg,#F5A623,#e2920f);border:none;color:#fff;border-radius:13px;padding:11px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:5px;align-items:center"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Listing</button>
          <button onclick="H._bizFeat.open('${b.id}')" style="flex:1;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);color:#1A3A8F;border-radius:13px;padding:11px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:5px;align-items:center"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#1A3A8F" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Boost</button>
          <button onclick="H._bizAnalytics.open('${b.id}')" style="flex:1;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);color:#1A3A8F;border-radius:13px;padding:11px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:5px;align-items:center"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#1A3A8F" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-6"/></svg>Analytics</button>
        </div>

        ${(() => {
          const mine = (H.state.listings || []).filter(l => l.businessId === b.id);
          const activeL = mine.filter(l => l.status === 'active').length;
          const leads = ((H.state.businessLeads || {})[b.id] || []);
          const newLeads = leads.filter(l => l.status === 'new').length;
          const boosts = mine.filter(l => typeof H.isFeatured === 'function' && H.isFeatured(l)).length;
          const replies = ((H.state.businessReplies || {})[b.id] || []).length;
          const verified = (b.verificationLevel || 0) >= 2;
          const ico = (p) => `<span style="width:34px;height:34px;border-radius:9px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#1A3A8F"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">${p}</svg></span>`;
          const valTxt = (t) => `<span style="font-size:12px;font-weight:700;color:var(--sub2,#98A2B3)">${t}</span>`;
          const pill = (t, bg, c) => `<span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;background:${bg};color:${c}">${t}</span>`;
          const mi = (icon, name, right, onclick) => `<button onclick="${onclick}" style="display:flex;align-items:center;gap:13px;padding:13px 15px;width:100%;background:none;border:none;border-bottom:1px solid var(--border,#F0F2F6);text-align:left;cursor:pointer;font-family:inherit">${icon}<span style="flex:1;font-size:14px;font-weight:700;color:var(--text)">${name}</span>${right || ''}<span style="color:#CBD2E0;font-size:17px;margin-left:6px">›</span></button>`;
          const group = (title, items) => `<div style="font-size:11px;font-weight:800;color:var(--sub2,#98A2B3);text-transform:uppercase;letter-spacing:.5px;padding:16px 4px 7px">${title}</div><div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;overflow:hidden">${items.join('')}</div>`;
          return group('Store', [
            mi(ico('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'), 'Listings', valTxt(activeL + ' active'), `H._bizListings.open('${b.id}')`),
            mi(ico('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'), 'Featured &amp; Boost', boosts ? pill(boosts + ' live', '#FFE9C7', '#92670A') : valTxt('Boost'), `H._bizFeat.open('${b.id}')`),
            mi(ico('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'), 'Quick Replies', valTxt(replies + ' saved'), `H._bizMsg.open('${b.id}')`)
          ]) + group('Customers', [
            mi(ico('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'), 'Leads', newLeads ? pill(newLeads + ' new', '#FEE4E2', '#B42318') : valTxt(leads.length + ' total'), `H._bizLeads.open('${b.id}')`),
            mi(ico('<path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-6"/>'), 'Analytics', valTxt('View'), `H._bizAnalytics.open('${b.id}')`)
          ]) + group('Business', [
            mi(ico('<path d="M9 12l2 2 4-4"/><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>'), 'Get Verified', verified ? pill('Verified', '#EAF7EF', '#0f7a3d') : pill('Start', '#EEF2FF', '#1A3A8F'), `H._bizVerify.open('${b.id}')`),
            mi(ico('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'), 'Subscription &amp; Plan', pill((plan ? plan.name : 'Free'), '#FFE9C7', '#92670A'), `H._bizSub.open('${b.id}')`),
            mi(ico('<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'), 'Billing &amp; Invoices', valTxt('Invoices'), `H._bizBilling.open('${b.id}')`)
          ]) + group('Profile', [
            mi(ico('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'), 'Edit Business Profile', '', `H._bizProfile.openEdit('${b.id}')`),
            mi(ico('<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>'), 'View Public Page', '', `H.openBusinessProfile('${b.id}')`),
            mi(ico('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'), 'Add Another Business', '', `H._bizOnboard.createAnother()`)
          ]);
        })()}
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

  H._closeBizSwitcher = function () { var m = document.getElementById('bizSwitcher'); if (m) m.remove(); };

  H._bizOnboard = {
    // Called from the Account row. Routes to the right place depending on whether
    // the user already has a business — never dumps them into a blank new wizard.
    openFromAccount() {
      const mine = myBusinesses();
      const active = mine.find(b => b.status === 'active');
      if (active) { this.view(active.id); return; }
      // Already submitted — show the "under review" status screen, not the wizard.
      const pendingActivation = mine.find(b => b.status === 'pending_activation');
      if (pendingActivation) { this.view(pendingActivation.id); return; }
      // Still a draft — resume the wizard where the user left off.
      const draft = mine.find(b => b.status === 'draft');
      if (draft) { _mode = 'create'; _draft = JSON.parse(JSON.stringify(draft)); H.openInner('BusinessOnboarding'); return; }
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

    // Bottom-sheet switcher between the user's businesses (+ add another).
    switcher() {
      const mine = myBusinesses();
      const ov = document.createElement('div');
      ov.id = 'bizSwitcher';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(16,24,40,.5);z-index:9300;display:flex;align-items:flex-end;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)';
      const rows = mine.map(b => `<button onclick="H._closeBizSwitcher();H._bizOnboard.view('${b.id}')" style="display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px;background:none;border:none;border-bottom:1px solid var(--border,#F0F2F6);cursor:pointer;font-family:inherit;text-align:left">
          <span style="width:38px;height:38px;border-radius:10px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;font-weight:800;color:#1A3A8F;flex-shrink:0;overflow:hidden">${b.logo ? `<img src="${escHtml(b.logo)}${b.logo.startsWith('data:') ? '' : '?v=' + (b._updatedAt||b.updatedAt||'')}" style="width:100%;height:100%;object-fit:cover">` : escHtml(H.initials(b.name))}</span>
          <span style="flex:1;min-width:0"><span style="display:block;font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(b.name)}</span><span style="font-size:11px;color:var(--sub)">${b.status === 'active' ? 'Active' : 'Setup in progress'}</span></span>
          ${b.id === _viewId ? '<span style="color:#1A7F4B;font-weight:800;font-size:16px">✓</span>' : ''}
        </button>`).join('');
      ov.innerHTML = `<div style="background:var(--card,#fff);width:100%;border-radius:20px 20px 0 0;padding:6px 0 calc(12px + var(--safe-bottom,0px));max-height:72vh;overflow-y:auto;font-family:Inter,sans-serif">
          <div style="width:38px;height:4px;border-radius:2px;background:var(--border,#E2E6EE);margin:8px auto 6px"></div>
          <div style="text-align:center;padding:8px 12px 12px;font-size:15px;font-weight:800;color:var(--text)">Your Businesses</div>
          ${rows}
          <button onclick="H._closeBizSwitcher();H._bizOnboard.createAnother()" style="display:flex;align-items:center;gap:12px;width:100%;padding:15px 16px;background:none;border:none;cursor:pointer;font-family:inherit;color:#1A3A8F;font-weight:800;font-size:14px"><span style="width:38px;height:38px;border-radius:10px;background:#EEF2FF;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#1A3A8F" stroke-width="2.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>Add another business</button>
        </div>`;
      ov.addEventListener('click', e => { if (e.target === ov) H._closeBizSwitcher(); });
      document.body.appendChild(ov);
    },

    open() { _mode = 'create'; _draft = null; ensureDraft(); H.openInner('BusinessOnboarding'); },

    setType(t) { ensureDraft(); collectDetails(); _draft.bizType = t; renderPage('BusinessOnboarding'); },

    onProvince(p) { ensureDraft(); collectDetails(); _draft.province = p; _draft.city = ''; renderPage('BusinessOnboarding'); },

    setCategory(c) {
      ensureDraft();
      _draft.categories = Array.isArray(_draft.categories) ? _draft.categories : (_draft.category ? [_draft.category] : []);
      const idx = _draft.categories.indexOf(c);
      if (idx >= 0) {
        // Deselecting — always allowed
        _draft.categories.splice(idx, 1);
      } else {
        // Selecting — check compatibility first
        const check = typeof H.bizCatCompat === 'function' ? H.bizCatCompat(_draft.categories, c) : { ok: true };
        if (!check.ok) { toast(check.msg); return; }
        _draft.categories.push(c);
      }
      _draft.category = _draft.categories[0] || '';
      renderPage('BusinessOnboarding');
    },

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
        const cats = Array.isArray(d.categories) ? d.categories : (d.category ? [d.category] : []);
        if (!cats.length) { toast('Pick at least one category'); return; }
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
      { const cats = Array.isArray(d.categories) ? d.categories : (d.category ? [d.category] : []); if (!cats.length) { toast('Pick a category first'); d.onboardingStep = 'category'; renderPage('BusinessOnboarding'); return; } }
      if (!d.planId)   { toast('Select a plan first'); d.onboardingStep = 'plan'; renderPage('BusinessOnboarding'); return; }

      const btn = document.getElementById('bzActivateBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

      const wasEdit = _mode === 'edit';
      // Approval workflow: a NEW business is submitted for admin review
      // (pending_activation) and only goes public once an admin approves it in
      // admin.html. Editing a business that is ALREADY live keeps it live — no
      // re-review for ordinary profile edits.
      const prior = (H.state.businesses || []).find(b => b.id === d.id);
      const wasActive = !!(prior && prior.status === 'active');
      const priorStatus = d.status;
      d.status = wasActive ? 'active' : 'pending_activation';
      d.onboardingStep = 'done';
      persistDraft();

      // The business row MUST land in the cloud before we record its subscription:
      // the business_subscriptions RLS insert policy checks that a business owned by
      // auth.uid() exists. If the business write fails (e.g. schema not migrated),
      // skip the subscription insert so we don't trigger a guaranteed 403, and tell
      // the user rather than falsely reporting success.
      let saveRes = { ok: true };
      if (typeof H.saveBusinessToCloud === 'function') {
        saveRes = await H.saveBusinessToCloud(JSON.parse(JSON.stringify(d))) || { ok: false };
      }
      if (saveRes.ok) {
        if (typeof H.saveBusinessSubscriptionToCloud === 'function') await H.saveBusinessSubscriptionToCloud(d);
      } else {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit for Review'; }
        d.status = priorStatus || 'draft';
        persistDraft();
        toast('Could not submit. Please check your connection and try again.');
        return;
      }

      // Refresh the marketplace business list (an approved edit may need to
      // reflect immediately; a pending submission simply will not appear yet).
      if (typeof H.fetchAllActiveBusinesses === 'function') {
        H.fetchAllActiveBusinesses().catch(function () {});
      }

      if (wasEdit && wasActive) {
        _mode = 'create';
        toast('Business updated');
        _viewId = d.id;
        renderPage('BusinessView', { id: d.id });
        return;
      }

      if (typeof H.pushNotif === 'function') {
        try { H.pushNotif(currentUser().id, 'Submitted for review', `${d.name} has been submitted. We will notify you once it is approved.`, 'business'); } catch (e) {}
      }
      // A paid plan picked during onboarding is an intent, not an
      // entitlement — it only activates through a Google Play purchase on
      // the Subscription page (server enforces this regardless).
      if (d.planId && d.planId !== 'free') {
        toast('Submitted for review. Complete your ' + d.planId + ' plan purchase from Manage Business → Subscription once approved.', 6000);
      } else {
        toast('Submitted for review');
      }
      renderPage('BusinessActivated');
    }
  };

})(window.H = window.H || {});
