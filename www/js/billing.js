/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {

  // Product data lives in www/js/billing-products.js, the single source of
  // truth for Play Billing product IDs — that file must load before this
  // one. Nothing in this file should ever hardcode a product ID literal or
  // read H.PLAY_PRODUCT_FAMILIES directly — always go through
  // H.getActiveProducts()/H.getAllActiveProducts()/H.isActiveProductId(),
  // which are the only accessors that filter out 'planned' (not-yet-built)
  // product families. This is what makes it impossible for a planned
  // product to be fetched from Google, offered for purchase, or accepted by
  // a purchase handler before its backend actually exists.
  if (typeof H.getActiveProducts !== 'function') {
    console.error('billing.js loaded before billing-products.js — Play Billing product catalogue is missing.');
  }

  function _isNative() {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  }

  function _plugin() {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PurchasePlugin;
  }

  var _initialized = false;
  var _productsLoaded = false;
  // Context for whichever purchase is currently in flight. Only one of
  // listingId/businessId is set at a time (boost vs. subscription), since
  // Play Billing only supports one purchase flow open at once per app.
  var _pendingContext = null;

  // ── Durable purchase context ──
  // _pendingContext lives in memory only, but Google can report a purchase
  // LONG after the buy() call — including on the next app launch via
  // getPurchases() if the app was killed mid-flow. Without a durable copy
  // of "which listing/business was this purchase for", such a restored
  // purchase could never be verified (the handler bails with no context)
  // and Google would auto-refund it after 3 days. So every context-scoped
  // buy also records {productId → context} here; handlers fall back to it,
  // and it's cleared only once verification succeeds.
  var _CTX_KEY = 'pm_billing_ctx';
  function _readCtxMap() {
    try { return JSON.parse(localStorage.getItem(_CTX_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function _saveCtx(productId, ctx) {
    try {
      var m = _readCtxMap();
      m[productId] = { ctx: ctx, at: Date.now() };
      localStorage.setItem(_CTX_KEY, JSON.stringify(m));
    } catch (e) { /* best-effort */ }
  }
  function _loadCtx(productId) {
    var entry = _readCtxMap()[productId];
    // Ignore stale contexts (>7 days) — a purchase that old has already
    // been refunded by Google anyway.
    if (!entry || !entry.ctx || (Date.now() - (entry.at || 0)) > 7 * 86400000) return null;
    return entry.ctx;
  }
  function _clearCtx(productId) {
    try {
      var m = _readCtxMap();
      if (m[productId]) { delete m[productId]; localStorage.setItem(_CTX_KEY, JSON.stringify(m)); }
    } catch (e) { /* best-effort */ }
  }

  // Wires the native purchase-result listener once. Google Play Billing
  // reports purchase completion asynchronously via this event — never as
  // a direct return value from buy()/subscribe() — so this listener is the
  // single choke point that forwards every completed purchase to
  // server-side verification. There is no other path that can grant a
  // boost or activate a plan.
  H.setupBilling = async function () {
    if (!_isNative()) return; // Play Billing is Android-only; no web fallback for this feature
    var P = _plugin();
    if (!P) { console.warn('PurchasePlugin not available'); return; }
    if (_initialized) return;
    _initialized = true;

    try {
      await P.init();
    } catch (e) {
      console.warn('Billing init failed:', e && e.message);
      return;
    }

    P.addListener('purchasesUpdated', function (data) {
      var purchases = (data && data.purchases) || [];
      purchases.forEach(function (p) { H._handlePlayPurchase(p); });
    });

    // Any purchase Google is still holding from a previous session (e.g. the
    // app was killed before verification finished) is queried here too, so
    // it gets forwarded to the same handler instead of being silently lost.
    try {
      var existing = await P.getPurchases();
      var purchases2 = (existing && existing.purchases) || [];
      purchases2.forEach(function (p) { H._handlePlayPurchase(p); });
    } catch (e) { /* best-effort */ }

    _ensureProductsLoaded().catch(function (e) { console.warn('_ensureProductsLoaded (boot) failed:', e && e.message, e); });
  };

  // Google Play Billing requires a product to be fetched via
  // getAvailableProducts() before buy()/subscribe() will recognize its
  // productId — calling either for an unregistered product fails with
  // "Product not registered." This loads every ACTIVE product once, lazily
  // re-attempted if it failed (e.g. no network at boot). Uses
  // getAllActiveProducts() rather than any raw family array, so a 'planned'
  // family is structurally never sent to Google, no matter how this
  // function is edited later.
  async function _ensureProductsLoaded() {
    if (_productsLoaded) return true;
    var P = _plugin();
    if (!P) return false;
    var active = H.getAllActiveProducts();
    // Both subscription families (shop plans AND recruiter plans) must be
    // requested as subsSkus, not just shopSubscriptions — otherwise
    // recruiter_* ids fall into inAppSkus below and Google rejects them,
    // since they're registered as subscription products in Play Console.
    var subsIds = H.getActiveProducts('shopSubscriptions')
      .concat(H.getActiveProducts('recruiterSubscriptions'))
      .map(function (p) { return p.productId; });
    var inAppSkus = active.filter(function (p) { return subsIds.indexOf(p.productId) === -1; }).map(function (p) { return p.productId; });
    var res;
    try {
      res = await P.getAvailableProducts({ inAppSkus: inAppSkus, subsSkus: subsIds });
    } catch (e) {
      console.warn('getAvailableProducts failed:', e && e.message, e);
      return false;
    }
    if (res && Array.isArray(res.products) && res.products.length) {
      _productsLoaded = true;
    } else {
      console.warn('getAvailableProducts returned no products. Requested:', { inAppSkus: inAppSkus, subsSkus: subsIds }, 'Response:', res);
    }
    return _productsLoaded;
  }

  // Sends one completed native purchase to the server for verification.
  // Routes to the boost/slot-pack/subscription handler depending on which
  // ACTIVE family the reported productId belongs to — isActiveProductId()
  // and getActiveProducts() are the only lookups used here, so a purchase
  // for a 'planned' product id can never be routed anywhere; Google itself
  // would also never have offered it, since _ensureProductsLoaded only ever
  // registers active SKUs. Called for every purchase Google reports —
  // including ones restored on app relaunch if a previous verification
  // attempt didn't finish, which is exactly the retry path both Edge
  // Functions' idempotency logic expects.
  H._handlePlayPurchase = async function (purchase) {
    var productIds = purchase.productIds || (purchase.productId ? [purchase.productId] : []);
    var productId = productIds[0];
    var purchaseToken = purchase.purchaseToken;
    if (!productId || !purchaseToken) return;
    if (!H.isActiveProductId(productId)) return; // planned/unknown product — never handled

    var boost = H.getActiveProducts('boosts').find(function (x) { return x.productId === productId; });
    if (boost) { await H._handleBoostPurchase(boost, productId, purchaseToken, purchase.orderId || null); return; }

    var jobBoost = H.getActiveProducts('jobBoosts').find(function (x) { return x.productId === productId; });
    if (jobBoost) { await H._handleBoostPurchase(jobBoost, productId, purchaseToken, purchase.orderId || null); return; }

    var slotPack = H.getActiveProducts('slotPacks').find(function (x) { return x.productId === productId; });
    if (slotPack) { await H._handleSlotPackPurchase(slotPack, productId, purchaseToken, purchase.orderId || null); return; }

    var sub = H.getActiveProducts('shopSubscriptions').find(function (x) { return x.productId === productId; });
    if (sub) { await H._handleSubscriptionPurchase(sub, productId, purchaseToken); return; }

    var recruiterSub = H.getActiveProducts('recruiterSubscriptions').find(function (x) { return x.productId === productId; });
    if (recruiterSub) { await H._handleRecruiterSubscriptionPurchase(recruiterSub, productId, purchaseToken); return; }

    var jobCredit = H.getActiveProducts('jobCredits').find(function (x) { return x.productId === productId; });
    if (jobCredit) { await H._handleJobCreditPurchase(jobCredit, productId, purchaseToken, purchase.orderId || null); return; }

    var rentalFeatured = H.getActiveProducts('rentalFeaturedSlots').find(function (x) { return x.productId === productId; });
    if (rentalFeatured) { await H._handleRentalFeaturedPurchase(rentalFeatured, productId, purchaseToken, purchase.orderId || null); return; }

    // Unknown product — ignore rather than guess what it's for.
  };

  H._handleSlotPackPurchase = async function (product, productId, purchaseToken, orderId) {
    try {
      var businessId = _pendingContext && _pendingContext.businessId;
      if (!businessId) { var saved = _loadCtx(productId); businessId = saved && saved.businessId; }
      if (!businessId) {
        console.warn('Slot pack purchase reported with no pending business context:', productId);
        return;
      }

      var sb = window.supabase;
      if (!sb) { H.toast('Connection unavailable — purchase will retry automatically', 4000, true); return; }

      var sess = await sb.auth.getSession();
      var jwt = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!jwt) { H.toast('Sign in required to complete your purchase', 4000, true); return; }

      H.toast('Verifying purchase…', 3000, true);

      var res = await fetch(window.SUPABASE_URL + '/functions/v1/verify-play-purchase', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          businessId: businessId,
          productId: productId,
          purchaseToken: purchaseToken,
          orderId: orderId,
        }),
      });
      var result = await res.json();

      if (!res.ok || !result.ok) {
        console.warn('Slot pack verification failed:', result && result.error);
        H.toast('Could not verify your purchase. If you were charged, contact support.', 5000, true);
        return;
      }

      _clearCtx(productId);
      H.toast('+' + product.extraSlots + ' featured slot' + (product.extraSlots === 1 ? '' : 's') + ' added!');
      if (H.currentPageName === 'BusinessFeatured') H.renderPage('BusinessFeatured', H.currentPageParams);
    } catch (e) {
      console.warn('_handleSlotPackPurchase error:', e && e.message);
      H.toast('Purchase could not be completed. Please try again.', 4000, true);
    } finally {
      _pendingContext = null;
    }
  };

  H._handleBoostPurchase = async function (product, productId, purchaseToken, orderId) {
    try {
      var listingId = _pendingContext && _pendingContext.listingId;
      if (!listingId) { var saved = _loadCtx(productId); listingId = saved && saved.listingId; }
      if (!listingId) {
        console.warn('Boost purchase reported with no pending listing context:', productId);
        return;
      }

      var sb = window.supabase;
      if (!sb) { H.toast('Connection unavailable — purchase will retry automatically', 4000, true); return; }

      var sess = await sb.auth.getSession();
      var jwt = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!jwt) { H.toast('Sign in required to complete your purchase', 4000, true); return; }

      H.toast('Verifying purchase…', 3000, true);

      var res = await fetch(window.SUPABASE_URL + '/functions/v1/verify-play-purchase', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          listingId: listingId,
          productId: productId,
          purchaseToken: purchaseToken,
          orderId: orderId,
        }),
      });
      var result = await res.json();

      if (!res.ok || !result.ok) {
        console.warn('Purchase verification failed:', result && result.error);
        H.toast('Could not verify your purchase. If you were charged, contact support.', 5000, true);
        return;
      }

      // Verified and activated server-side — reflect it locally.
      _clearCtx(productId);
      var listing = (H.state.listings || []).find(function (l) { return l.id === listingId; });
      if (listing) {
        listing.boost = true;
        listing.featuredUntil = result.until ? new Date(result.until).getTime() : Date.now() + product.days * 86400000;
        H.saveState();
      }
      H.toast('Boosted for ' + product.days + (product.days === 1 ? ' day' : ' days') + '! Your listing is now featured.');
      if (H.currentPageName === 'Detail') H.renderPage('Detail', H.currentPageParams);
    } catch (e) {
      console.warn('_handleBoostPurchase error:', e && e.message);
      H.toast('Purchase could not be completed. Please try again.', 4000, true);
    } finally {
      _pendingContext = null;
    }
  };

  H._handleSubscriptionPurchase = async function (product, productId, purchaseToken) {
    try {
      var businessId = _pendingContext && _pendingContext.businessId;
      if (!businessId) { var saved = _loadCtx(productId); businessId = saved && saved.businessId; }
      if (!businessId) {
        console.warn('Subscription purchase reported with no pending business context:', productId);
        return;
      }

      var sb = window.supabase;
      if (!sb) { H.toast('Connection unavailable — purchase will retry automatically', 4000, true); return; }

      var sess = await sb.auth.getSession();
      var jwt = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!jwt) { H.toast('Sign in required to complete your purchase', 4000, true); return; }

      H.toast('Verifying subscription…', 3000, true);

      var res = await fetch(window.SUPABASE_URL + '/functions/v1/verify-play-subscription', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          businessId: businessId,
          productId: productId,
          purchaseToken: purchaseToken,
        }),
      });
      var result = await res.json();

      if (!res.ok || !result.ok) {
        console.warn('Subscription verification failed:', result && result.error);
        H.toast('Could not verify your subscription. If you were charged, contact support.', 5000, true);
        return;
      }
      if (result.granted === false) {
        H.toast('Purchase received, but your subscription is not yet active (' + (result.subscription_state || 'pending') + ').', 5000, true);
        return;
      }

      // Verified and activated server-side — reflect it locally.
      _clearCtx(productId);
      var biz = (H.state.businesses || []).find(function (b) { return b.id === businessId; });
      if (biz) { biz.planId = product.planId; biz.billingCycle = product.cycle; H.saveState(); }
      if (typeof H.fetchBusinessSubscriptions === 'function') await H.fetchBusinessSubscriptions(businessId);
      H.toast('Upgraded to ' + (typeof H.planEntitlements === 'function' ? H.planEntitlements(product.planId).name : product.planId) + '!');
      if (H.currentPageName === 'BusinessSubscription') H.renderPage('BusinessSubscription', H.currentPageParams);
    } catch (e) {
      console.warn('_handleSubscriptionPurchase error:', e && e.message);
      H.toast('Subscription purchase could not be completed. Please try again.', 4000, true);
    } finally {
      _pendingContext = null;
    }
  };

  // Recruiter subscriptions have no businessId — the target is always the
  // signed-in caller's own recruiter profile (created lazily server-side on
  // first purchase). _pendingContext is still used, just with a marker
  // instead of an id, so _handlePlayPurchase's routing stays uniform.
  H._handleRecruiterSubscriptionPurchase = async function (product, productId, purchaseToken) {
    try {
      var sb = window.supabase;
      if (!sb) { H.toast('Connection unavailable — purchase will retry automatically', 4000, true); return; }

      var sess = await sb.auth.getSession();
      var jwt = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!jwt) { H.toast('Sign in required to complete your purchase', 4000, true); return; }

      H.toast('Verifying subscription…', 3000, true);

      var res = await fetch(window.SUPABASE_URL + '/functions/v1/verify-play-subscription', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          productId: productId,
          purchaseToken: purchaseToken,
        }),
      });
      var result = await res.json();

      if (!res.ok || !result.ok) {
        console.warn('Recruiter subscription verification failed:', result && result.error);
        H.toast('Could not verify your subscription. If you were charged, contact support.', 5000, true);
        return;
      }
      if (result.granted === false) {
        H.toast('Purchase received, but your subscription is not yet active (' + (result.subscription_state || 'pending') + ').', 5000, true);
        return;
      }

      if (typeof H.fetchRecruiterProfile === 'function') await H.fetchRecruiterProfile();
      H.toast('Recruiter plan upgraded!');
      if (H.currentPageName === 'RecruiterSubscription') H.renderPage('RecruiterSubscription', H.currentPageParams);
    } catch (e) {
      console.warn('_handleRecruiterSubscriptionPurchase error:', e && e.message);
      H.toast('Subscription purchase could not be completed. Please try again.', 4000, true);
    } finally {
      _pendingContext = null;
    }
  };

  // Job credit packs have no target entity either — like recruiter
  // subscriptions, they're scoped to the caller's own user_id server-side.
  H._handleJobCreditPurchase = async function (product, productId, purchaseToken, orderId) {
    try {
      var sb = window.supabase;
      if (!sb) { H.toast('Connection unavailable — purchase will retry automatically', 4000, true); return; }

      var sess = await sb.auth.getSession();
      var jwt = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!jwt) { H.toast('Sign in required to complete your purchase', 4000, true); return; }

      H.toast('Verifying purchase…', 3000, true);

      var res = await fetch(window.SUPABASE_URL + '/functions/v1/verify-play-purchase', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          productId: productId,
          purchaseToken: purchaseToken,
          orderId: orderId,
        }),
      });
      var result = await res.json();

      if (!res.ok || !result.ok) {
        console.warn('Job credit verification failed:', result && result.error);
        H.toast('Could not verify your purchase. If you were charged, contact support.', 5000, true);
        return;
      }

      H.toast('+' + product.credits + ' job posting credit' + (product.credits === 1 ? '' : 's') + ' added!');
      if (typeof H.fetchJobCreditBalance === 'function') await H.fetchJobCreditBalance();
      if (H.currentPageName === 'PostJob') H.renderPage('PostJob', H.currentPageParams);
    } catch (e) {
      console.warn('_handleJobCreditPurchase error:', e && e.message);
      H.toast('Purchase could not be completed. Please try again.', 4000, true);
    } finally {
      _pendingContext = null;
    }
  };

  // Kicks off the native Play Billing purchase sheet for a job credit pack.
  H.buyJobCredits = async function (productId) {
    var u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to buy job posting credits'); return; }
    if (!_isNative()) { H.toast('Buying job credits requires the PaMarket Android app.', 4000, true); return; }
    if (!H.isActiveProductId(productId)) { H.toast('This product is not available yet.', 4000, true); return; }

    var P = _plugin();
    if (!P) { H.toast('Billing is not available on this device.', 4000, true); return; }

    var ready = await _ensureProductsLoaded();
    if (!ready) { H.toast('Could not load pricing. Check your connection and try again.', 4000, true); return; }

    _pendingContext = { jobCredit: true };
    try {
      await P.buy({ productId: productId });
    } catch (e) {
      _pendingContext = null;
      var msg = (e && e.message) || '';
      if (!/cancel/i.test(msg)) {
        H.toast('Purchase could not be started. Please try again.', 4000, true);
      }
    }
  };

  // Current job-posting credit balance for the signed-in user (purchased
  // minus spent) — see get_job_credit_balance RPC, which is granted to
  // authenticated since it's a pure read scoped to auth.uid() already.
  H.fetchJobCreditBalance = async function () {
    var sb = window.supabase;
    var u = H.currentUser();
    if (!sb || !u) return 0;
    try {
      var r = await sb.rpc('get_job_credit_balance');
      if (r.error || typeof r.data !== 'number') return 0;
      H.state.jobCreditBalance = r.data;
      H.saveState();
      return r.data;
    } catch (e) { return 0; }
  };

  // Rental featured slot purchases are scoped to a rental listingId (the
  // client already knows which listing to buy the placement for) — reuses
  // the same _pendingContext.listingId shape as _handleBoostPurchase, just
  // a different target table/RPC server-side.
  H._handleRentalFeaturedPurchase = async function (product, productId, purchaseToken, orderId) {
    try {
      var listingId = _pendingContext && _pendingContext.listingId;
      if (!listingId) { var saved = _loadCtx(productId); listingId = saved && saved.listingId; }
      if (!listingId) {
        console.warn('Rental featured purchase reported with no pending listing context:', productId);
        return;
      }

      var sb = window.supabase;
      if (!sb) { H.toast('Connection unavailable — purchase will retry automatically', 4000, true); return; }

      var sess = await sb.auth.getSession();
      var jwt = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!jwt) { H.toast('Sign in required to complete your purchase', 4000, true); return; }

      H.toast('Verifying purchase…', 3000, true);

      var res = await fetch(window.SUPABASE_URL + '/functions/v1/verify-play-purchase', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          listingId: listingId,
          productId: productId,
          purchaseToken: purchaseToken,
          orderId: orderId,
        }),
      });
      var result = await res.json();

      if (!res.ok || !result.ok) {
        console.warn('Rental featured verification failed:', result && result.error);
        H.toast('Could not verify your purchase. If you were charged, contact support.', 5000, true);
        return;
      }

      _clearCtx(productId);
      H.toast('Featured for ' + product.days + ' days! Your listing is now boosted in search.');
      if (H.currentPageName === 'RentalListingDetail' || H.currentPageName === 'RentalManageListing') H.renderPage(H.currentPageName, H.currentPageParams);
    } catch (e) {
      console.warn('_handleRentalFeaturedPurchase error:', e && e.message);
      H.toast('Purchase could not be completed. Please try again.', 4000, true);
    } finally {
      _pendingContext = null;
    }
  };

  // Kicks off the native Play Billing purchase sheet for a rental featured
  // placement package.
  H.buyRentalFeaturedSlot = async function (listingId, productId) {
    var u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to feature your listing'); return; }
    if (!_isNative()) { H.toast('Featuring listings requires the PaMarket Android app.', 4000, true); return; }
    if (!H.isActiveProductId(productId)) { H.toast('This product is not available yet.', 4000, true); return; }

    var P = _plugin();
    if (!P) { H.toast('Billing is not available on this device.', 4000, true); return; }

    var ready = await _ensureProductsLoaded();
    if (!ready) { H.toast('Could not load pricing. Check your connection and try again.', 4000, true); return; }

    _pendingContext = { listingId: listingId };
    _saveCtx(productId, { listingId: listingId });
    try {
      await P.buy({ productId: productId });
    } catch (e) {
      _pendingContext = null;
      _clearCtx(productId);
      var msg = (e && e.message) || '';
      if (!/cancel/i.test(msg)) {
        H.toast('Purchase could not be started. Please try again.', 4000, true);
      }
    }
  };

  // ── UI: rental featured picker sheet ──
  H.featureRentalListing = async function (id) {
    var u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to feature your listing'); return; }
    if (!_isNative()) { H.toast('Featuring listings requires the PaMarket Android app.', 4000, true); return; }
    var P = _plugin();
    if (!P) { H.toast('Billing is not available on this device.', 4000, true); return; }

    var ready = await _ensureProductsLoaded();
    if (!ready) { H.toast('Could not load pricing. Check your connection and try again.', 4000, true); return; }

    var old = document.getElementById('_rentalFeaturedSheet');
    if (old) old.remove();

    var sheet = document.createElement('div');
    sheet.id = '_rentalFeaturedSheet';
    sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9000;display:flex;align-items:flex-end;justify-content:center';
    sheet.addEventListener('click', function (ev) { if (ev.target === sheet) sheet.remove(); });

    var planHtml = H.getActiveProducts('rentalFeaturedSlots').map(function (p) {
      return '<button class="buy-sheet-opt' + (p.tag ? ' recommended' : '') + '" onclick="document.getElementById(\'_rentalFeaturedSheet\')&&document.getElementById(\'_rentalFeaturedSheet\').remove();H.buyRentalFeaturedSlot(\'' + id + '\',\'' + p.productId + '\')">'
        + '<div><div class="buy-sheet-opt-name-row"><span class="buy-sheet-opt-name">' + p.label + '</span>'
        + (p.tag ? '<span class="buy-sheet-opt-tag">' + p.tag.toUpperCase() + '</span>' : '') + '</div></div>'
        + '<div class="buy-sheet-opt-price">' + (p.estimatedPriceUsd ? '$' + p.estimatedPriceUsd : 'Buy') + '</div>'
        + '</button>';
    }).join('');

    sheet.innerHTML = '<div style="background:var(--card,#fff);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 18px calc(env(safe-area-inset-bottom,0px)+20px);box-sizing:border-box">'
      + '<div style="width:36px;height:4px;background:var(--border-mid,#E2E2E7);border-radius:4px;margin:0 auto 16px"></div>'
      + '<div class="buy-sheet-title">Feature this listing</div>'
      + '<div class="buy-sheet-sub">Get top placement in rental search results.</div>'
      + planHtml
      + '<button class="buy-sheet-cancel" onclick="document.getElementById(\'_rentalFeaturedSheet\')&&document.getElementById(\'_rentalFeaturedSheet\').remove()">Cancel</button>'
      + '<div class="buy-sheet-gplay-note">' + H.ICONS.googlePlay + '<span>Paid securely through Google Play — PaMarket never sees your card details.</span></div>'
      + '</div>';

    document.body.appendChild(sheet);
  };

  // ── UI: boost picker sheet (replaces the old wallet-funded sheet) ──
  H.boostListing = async function (id) {
    var u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to boost your listing'); return; }

    if (!_isNative()) {
      H.toast('Boosting listings requires the PaMarket Android app.', 4000, true);
      return;
    }
    var P = _plugin();
    if (!P) { H.toast('Billing is not available on this device.', 4000, true); return; }

    var ready = await _ensureProductsLoaded();
    if (!ready) { H.toast('Could not load boost pricing. Check your connection and try again.', 4000, true); return; }

    var old = document.getElementById('_boostSheet');
    if (old) old.remove();

    var sheet = document.createElement('div');
    sheet.id = '_boostSheet';
    sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9000;display:flex;align-items:flex-end;justify-content:center';
    sheet.addEventListener('click', function (ev) { if (ev.target === sheet) sheet.remove(); });

    var planHtml = H.getActiveProducts('boosts').map(function (p) {
      return '<button class="buy-sheet-opt' + (p.tag ? ' recommended' : '') + '" onclick="H._buyBoost(\'' + id + '\',\'' + p.productId + '\')">'
        + '<div><div class="buy-sheet-opt-name-row"><span class="buy-sheet-opt-name">' + p.label + '</span>'
        + (p.tag ? '<span class="buy-sheet-opt-tag">' + p.tag.toUpperCase() + '</span>' : '') + '</div></div>'
        + '<div class="buy-sheet-opt-price">' + (p.estimatedPriceUsd ? '$' + p.estimatedPriceUsd : 'Buy') + '</div>'
        + '</button>';
    }).join('');

    sheet.innerHTML = '<div style="background:var(--card,#fff);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 18px calc(env(safe-area-inset-bottom,0px)+20px);box-sizing:border-box">'
      + '<div style="width:36px;height:4px;background:var(--border-mid,#E2E2E7);border-radius:4px;margin:0 auto 16px"></div>'
      + '<div class="buy-sheet-title">Boost your listing</div>'
      + '<div class="buy-sheet-sub">Get up to 5\xD7 more views on search and category pages.</div>'
      + planHtml
      + '<button class="buy-sheet-cancel" onclick="document.getElementById(\'_boostSheet\')&&document.getElementById(\'_boostSheet\').remove()">Cancel</button>'
      + '<div class="buy-sheet-gplay-note">' + H.ICONS.googlePlay + '<span>Paid securely through Google Play — PaMarket never sees your card details.</span></div>'
      + '</div>';

    document.body.appendChild(sheet);
  };

  // Kicks off the native Play Billing purchase sheet. The result is NOT
  // returned here — it arrives asynchronously via the 'purchasesUpdated'
  // listener wired in setupBilling(), which is why _pendingContext is
  // stashed first so the listener knows which listing to attach the
  // eventual verified purchase to. Shared by both listing boosts and job
  // boosts — a job post IS a listing, so the same context/handler works.
  H._buyBoost = async function (listingId, productId) {
    var sheet = document.getElementById('_boostSheet');
    if (sheet) sheet.remove();
    var jobSheet = document.getElementById('_jobBoostSheet');
    if (jobSheet) jobSheet.remove();
    if (!H.isActiveProductId(productId)) { H.toast('This product is not available yet.', 4000, true); return; }

    var P = _plugin();
    if (!P) { H.toast('Billing is not available on this device.', 4000, true); return; }

    _pendingContext = { listingId: listingId };
    _saveCtx(productId, { listingId: listingId });
    try {
      await P.buy({ productId: productId });
      // No toast here — 'purchasesUpdated' fires once Google completes the
      // flow and drives the rest of the process (verify → activate → toast).
    } catch (e) {
      _pendingContext = null;
      _clearCtx(productId);
      var msg = (e && e.message) || '';
      if (!/cancel/i.test(msg)) {
        H.toast('Purchase could not be started. Please try again.', 4000, true);
      }
    }
  };

  // ── UI: job boost picker sheet — same purchase mechanics as boostListing,
  // just sourcing the 'jobBoosts' family (7/30 day only, no 1-day option).
  H.boostJobListing = async function (id) {
    var u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to boost your job listing'); return; }

    if (!_isNative()) { H.toast('Boosting jobs requires the PaMarket Android app.', 4000, true); return; }
    var P = _plugin();
    if (!P) { H.toast('Billing is not available on this device.', 4000, true); return; }

    var ready = await _ensureProductsLoaded();
    if (!ready) { H.toast('Could not load boost pricing. Check your connection and try again.', 4000, true); return; }

    var old = document.getElementById('_jobBoostSheet');
    if (old) old.remove();

    var sheet = document.createElement('div');
    sheet.id = '_jobBoostSheet';
    sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9000;display:flex;align-items:flex-end;justify-content:center';
    sheet.addEventListener('click', function (ev) { if (ev.target === sheet) sheet.remove(); });

    var planHtml = H.getActiveProducts('jobBoosts').map(function (p) {
      return '<button class="buy-sheet-opt' + (p.tag ? ' recommended' : '') + '" onclick="H._buyBoost(\'' + id + '\',\'' + p.productId + '\')">'
        + '<div><div class="buy-sheet-opt-name-row"><span class="buy-sheet-opt-name">' + p.label + '</span>'
        + (p.tag ? '<span class="buy-sheet-opt-tag">' + p.tag.toUpperCase() + '</span>' : '') + '</div></div>'
        + '<div class="buy-sheet-opt-price">' + (p.estimatedPriceUsd ? '$' + p.estimatedPriceUsd : 'Buy') + '</div>'
        + '</button>';
    }).join('');

    sheet.innerHTML = '<div style="background:var(--card,#fff);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 18px calc(env(safe-area-inset-bottom,0px)+20px);box-sizing:border-box">'
      + '<div style="width:36px;height:4px;background:var(--border-mid,#E2E2E7);border-radius:4px;margin:0 auto 16px"></div>'
      + '<div class="buy-sheet-title">Boost your job listing</div>'
      + '<div class="buy-sheet-sub">Get more visibility with candidates searching for jobs.</div>'
      + planHtml
      + '<button class="buy-sheet-cancel" onclick="document.getElementById(\'_jobBoostSheet\')&&document.getElementById(\'_jobBoostSheet\').remove()">Cancel</button>'
      + '<div class="buy-sheet-gplay-note">' + H.ICONS.googlePlay + '<span>Paid securely through Google Play — PaMarket never sees your card details.</span></div>'
      + '</div>';

    document.body.appendChild(sheet);
  };

  // Kicks off the native Play Billing purchase sheet for an extra
  // featured-slot pack. Same async pattern as _buyBoost — the result
  // arrives via 'purchasesUpdated'.
  H.buySlotPack = async function (businessId, productId) {
    var u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to buy featured slots'); return; }
    if (!_isNative()) { H.toast('Buying featured slots requires the PaMarket Android app.', 4000, true); return; }
    if (!H.isActiveProductId(productId)) { H.toast('This product is not available yet.', 4000, true); return; }

    var P = _plugin();
    if (!P) { H.toast('Billing is not available on this device.', 4000, true); return; }

    var ready = await _ensureProductsLoaded();
    if (!ready) { H.toast('Could not load pricing. Check your connection and try again.', 4000, true); return; }

    _pendingContext = { businessId: businessId };
    _saveCtx(productId, { businessId: businessId });
    try {
      await P.buy({ productId: productId });
    } catch (e) {
      _pendingContext = null;
      _clearCtx(productId);
      var msg = (e && e.message) || '';
      if (!/cancel/i.test(msg)) {
        H.toast('Purchase could not be started. Please try again.', 4000, true);
      }
    }
  };

  // Total extra featured slots a business has purchased and not yet had
  // revoked — sums every 'consumed' slot pack row. Consumed packs never
  // expire on their own (they're a permanent addition to the business's
  // slot count, unlike a time-based boost), so this is a simple count, not
  // a "still active" check.
  H.fetchExtraFeaturedSlots = async function (businessId) {
    var sb = window.supabase;
    if (!sb || !businessId) return 0;
    try {
      var r = await sb.from('featured_slot_packs').select('extra_slots').eq('business_id', businessId).eq('status', 'consumed');
      if (r.error || !Array.isArray(r.data)) return 0;
      return r.data.reduce(function (n, row) { return n + (row.extra_slots || 0); }, 0);
    } catch (e) { return 0; }
  };

  // Finds the current still-entitling Play subscription for a target, so an
  // upgrade/downgrade REPLACES it via Google's subscriptionUpdateParams
  // (oldPurchaseToken + replacementMode) instead of opening a second,
  // concurrently-billed subscription. Upgrades take effect immediately with
  // time proration; downgrades are DEFERRED to the next renewal so the user
  // keeps what they already paid for.
  async function _subscriptionReplacement(table, filterCol, filterVal, newRank, rankOf) {
    var sb = window.supabase;
    if (!sb) return null;
    try {
      var r = await sb.from(table).select('purchase_token, plan_id')
        .eq(filterCol, filterVal)
        .in('subscription_state', ['active', 'in_grace_period', 'on_hold', 'pending'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!r.data || !r.data.purchase_token) return null;
      var curRank = rankOf(r.data.plan_id);
      return {
        oldPurchaseToken: r.data.purchase_token,
        replacementMode: newRank > curRank ? 'IMMEDIATE_WITH_TIME_PRORATION' : 'DEFERRED',
      };
    } catch (e) { return null; }
  }

  // ── UI: subscription upgrade — replaces the WhatsApp "Contact to Upgrade"
  // flow entirely. Called from pages.BusinessSubscription's plan cards.
  H.upgradeBusinessPlan = async function (businessId, planId, cycle) {
    var u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to upgrade your plan'); return; }

    if (!_isNative()) {
      H.toast('Upgrading requires the PaMarket Android app.', 4000, true);
      return;
    }
    var P = _plugin();
    if (!P) { H.toast('Billing is not available on this device.', 4000, true); return; }

    var product = H.getActiveProducts('shopSubscriptions').find(function (x) { return x.planId === planId && x.cycle === (cycle || 'monthly'); });
    if (!product) { H.toast('This plan is not available for purchase.', 4000, true); return; }

    var ready = await _ensureProductsLoaded();
    if (!ready) { H.toast('Could not load plan pricing. Check your connection and try again.', 4000, true); return; }

    var replacement = await _subscriptionReplacement(
      'play_subscriptions', 'business_id', businessId,
      (typeof H.planEntitlements === 'function' ? H.planEntitlements(planId).rank : 0),
      function (pid) { return typeof H.planEntitlements === 'function' ? H.planEntitlements(pid).rank : 0; }
    );

    _pendingContext = { businessId: businessId };
    _saveCtx(product.productId, { businessId: businessId });
    try {
      var subArgs = { productId: product.productId };
      if (replacement) subArgs.additionalData = replacement;
      await P.subscribe(subArgs);
      // No toast here — 'purchasesUpdated' drives verify → activate → toast.
    } catch (e) {
      _pendingContext = null;
      _clearCtx(product.productId);
      var msg = (e && e.message) || '';
      if (!/cancel/i.test(msg)) {
        H.toast('Upgrade could not be started. Please try again.', 4000, true);
      }
    }
  };

  // ── UI: recruiter subscription upgrade — same subscribe()/RTDN pattern as
  // upgradeBusinessPlan, but there's no target id to pass: the Edge Function
  // always resolves (or lazily creates) the caller's OWN recruiter profile.
  H.upgradeRecruiterPlan = async function (planId, cycle) {
    var u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to upgrade your recruiter plan'); return; }

    if (!_isNative()) {
      H.toast('Upgrading requires the PaMarket Android app.', 4000, true);
      return;
    }
    var P = _plugin();
    if (!P) { H.toast('Billing is not available on this device.', 4000, true); return; }

    var product = H.getActiveProducts('recruiterSubscriptions').find(function (x) { return x.planId === planId && x.cycle === (cycle || 'monthly'); });
    if (!product) { H.toast('This plan is not available for purchase.', 4000, true); return; }

    var ready = await _ensureProductsLoaded();
    if (!ready) { H.toast('Could not load plan pricing. Check your connection and try again.', 4000, true); return; }

    var replacement = await _subscriptionReplacement(
      'play_recruiter_subscriptions', 'user_id', u.id,
      (typeof H.recruiterPlanEntitlements === 'function' ? H.recruiterPlanEntitlements(planId).rank : 0),
      function (pid) { return typeof H.recruiterPlanEntitlements === 'function' ? H.recruiterPlanEntitlements(pid).rank : 0; }
    );

    _pendingContext = { recruiter: true };
    try {
      var subArgs = { productId: product.productId };
      if (replacement) subArgs.additionalData = replacement;
      await P.subscribe(subArgs);
      // No toast here — 'purchasesUpdated' drives verify → activate → toast.
    } catch (e) {
      _pendingContext = null;
      var msg = (e && e.message) || '';
      if (!/cancel/i.test(msg)) {
        H.toast('Upgrade could not be started. Please try again.', 4000, true);
      }
    }
  };

  // Fetches the signed-in user's own recruiter profile (plan_id) — profile
  // may not exist yet if they've never purchased a recruiter subscription,
  // in which case this resolves to a 'free' default rather than erroring.
  H.fetchRecruiterProfile = async function () {
    var sb = window.supabase;
    var u = H.currentUser();
    if (!sb || !u) return { planId: 'free' };
    try {
      var r = await sb.from('recruiter_profiles').select('id, plan_id').eq('user_id', u.id).maybeSingle();
      if (r.error || !r.data) return { planId: 'free' };
      H.state.recruiterProfile = { id: r.data.id, planId: r.data.plan_id };
      H.saveState();
      return H.state.recruiterProfile;
    } catch (e) { return { planId: 'free' }; }
  };

  // Reconciliation poll: re-checks a business's live subscription state
  // against Google whenever the owner opens their Subscription screen, as a
  // fallback safety check in case an RTDN event was ever missed or delayed
  // (see play-rtdn-webhook, which is the primary source of truth for
  // renewals/cancellations that happen while the app isn't open).
  H.reconcilePlaySubscription = async function (businessId) {
    if (!_isNative()) return;
    var sb = window.supabase;
    if (!sb) return;
    try {
      var current = await sb.from('play_subscriptions').select('id,purchase_token,product_id')
        .eq('business_id', businessId)
        .in('subscription_state', ['active', 'in_grace_period', 'on_hold', 'pending'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!current.data) return;

      var sess = await sb.auth.getSession();
      var jwt = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!jwt) return;

      await fetch(window.SUPABASE_URL + '/functions/v1/verify-play-subscription', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          businessId: businessId,
          productId: current.data.product_id,
          purchaseToken: current.data.purchase_token,
        }),
      }).catch(function () {});
      // Best-effort — this just re-syncs state; no toast, no error surfaced,
      // since it runs silently in the background on every screen open.
      if (typeof H.fetchBusinessSubscriptions === 'function') await H.fetchBusinessSubscriptions(businessId);
    } catch (e) { /* best-effort */ }
  };

  // Recruiter-side twin of reconcilePlaySubscription: re-checks the caller's
  // own recruiter subscription against Google whenever they open the
  // RecruiterSubscription screen, so a missed RTDN can't leave a lapsed
  // recruiter on a paid plan (or a renewed one stuck on free) indefinitely.
  H.reconcileRecruiterSubscription = async function () {
    if (!_isNative()) return;
    var sb = window.supabase;
    var u = H.currentUser();
    if (!sb || !u) return;
    try {
      var current = await sb.from('play_recruiter_subscriptions').select('id,purchase_token,product_id')
        .eq('user_id', u.id)
        .in('subscription_state', ['active', 'in_grace_period', 'on_hold', 'pending'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!current.data) return;

      var sess = await sb.auth.getSession();
      var jwt = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!jwt) return;

      await fetch(window.SUPABASE_URL + '/functions/v1/verify-play-subscription', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          productId: current.data.product_id,
          purchaseToken: current.data.purchase_token,
        }),
      }).catch(function () {});
      if (typeof H.fetchRecruiterProfile === 'function') await H.fetchRecruiterProfile();
    } catch (e) { /* best-effort */ }
  };

})(window.H = window.H || {});
