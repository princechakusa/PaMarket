'use strict';
(function (H) {

  H.pages.Furniture = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'furniture'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._filterCarouselHtml('furniture', [
      {
        title: '1. Type & Condition',
        tag: 'BASICS',
        html: H._sel('furniture', 'subcat', 'Furniture Type', [
                ['all','All'],['sofas','Sofas & Lounge'],['beds','Beds & Bedroom'],
                ['dining','Dining & Kitchen'],['office','Office Furniture'],
                ['outdoor','Garden & Outdoor'],['wardrobes','Wardrobes & Storage'],
                ['curtains','Curtains & Blinds'],['rugs','Rugs & Carpets'],
                ['lighting','Lighting & Fans'],['decor','Home Décor']
              ])
             + H._pills('furniture', 'condition', 'Condition', [
                ['Brand New','Brand New'],['Used','Used']
              ])
      },
      {
        title: '2. Material & Price',
        tag: 'RANGE FILTERS',
        html: H._txtInput('furniture', 'brand', 'Material', 'e.g. Wood, Leather, Fabric')
             + H._priceRange('furniture')
             + H._citysel('furniture')
      }
    ]);

    return '<div class="page active">'
      + H._catTopbar('Furniture', '#6D4C41')
      + H._catHeader('furniture', 'Furniture', '#6D4C41', f)
      + (H.adCarousel && H.activeAds ? H.adCarousel(H.activeAds('furniture')) : '')
      + '<div id="cl_furniture" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No furniture listed', 'Furnish your home!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Furniture_after = function () { H._applyFilters('furniture'); if (H._initAdCarousels) H._initAdCarousels(); };

})(window.H);
