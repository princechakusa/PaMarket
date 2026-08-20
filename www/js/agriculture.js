'use strict';
(function (H) {

  H.pages.Agriculture = function () {
    var ls = (H.state.listings || []).filter(function (l) { return H.isPublicListingEligible(l) && l.cat === 'agriculture'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._filterCarouselHtml('agriculture', [
      {
        title: '1. Category & Condition',
        tag: 'BASICS',
        html: H._sel('agriculture', 'subcat', 'Category', [
                ['all','All'],['livestock','Livestock'],['poultry','Poultry'],
                ['produce','Crops & Produce'],['seeds','Seeds & Seedlings'],
                ['equipment','Farm Equipment'],['irrigation','Irrigation'],['feed','Feed & Fertiliser']
              ])
             + H._pills('agriculture', 'condition', 'Condition', [
                ['New','New'],['Used','Used'],['Live','Live']
              ])
      },
      {
        title: '2. Price & Location',
        tag: 'RANGE FILTERS',
        html: H._priceRange('agriculture') + H._citysel('agriculture')
      }
    ]);

    return '<div class="page active">'
      + H._catTopbar('Agriculture', '#388E3C')
      + H._catHeader('agriculture', 'Agriculture', '#388E3C', f)
      + (H.adCarousel && H.activeAds ? H.adCarousel(H.activeAds('agriculture')) : '')
      + '<div id="cl_agriculture" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No agriculture listings', 'Buy & sell farm products!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Agriculture_after = function () { H._applyFilters('agriculture'); if (H._initAdCarousels) H._initAdCarousels(); };

})(window.H);
