'use strict';
(function (H) {

  H.pages.Electronics = function () {
    var ls = (H.state.listings || []).filter(function (l) { return H.isPublicListingEligible(l) && l.cat === 'electronics'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._filterCarouselHtml('electronics', [
      {
        title: '1. Category & Brand',
        tag: 'GENERAL INFO',
        html: H._sel('electronics', 'subcat', 'Category', [
                ['all','All'],['phones','Phones & Tablets'],['computers','Laptops & Computers'],
                ['tvs','TVs & Monitors'],['audio','Audio & Sound'],['cameras','Cameras'],
                ['gaming','Gaming'],['accessories','Accessories']
              ])
             + H._txtInput('electronics', 'brand', 'Brand', 'e.g. Samsung, Apple, Dell')
      },
      {
        title: '2. Condition & Price',
        tag: 'RANGE FILTERS',
        html: H._pills('electronics', 'condition', 'Condition', [
                ['Brand New','Brand New'],['Used','Used'],['Refurbished','Refurbished'],['For Parts','For Parts']
              ])
             + H._priceRange('electronics')
             + H._citysel('electronics')
      }
    ]);

    return '<div class="page active">'
      + H._catTopbar('Electronics', '#3949AB')
      + H._catHeader('electronics', 'Electronics', '#3949AB', f)
      + (H.adCarousel && H.activeAds ? H.adCarousel(H.activeAds('electronics')) : '')
      + '<div id="cl_electronics" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No electronics listed', 'Buy & sell gadgets!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Electronics_after = function () { H._applyFilters('electronics'); if (H._initAdCarousels) H._initAdCarousels(); };

})(window.H);
