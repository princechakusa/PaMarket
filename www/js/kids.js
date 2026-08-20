'use strict';
(function (H) {

  H.pages.Kids = function () {
    var ls = (H.state.listings || []).filter(function (l) { return H.isPublicListingEligible(l) && l.cat === 'kids'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._filterCarouselHtml('kids', [
      {
        title: '1. Category & For',
        tag: 'BASICS',
        html: H._sel('kids', 'subcat', 'Category', [
                ['all','All'],['clothing','Clothing'],['toys','Toys'],
                ['prams','Prams & Strollers'],['cots','Cots & Beds'],
                ['carseats','Car Seats'],['school','School Items']
              ])
             + H._pills('kids', 'gender', 'For', [
                ['Boys','Boys'],['Girls','Girls'],['Unisex','Unisex']
              ])
      },
      {
        title: '2. Condition & Price',
        tag: 'RANGE FILTERS',
        html: H._pills('kids', 'condition', 'Condition', [
                ['Brand New','Brand New'],['Used','Used']
              ])
             + H._priceRange('kids')
             + H._citysel('kids')
      }
    ]);

    return '<div class="page active">'
      + H._catTopbar('Baby & Kids', '#E91E63')
      + H._catHeader('kids', 'Baby & Kids', '#E91E63', f)
      + (H.adCarousel && H.activeAds ? H.adCarousel(H.activeAds('kids')) : '')
      + '<div id="cl_kids" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No kids items listed', 'Great deals for little ones!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Kids_after = function () { H._applyFilters('kids'); if (H._initAdCarousels) H._initAdCarousels(); };

})(window.H);
