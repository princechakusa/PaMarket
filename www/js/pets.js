'use strict';
(function (H) {

  H.pages.Pets = function () {
    var ls = (H.state.listings || []).filter(function (l) { return H.isPublicListingEligible(l) && l.cat === 'pets'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._filterCarouselHtml('pets', [
      {
        title: '1. Pet Type & Breed',
        tag: 'BASICS',
        html: H._sel('pets', 'subcat', 'Pet Type', [
                ['all','All'],['dogs','Dogs'],['cats','Cats'],['birds','Birds'],
                ['fish','Fish & Aquatic'],['farm','Farm Animals'],['accessories','Pet Accessories']
              ])
             + H._txtInput('pets', 'brand', 'Breed', 'e.g. German Shepherd, Persian Cat')
      },
      {
        title: '2. Price & Location',
        tag: 'RANGE FILTERS',
        html: H._priceRange('pets') + H._citysel('pets')
      }
    ], 'pets');

    return '<div class="page active">'
      + H._catTopbar('Pets', '#8E24AA')
      + H._catHeader('pets', 'Pets', '#8E24AA', f)
      + (H.adCarousel && H.activeAds ? H.adCarousel(H.activeAds('pets')) : '')
      + '<div id="cl_pets" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No pets listed', 'Find your perfect companion!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Pets_after = function () { H._applyFilters('pets'); if (H._initAdCarousels) H._initAdCarousels(); };

})(window.H);
