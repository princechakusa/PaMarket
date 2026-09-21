/* ============================================================
   Shared footer for the "new mockup" design system pages
   (index.html, browse.html, jobs.html, and any future page using
   the same Tailwind-CDN design). This is the FIRST page in this
   rollout allowed to share this markup via a JS include: index.html
   was built before this component existed (per its own build task)
   and is deliberately left untouched with its own inline copy, but
   browse.html and jobs.html are the 2nd/3rd pages to need the exact
   same footer, so from here on new pages in this design system
   should call PMSiteFooter.mount() against a
   <div id="site-footer"></div> placeholder instead of pasting the
   markup a 3rd/4th/5th time.
   Every link below points at a real existing page (see
   tools/website-build/config.js ROOT_PAGES) — no fabricated pages.
   ============================================================ */
(function (global) {
  'use strict';

  var HTML = '' +
    '<div class="max-w-7xl mx-auto px-margin md:px-margin-desktop py-space-2xl grid grid-cols-1 lg:grid-cols-5 gap-space-2xl">' +
      '<div class="lg:col-span-1">' +
        '<div class="flex items-center gap-2">' +
          '<img alt="PaMarket Zimbabwe Logo" class="h-7 w-auto object-contain" src="img/icon-192.png">' +
          '<span class="font-headline-md text-headline-sm font-bold tracking-tight text-primary uppercase">PaMarket</span>' +
        '</div>' +
        '<p class="mt-3 text-body-sm font-body-sm text-on-surface-variant">Zimbabwe\'s free digital marketplace — buy, sell, find jobs and grow a verified business across all ten provinces.</p>' +
        '<div class="mt-4 flex flex-col gap-2">' +
          '<a href="https://play.google.com/store/apps/details?id=com.pamarket.app" target="_blank" rel="noopener" class="inline-flex items-center gap-2 text-label-sm font-label-sm text-on-surface hover:text-primary"><span class="pm-material text-[16px]">shop</span>Get on Google Play Store</a>' +
          '<a href="https://apps.apple.com/app/id6794616959" target="_blank" rel="noopener" class="inline-flex items-center gap-2 text-label-sm font-label-sm text-on-surface hover:text-primary"><span class="pm-material text-[16px]">apple</span>Download Apple App Store</a>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<h5 class="text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant mb-3">Marketplace Categories</h5>' +
        '<ul class="flex flex-col gap-2 text-body-sm font-body-sm">' +
          '<li><a class="hover:text-primary" href="browse.html?cat=vehicles">Vehicles &amp; Car Rental</a></li>' +
          '<li><a class="hover:text-primary" href="browse.html?cat=property">Residential &amp; Commercial Property</a></li>' +
          '<li><a class="hover:text-primary" href="browse.html?cat=electronics">Mobile Phones &amp; Tech Hardware</a></li>' +
          '<li><a class="hover:text-primary" href="browse.html?cat=furniture">Home Living &amp; Furniture</a></li>' +
          '<li><a class="hover:text-primary" href="browse.html?cat=agriculture">Agriculture Inputs &amp; Produce</a></li>' +
          '<li><a class="hover:text-primary" href="browse.html?cat=fashion">Fashion Apparel &amp; Beauty</a></li>' +
          '<li><a class="hover:text-primary" href="browse.html?cat=kids">Baby, Kids &amp; Toys</a></li>' +
          '<li><a class="hover:text-primary" href="browse.html?cat=pets">Livestock, Poultry &amp; Pets</a></li>' +
        '</ul>' +
      '</div>' +
      '<div>' +
        '<h5 class="text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant mb-3">Dedicated Hubs</h5>' +
        '<ul class="flex flex-col gap-2 text-body-sm font-body-sm">' +
          '<li><a class="hover:text-primary" href="jobs.html">PaMarket Jobs (Seekers &amp; Employers)</a></li>' +
          '<li><a class="hover:text-primary" href="browse.html?shops=1">Verified Business Storefronts</a></li>' +
          '<li><a class="hover:text-primary" href="institutions.html">High School Communities</a></li>' +
          '<li><a class="hover:text-primary" href="institutions.html">Colleges &amp; Universities Campus Hub</a></li>' +
          '<li><a class="hover:text-primary" href="advertise.html">Advertise With Us &amp; Banner Placements →</a></li>' +
        '</ul>' +
      '</div>' +
      '<div>' +
        '<h5 class="text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant mb-3">Trust, Safety &amp; Legal</h5>' +
        '<ul class="flex flex-col gap-2 text-body-sm font-body-sm">' +
          '<li><a class="hover:text-primary" href="safety.html">Safety Guidelines for Buyers &amp; Sellers</a></li>' +
          '<li><a class="hover:text-primary" href="safety.html">Scam Awareness &amp; Reporting Fraud</a></li>' +
          '<li><a class="hover:text-primary" href="terms.html">Terms of Service &amp; Compliance</a></li>' +
          '<li><a class="hover:text-primary" href="privacy.html">Privacy &amp; Data Protection Policy</a></li>' +
          '<li><a class="hover:text-primary" href="community-guidelines.html">Prohibited Items &amp; Community Guidelines</a></li>' +
          '<li><a class="hover:text-primary" href="refund-policy.html">Refund &amp; Cancellation Policy</a></li>' +
        '</ul>' +
      '</div>' +
      '<div>' +
        '<h5 class="text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant mb-3">Support</h5>' +
        '<ul class="flex flex-col gap-2 text-body-sm font-body-sm">' +
          '<li><a class="hover:text-primary" href="contact.html">24/7 Help Desk &amp; Inquiries</a></li>' +
          '<li><a class="hover:text-primary" href="https://wa.me/971589772645" target="_blank" rel="noopener">WhatsApp Helpline: +971 589 772 645</a></li>' +
          '<li><a class="hover:text-primary" href="mailto:support@pamarketzw.com">support@pamarketzw.com</a></li>' +
          '<li><a class="hover:text-primary" href="help.html">Help &amp; FAQ</a></li>' +
          '<li><a class="hover:text-primary" href="advertise.html">Advertise With Us →</a></li>' +
        '</ul>' +
      '</div>' +
    '</div>' +
    '<div class="border-t border-outline-variant">' +
      '<div class="max-w-7xl mx-auto px-margin md:px-margin-desktop py-space-md flex flex-wrap items-center justify-between gap-3 text-label-sm font-label-sm text-on-surface-variant">' +
        '<span>&copy; 2026 PaMarket Zimbabwe. Serving all 10 provinces across Zimbabwe. Made in Zimbabwe. All rights reserved.</span>' +
        '<span>Multi-Currency Support (USD / ZiG)</span>' +
      '</div>' +
    '</div>';

  function mount(elOrId) {
    var el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    el.className = (el.className ? el.className + ' ' : '') + 'bg-surface-container-lowest border-t border-outline-variant';
    el.innerHTML = HTML;
  }

  function init() {
    var el = document.getElementById('site-footer');
    if (el) mount(el);
  }

  global.PMSiteFooter = Object.freeze({ mount: mount, html: HTML });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
