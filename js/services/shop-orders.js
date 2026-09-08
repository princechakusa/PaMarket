// Read-only order lookup for the private, authenticated order.html page —
// the WhatsApp handoff's website fallback (Stage 5). Follows the exact
// pattern already used by js/services/saved-content.js: raw authenticated
// REST calls through the shared PMSupabaseClient/session helpers, with
// Postgres RLS on shop_orders/shop_order_items/shop_order_status_history
// (unchanged — see supabase/migrations/20260910120000_shop_orders_foundation.sql)
// as the actual access boundary. The order id in the URL is never treated
// as authorization here — it only selects which row to ask RLS for; an
// unauthorized viewer's request comes back empty, not denied-with-detail.
(function (root, factory) {
  var api = factory(root, root.PMServiceTransport, root.PMSupabaseClient);
  if (typeof module !== 'undefined' && module.exports) module.exports = factory;
  if (root) root.PMShopOrders = api;
})(typeof self !== 'undefined' ? self : this, function (root, transport, clientProvider) {
  'use strict';
  var client = clientProvider && clientProvider.get();
  var url = client ? client.url : root.SUPABASE_URL;
  var key = client ? client.publishableKey : root.SUPABASE_ANON_KEY;

  function session() {
    return transport && transport.session ? transport.session() :
      (root.PMSession && typeof root.PMSession.getSession === 'function' ? root.PMSession.getSession() : null);
  }

  function cleanId(raw) {
    return String(raw || '').replace(/[^a-zA-Z0-9-]/g, '');
  }

  function authedGet(path) {
    var s = session();
    if (!s || !s.access_token) return Promise.reject(new Error('not-authenticated'));
    return root.fetch(url + '/rest/v1/' + path, {
      headers: { apikey: key, Authorization: 'Bearer ' + s.access_token },
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (text) { throw new Error(text || 'request-failed'); });
      return res.json();
    });
  }

  function firstRow(rows) {
    return (rows && rows[0]) || null;
  }

  // Resolves { order, business, items, history, isOwner } for the signed-in
  // user, or throws 'not-authenticated' / 'invalid-order-id'. A missing
  // order (RLS denied it, or it genuinely doesn't exist) resolves with
  // order: null rather than throwing — the page treats those identically
  // ("not found") so it never distinguishes "exists but not yours" from
  // "doesn't exist" to an unauthorized viewer.
  function getOrderDetail(orderId) {
    var id = cleanId(orderId);
    if (!id) return Promise.reject(new Error('invalid-order-id'));
    var s = session();
    if (!s || !s.user) return Promise.reject(new Error('not-authenticated'));

    return authedGet('shop_orders?id=eq.' + id + '&select=*').then(firstRow).then(function (order) {
      if (!order) return { order: null, business: null, items: [], history: [], isOwner: false };
      return Promise.all([
        authedGet('shop_order_items?order_id=eq.' + id + '&select=id,listing_id,title_snapshot,image_snapshot,unit_price_snapshot,currency_snapshot,quantity,subtotal_snapshot&order=created_at.asc'),
        authedGet('shop_order_status_history?order_id=eq.' + id + '&select=id,status,note,changed_by,created_at&order=created_at.asc'),
        authedGet('businesses?id=eq.' + cleanId(order.business_id) + '&select=id,name,logo,owner_user_id').then(firstRow),
      ]).then(function (rest) {
        var items = rest[0] || [];
        var history = rest[1] || [];
        var business = rest[2] || null;
        var isOwner = !!(business && business.owner_user_id === s.user.id);
        return { order: order, business: business, items: items, history: history, isOwner: isOwner };
      });
    });
  }

  return { getOrderDetail: getOrderDetail };
});
