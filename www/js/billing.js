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

    _ensureProductsLoaded().catch(function () {});
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
    var subsIds = H.getActiveProducts('shopSubscriptions').map(function (p) { return p.productId; });
    var inAppSkus = active.filter(function (p) { return subsIds.indexOf(p.productId) === -1; }).map(function (p) { return p.productId; });
    var res = await P.getAvailableProducts({ inAppSkus: inAppSkus, subsSkus: subsIds });
    if (res && Array.isArray(res.products) && res.products.length) {
      _productsLoaded = true;
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

    var slotPack = H.getActiveProducts('slotPacks').find(function (x) { return x.productId === productId; });
    if (slotPack) { await H._handleSlotPackPurchase(slotPack, productId, purchaseToken, purchase.orderId || null); return; }

    var sub = H.getActiveProducts('shopSubscriptions').find(function (x) { return x.productId === productId; });
    if (sub) { await H._handleSubscriptionPurchase(sub, productId, purchaseToken); return; }

    // Unknown product — ignore rather than guess what it's for.
  };

  H._handleSlotPackPurchase = async function (product, productId, purchaseToken, orderId) {
    try {
      var businessId = _pendingContext && _pendingContext.businessId;
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
      return '<button onclick="H._buyBoost(\'' + id + '\',\'' + p.productId + '\')" '
        + 'style="background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;border:none;border-radius:14px;padding:14px 16px;'
        + 'display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-family:inherit;width:100%">'
        + '<div><div style="font-size:15px;font-weight:800">' + p.label + '</div>'
        + (p.tag ? '<div style="font-size:11px;font-weight:700;opacity:.75;margin-top:2px">' + p.tag + '</div>' : '')
        + '</div>'
        + '<div style="text-align:right"><div style="font-size:13px;font-weight:700;opacity:.9">Buy</div></div>'
        + '</button>';
    }).join('');

    sheet.innerHTML = '<div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 20px calc(env(safe-area-inset-bottom,0px)+20px);box-sizing:border-box">'
      + '<div style="width:36px;height:4px;background:#E8ECF4;border-radius:4px;margin:0 auto 18px"></div>'
      + '<div style="font-size:17px;font-weight:800;color:#111;margin-bottom:4px">Boost your listing</div>'
      + '<div style="font-size:13px;color:#666;margin-bottom:16px">Get 5\xD7 more views. Paid securely via Google Play.</div>'
      + '<div style="display:flex;flex-direction:column;gap:10px">' + planHtml + '</div>'
      + '<button onclick="document.getElementById(\'_boostSheet\')&&document.getElementById(\'_boostSheet\').remove()" '
      + 'style="margin-top:12px;width:100%;padding:12px;border:1.5px solid #E8ECF4;border-radius:12px;background:#fff;font-size:14px;font-weight:700;color:#666;cursor:pointer;font-family:inherit">Cancel</button>'
      + '</div>';

    document.body.appendChild(sheet);
  };

  // Kicks off the native Play Billing purchase sheet. The result is NOT
  // returned here — it arrives asynchronously via the 'purchasesUpdated'
  // listener wired in setupBilling(), which is why _pendingContext is
  // stashed first so the listener knows which listing to attach the
  // eventual verified purchase to.
  H._buyBoost = async function (listingId, productId) {
    var sheet = document.getElementById('_boostSheet');
    if (sheet) sheet.remove();
    if (!H.isActiveProductId(productId)) { H.toast('This product is not available yet.', 4000, true); return; }

    var P = _plugin();
    if (!P) { H.toast('Billing is not available on this device.', 4000, true); return; }

    _pendingContext = { listingId: listingId };
    try {
      await P.buy({ productId: productId });
      // No toast here — 'purchasesUpdated' fires once Google completes the
      // flow and drives the rest of the process (verify → activate → toast).
    } catch (e) {
      _pendingContext = null;
      var msg = (e && e.message) || '';
      if (!/cancel/i.test(msg)) {
        H.toast('Purchase could not be started. Please try again.', 4000, true);
      }
    }
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

    _pendingContext = { businessId: businessId };
    try {
      await P.subscribe({ productId: product.productId });
      // No toast here — 'purchasesUpdated' drives verify → activate → toast.
    } catch (e) {
      _pendingContext = null;
      var msg = (e && e.message) || '';
      if (!/cancel/i.test(msg)) {
        H.toast('Upgrade could not be started. Please try again.', 4000, true);
      }
    }
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

})(window.H = window.H || {});
