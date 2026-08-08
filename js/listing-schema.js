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

  // Preferred public/canonical path for a listing: l/<slug>-<id> (no
  // extension — matches every other indexable PaMarket URL, e.g. /terms,
  // /browse). GitHub Pages serves the physical l/<slug>-<id>.html file
  // (see listingFilePath) transparently at this extensionless path too, so
  // this is a real, working URL — not a virtual one.
  function listingPath(l) {
    return 'l/' + slugify(l.title) + '-' + l.id;
  }
  function listingUrl(l) {
    return SITE + '/' + listingPath(l);
  }
  // Physical filename tools/prerender.js writes to disk. Must keep .html —
  // GitHub Pages is a static host and needs a real file at this path; it
  // then serves that same file at the extensionless listingPath() above.
  function listingFilePath(l) {
    return listingPath(l) + '.html';
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
        var rev = { '@type': 'Review', author: { '@type': 'Person', name: r.reviewer_name || 'PaMarket user' }, reviewRating: { '@type': 'Rating', ratingValue: Number(r.rating) || 0, bestRating: 5, worstRating: 1 }, reviewBody: r.body || '' };
        // Omit rather than emit an empty-string datePublished (invalid ISO
        // 8601) when a review has no created_at — same fix as the
        // buildBusinessSchema review block below.
        if (r.created_at) rev.datePublished = String(r.created_at).slice(0, 10);
        return rev;
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
    // Google's Merchant listing rich-result check requires offers.validFrom —
    // the date the offer became valid, i.e. when the listing was posted
    // (Search Console, 2026-07-31: "Missing field validFrom (in offers)").
    var validFrom = l.created_at ? String(l.created_at).slice(0, 10) : undefined;

    if (l.category === 'property') {
      var rentalType = (l.attributes && l.attributes.rentalType) || '';
      return Object.assign(base, {
        '@type': 'RealEstateListing', category: catLabel, datePosted: l.created_at,
        address: { '@type': 'PostalAddress', addressLocality: l.city || l.suburb || undefined, addressRegion: l.province || undefined, addressCountry: 'ZW' },
        offers: { '@type': 'Offer', price: l.price, priceCurrency: l.currency || 'USD', availability: 'https://schema.org/InStock', businessFunction: /rent/i.test(rentalType) ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell', priceValidUntil: priceValidUntil, validFrom: validFrom, seller: sellerNode(l), url: canonicalUrl }
      });
    }
    if (l.category === 'vehicles') {
      var veh = Object.assign(base, {
        '@type': 'Vehicle', category: catLabel, itemCondition: cond, areaServed: { '@type': 'Country', name: 'Zimbabwe' },
        offers: { '@type': 'Offer', price: l.price, priceCurrency: l.currency || 'USD', availability: 'https://schema.org/InStock', itemCondition: cond, priceValidUntil: priceValidUntil, validFrom: validFrom, seller: sellerNode(l), hasMerchantReturnPolicy: merchantReturnPolicy(l), areaServed: { '@type': 'Country', name: 'Zimbabwe' }, url: canonicalUrl }
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
    var offer = { '@type': 'Offer', price: l.price, priceCurrency: l.currency || 'USD', availability: 'https://schema.org/InStock', itemCondition: cond, priceValidUntil: priceValidUntil, validFrom: validFrom, seller: sellerNode(l), hasMerchantReturnPolicy: merchantReturnPolicy(l), shippingDetails: offerShippingDetails(l), areaServed: { '@type': 'Country', name: 'Zimbabwe' }, url: canonicalUrl };
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

  // ── Rentals (rental_vehicle_listings) ─────────────────────────────────────
  function rentalTitle(v) {
    var brand = (v.rental_brands && v.rental_brands.label) || '';
    return (((brand + ' ' + (v.model || '')).trim()) + (v.year ? ' ' + v.year : '')).trim() || 'Rental Vehicle';
  }
  function rentalPath(v) { return 'r/' + slugify(rentalTitle(v)) + '-' + v.id; }
  function rentalUrl(v) { return SITE + '/' + rentalPath(v); }
  // Physical filename on disk — see listingFilePath's comment above.
  function rentalFilePath(v) { return rentalPath(v) + '.html'; }

  function buildRentalSchema(v, canonicalUrl) {
    canonicalUrl = canonicalUrl || rentalUrl(v);
    var brand = (v.rental_brands && v.rental_brands.label) || '';
    var title = rentalTitle(v);
    var media = (v.rental_vehicle_media || []).slice().sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
    var company = v.rental_companies || {};
    return {
      '@context': 'https://schema.org', '@type': 'Vehicle',
      name: title,
      description: v.description || ('Rent a ' + title + ' in Zimbabwe with a verified rental company on PaMarket.'),
      image: media.length ? media.map(function (m) { return m.url; }) : undefined,
      url: canonicalUrl,
      brand: brand ? { '@type': 'Brand', name: brand } : undefined,
      model: v.model || undefined,
      vehicleModelDate: v.year ? String(v.year) : undefined,
      offers: {
        '@type': 'Offer', price: v.daily_rate || undefined, priceCurrency: 'USD',
        availability: v.is_available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        validFrom: v.created_at ? String(v.created_at).slice(0, 10) : undefined,
        businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
        areaServed: { '@type': 'Country', name: 'Zimbabwe' },
        hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', applicableCountry: 'ZW', returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted' },
        url: canonicalUrl
      },
      provider: { '@type': 'Organization', name: company.trading_name || 'PaMarket Rental Partner' }
    };
  }
  function buildRentalBreadcrumb(v, canonicalUrl) {
    canonicalUrl = canonicalUrl || rentalUrl(v);
    return {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Vehicle Rental', item: SITE + '/rentals' },
        { '@type': 'ListItem', position: 3, name: rentalTitle(v), item: canonicalUrl }
      ]
    };
  }

  // ── Businesses / shops (businesses) ───────────────────────────────────────
  function businessPath(b) { return 'b/' + slugify(b.name) + '-' + b.id; }
  function businessUrl(b) { return SITE + '/' + businessPath(b); }
  // Physical filename on disk — see listingFilePath's comment above.
  function businessFilePath(b) { return businessPath(b) + '.html'; }

  // Returns an ARRAY of schema objects: [ProfilePage, Store, BreadcrumbList].
  function buildBusinessSchema(b, url, reviews, products) {
    url = url || businessUrl(b);
    products = products || [];
    var address = { '@type': 'PostalAddress', addressCountry: 'ZW' };
    if (b.city) address.addressLocality = b.city;
    if (b.province) address.addressRegion = b.province;
    address.streetAddress = b.suburb || b.city || b.province || 'Zimbabwe';
    var store = {
      '@context': 'https://schema.org', '@type': 'Store', '@id': url + '#store',
      name: b.name, url: url,
      image: b.cover || b.logo || (SITE + '/img/icon-512.png'),
      address: address, areaServed: { '@type': 'Country', name: 'Zimbabwe' },
      isPartOf: { '@type': 'WebSite', name: 'PaMarket', url: SITE + '/' },
      publisher: { '@type': 'Organization', name: 'PaMarket', url: SITE + '/' }
    };
    if (b.logo) store.logo = b.logo;
    if (b.description) store.description = String(b.description).slice(0, 300);
    if (b.phone) store.telephone = b.phone;
    if (b.email) store.email = b.email;
    if (products.length) {
      store.hasOfferCatalog = {
        '@type': 'OfferCatalog', name: b.name + ' — listings',
        itemListElement: products.slice(0, 20).map(function (l) {
          return { '@type': 'Offer', price: l.price, priceCurrency: l.currency || 'USD', validFrom: l.created_at ? String(l.created_at).slice(0, 10) : undefined, itemOffered: { '@type': 'Product', name: l.title, url: listingUrl(l) } };
        })
      };
    }
    if (reviews && reviews.length) {
      var sum = reviews.reduce(function (a, r) { return a + (Number(r.rating) || 0); }, 0);
      store.aggregateRating = { '@type': 'AggregateRating', ratingValue: (sum / reviews.length).toFixed(1), reviewCount: reviews.length, bestRating: 5, worstRating: 1 };
      store.review = reviews.slice(0, 10).map(function (r) {
        var rev = { '@type': 'Review', author: { '@type': 'Person', name: r.reviewer_name || 'PaMarket user' }, reviewRating: { '@type': 'Rating', ratingValue: Number(r.rating) || 0, bestRating: 5, worstRating: 1 }, reviewBody: r.body || '' };
        // Omit rather than emit an empty-string datePublished (invalid ISO
        // 8601) when a review has no created_at.
        if (r.created_at) rev.datePublished = String(r.created_at).slice(0, 10);
        return rev;
      });
    }
    var profilePage = {
      '@context': 'https://schema.org', '@type': 'ProfilePage', '@id': url + '#page',
      url: url, name: b.name + ' — PaMarket',
      isPartOf: { '@type': 'WebSite', name: 'PaMarket', url: SITE + '/' },
      mainEntity: { '@id': url + '#store' }
    };
    // Full ISO 8601 datetime, not date-only — Google's structured data
    // validator flagged the date-only truncation as an "Invalid datetime
    // value for dateModified" (Search Console, 2026-07-15). b.updated_at
    // comes straight from Postgres as a full timestamptz string already;
    // re-parsed defensively so a malformed value is omitted rather than
    // throwing (Invalid Date .toISOString() throws a RangeError).
    if (b.updated_at) {
      var modDate = new Date(b.updated_at);
      if (!isNaN(modDate.getTime())) profilePage.dateModified = modDate.toISOString();
    }
    var breadcrumb = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Shops', item: SITE + '/browse?shops=1' },
        { '@type': 'ListItem', position: 3, name: b.name, item: url }
      ]
    };
    return [profilePage, store, breadcrumb];
  }

  return {
    SITE: SITE, CAT_LABELS: CAT_LABELS,
    slugify: slugify, listingPath: listingPath, listingUrl: listingUrl, listingFilePath: listingFilePath,
    catLabelOf: catLabelOf, locOf: locOf,
    buildListingSchema: buildListingSchema, buildBreadcrumb: buildBreadcrumb,
    rentalTitle: rentalTitle, rentalPath: rentalPath, rentalUrl: rentalUrl, rentalFilePath: rentalFilePath,
    buildRentalSchema: buildRentalSchema, buildRentalBreadcrumb: buildRentalBreadcrumb,
    businessPath: businessPath, businessUrl: businessUrl, businessFilePath: businessFilePath, buildBusinessSchema: buildBusinessSchema
  };
});
