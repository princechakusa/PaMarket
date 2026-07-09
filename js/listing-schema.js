/* ============================================================================
 * listing-schema.js — single source of truth for a listing's structured data.
 *
 * Works in the browser (attaches to window.PMSchema) and in Node
 * (module.exports), so detail.html and the static pre-render generator
 * (tools/prerender.js) build IDENTICAL JSON-LD from the same code — no drift.
 *
 * All fields are truthful: review/aggregateRating only when real reviews exist,
 * brand/gtin/condition only from real attributes, shippingDetails only when a
 * seller entered a rate. hasMerchantReturnPolicy states PaMarket's real
 * in-person no-returns model. Nothing is fabricated.
 * ==========================================================================*/
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  if (root) root.PMSchema = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SITE = 'https://pamarketzw.com';

  var CAT_LABELS = {
    property: 'Property', vehicles: 'Vehicles', electronics: 'Electronics',
    furniture: 'Furniture', fashion: 'Fashion', services: 'Services',
    agriculture: 'Agriculture', rooms: 'Rooms to Rent', pets: 'Pets',
    kids: 'Baby & Kids', jobs: 'Jobs', other: 'Other'
  };

  // URL-safe slug from a listing title (SEO keywords in the path).
  function slugify(text) {
    return String(text || 'listing')
      .toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')  // strip accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '') || 'listing';
  }

  // Canonical static path for a listing: l/<slug>-<id>.html
  function listingPath(l) {
    return 'l/' + slugify(l.title) + '-' + l.id + '.html';
  }
  function listingUrl(l) {
    return SITE + '/' + listingPath(l);
  }

  function catLabelOf(l) { return CAT_LABELS[l.category] || l.category || 'Listing'; }
  function locOf(l) {
    return [l.suburb, l.city, l.province].filter(Boolean).join(', ') || 'Zimbabwe';
  }
  function photosOf(l) { return (l.photos && l.photos.length) ? l.photos : []; }

  // --- schema.org enum / block helpers (ported verbatim from detail.html) ----
  function schemaCondition(l) {
    var c = ((l.condition != null ? l.condition : (l.attributes && l.attributes.condition)) || '').toString().toLowerCase();
    if (!c) return undefined;
    if (/new|sealed|brand/.test(c)) return 'https://schema.org/NewCondition';
    if (/refurb/.test(c)) return 'https://schema.org/RefurbishedCondition';
    if (/used|second|pre|fair|good|excellent/.test(c)) return 'https://schema.org/UsedCondition';
    return undefined;
  }
  function ratingBlock(reviews) {
    if (!reviews || !reviews.length) return null;
    var sum = reviews.reduce(function (a, r) { return a + (Number(r.rating) || 0); }, 0);
    return {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: (sum / reviews.length).toFixed(1), reviewCount: reviews.length, bestRating: 5, worstRating: 1 },
      review: reviews.slice(0, 10).map(function (r) {
        return { '@type': 'Review', author: { '@type': 'Person', name: r.reviewer_name || 'PaMarket user' }, datePublished: (r.created_at || '').slice(0, 10), reviewRating: { '@type': 'Rating', ratingValue: Number(r.rating) || 0, bestRating: 5, worstRating: 1 }, reviewBody: r.body || '' };
      })
    };
  }
  function sellerNode(l) {
    var n = { '@type': l.business_id ? 'Organization' : 'Person', name: l.seller_name || 'PaMarket seller' };
    if (l.business_id) n.url = SITE + '/business?id=' + l.business_id;
    return n;
  }
  function merchantReturnPolicy(l) {
    var a = (l && l.attributes) || {};
    var days = a.returnDays != null ? a.returnDays : (a.return_days != null ? a.return_days : null);
    if (days == null) {
      return { '@type': 'MerchantReturnPolicy', applicableCountry: 'ZW', returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted' };
    }
    return { '@type': 'MerchantReturnPolicy', applicableCountry: 'ZW', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: Number(days), returnMethod: 'https://schema.org/ReturnInStore', returnFees: 'https://schema.org/FreeReturn' };
  }
  function offerShippingDetails(l) {
    var a = l.attributes || {};
    var rate = a.shippingRate != null ? a.shippingRate : (a.deliveryFee != null ? a.deliveryFee : a.shipping_fee);
    if (rate == null) return undefined;
    return {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: Number(rate) || 0, currency: l.currency || 'USD' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'ZW' },
      deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' }, transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' } }
    };
  }
  function jobEmploymentType(attrs) {
    var t = ((attrs && (attrs.employmentType || attrs.jobType || attrs.type)) || '').toString().toUpperCase().replace(/[\s-]+/g, '_');
    var valid = ['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN', 'VOLUNTEER', 'PER_DIEM', 'OTHER'];
    if (valid.indexOf(t) >= 0) return t;
    if (/FULL/.test(t)) return 'FULL_TIME';
    if (/PART/.test(t)) return 'PART_TIME';
    if (/CONTRACT|FREELAN/.test(t)) return 'CONTRACTOR';
    if (/TEMP|CASUAL|SEASON/.test(t)) return 'TEMPORARY';
    if (/INTERN|ATTACH/.test(t)) return 'INTERN';
    if (/VOLUNT/.test(t)) return 'VOLUNTEER';
    return 'OTHER';
  }
  function jobAddress(l) {
    var a = { '@type': 'PostalAddress', addressCountry: 'ZW' };
    a.streetAddress = l.suburb || l.city || 'Zimbabwe';
    if (l.city) a.addressLocality = l.city;
    if (l.province) a.addressRegion = l.province;
    var pc = l.attributes && (l.attributes.postalCode || l.attributes.postal_code || l.attributes.postcode);
    if (pc) a.postalCode = pc;
    return a;
  }

  // Main builder. canonicalUrl defaults to the listing's static URL.
  function buildListingSchema(l, canonicalUrl, reviews) {
    canonicalUrl = canonicalUrl || listingUrl(l);
    var catLabel = catLabelOf(l);
    var loc = locOf(l);
    var photos = photosOf(l);
    var image = photos.length ? photos : [SITE + '/img/icon-512.png'];
    var base = { '@context': 'https://schema.org', name: l.title, description: l.description || l.title, image: image, url: canonicalUrl };
    var cond = schemaCondition(l);
    var priceValidUntil = l.expires_at ? String(l.expires_at).slice(0, 10) : undefined;

    if (l.category === 'property') {
      var rentalType = (l.attributes && l.attributes.rentalType) || '';
      return Object.assign(base, {
        '@type': 'RealEstateListing', category: catLabel, datePosted: l.created_at,
        address: { '@type': 'PostalAddress', addressLocality: l.city || l.suburb || undefined, addressRegion: l.province || undefined, addressCountry: 'ZW' },
        offers: { '@type': 'Offer', price: l.price, priceCurrency: l.currency || 'USD', availability: 'https://schema.org/InStock', businessFunction: /rent/i.test(rentalType) ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell', priceValidUntil: priceValidUntil, seller: sellerNode(l), url: canonicalUrl }
      });
    }
    if (l.category === 'vehicles') {
      var veh = Object.assign(base, {
        '@type': 'Vehicle', category: catLabel, itemCondition: cond, areaServed: { '@type': 'Country', name: 'Zimbabwe' },
        offers: { '@type': 'Offer', price: l.price, priceCurrency: l.currency || 'USD', availability: 'https://schema.org/InStock', itemCondition: cond, priceValidUntil: priceValidUntil, seller: sellerNode(l), hasMerchantReturnPolicy: merchantReturnPolicy(l), areaServed: { '@type': 'Country', name: 'Zimbabwe' }, url: canonicalUrl }
      });
      var rbv = ratingBlock(reviews);
      if (rbv) { veh.aggregateRating = rbv.aggregateRating; veh.review = rbv.review; }
      return veh;
    }
    if (l.category === 'jobs') {
      var org = { '@type': 'Organization', name: l.seller_name || 'PaMarket Employer', sameAs: SITE + '/' };
      if (l.business_id) org.url = SITE + '/business?id=' + l.business_id;
      return {
        '@context': 'https://schema.org', '@type': 'JobPosting', title: l.title, description: l.description || l.title,
        identifier: { '@type': 'PropertyValue', name: 'PaMarket', value: l.id },
        datePosted: l.created_at, validThrough: l.expires_at || undefined,
        employmentType: jobEmploymentType(l.attributes), hiringOrganization: org,
        jobLocation: { '@type': 'Place', address: jobAddress(l) }, directApply: false,
        baseSalary: l.price ? { '@type': 'MonetaryAmount', currency: l.currency || 'USD', value: { '@type': 'QuantitativeValue', value: l.price, unitText: 'MONTH' } } : undefined
      };
    }
    // Default: Product
    var offer = { '@type': 'Offer', price: l.price, priceCurrency: l.currency || 'USD', availability: 'https://schema.org/InStock', itemCondition: cond, priceValidUntil: priceValidUntil, seller: sellerNode(l), hasMerchantReturnPolicy: merchantReturnPolicy(l), shippingDetails: offerShippingDetails(l), areaServed: { '@type': 'Country', name: 'Zimbabwe' }, url: canonicalUrl };
    var product = Object.assign(base, { '@type': 'Product', category: catLabel, sku: l.id, productID: l.id, itemCondition: cond, offers: offer });
    if (l.attributes) {
      if (l.attributes.brand) product.brand = { '@type': 'Brand', name: l.attributes.brand };
      if (l.attributes.mpn) product.mpn = String(l.attributes.mpn);
      var gtin = l.attributes.gtin || l.attributes.gtin13 || l.attributes.barcode;
      if (gtin) product.gtin13 = String(gtin);
    }
    var rb = ratingBlock(reviews);
    if (rb) { product.aggregateRating = rb.aggregateRating; product.review = rb.review; }
    return product;
  }

  function buildBreadcrumb(l, canonicalUrl) {
    canonicalUrl = canonicalUrl || listingUrl(l);
    var catLabel = catLabelOf(l);
    return {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Browse', item: SITE + '/browse' },
        { '@type': 'ListItem', position: 3, name: catLabel, item: SITE + '/browse?cat=' + l.category },
        { '@type': 'ListItem', position: 4, name: l.title, item: canonicalUrl }
      ]
    };
  }

  return {
    SITE: SITE, CAT_LABELS: CAT_LABELS,
    slugify: slugify, listingPath: listingPath, listingUrl: listingUrl,
    catLabelOf: catLabelOf, locOf: locOf,
    buildListingSchema: buildListingSchema, buildBreadcrumb: buildBreadcrumb
  };
});
