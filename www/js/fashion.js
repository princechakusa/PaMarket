'use strict';
(function (H) {

  H.pages.Fashion = function () {
    var ls = (H.state.listings || []).filter(function (l) { return H.isPublicListingEligible(l) && l.cat === 'fashion'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._filterCarouselHtml('fashion', [
      {
        title: '1. Category & Gender',
        tag: 'GENERAL INFO',
        html: H._sel('fashion', 'subcat', 'Type', [
                ['all','All'],['clothing','Clothing'],['shoes','Shoes'],
                ['bags','Bags & Luggage'],['watches','Watches'],['jewellery','Jewellery'],['accessories','Accessories']
              ])
             + H._pills('fashion', 'gender', 'Gender', [
                ['Women','Women'],['Men','Men'],['Kids','Kids'],['Unisex','Unisex']
              ])
      },
      {
        title: '2. Size & Condition',
        tag: 'DETAILS',
        html: H._sel('fashion', 'size', 'Size', [
                ['all','Any Size'],['XS','XS'],['S','S'],['M','M'],['L','L'],
                ['XL','XL'],['2XL','2XL'],['3XL+','3XL+']
              ])
             + H._pills('fashion', 'condition', 'Condition', [
                ['Brand New','Brand New'],['Used','Used']
              ])
             + H._txtInput('fashion', 'brand', 'Brand', 'e.g. Nike, Zara, H&M')
      },
      {
        title: '3. Price & Location',
        tag: 'RANGE FILTERS',
        html: H._priceRange('fashion') + H._citysel('fashion')
      }
    ]);

    return '<div class="page active">'
      + H._catTopbar('Fashion', '#E91E63')
      + H._catHeader('fashion', 'Fashion', '#E91E63', f)
      + (H.adCarousel && H.activeAds ? H.adCarousel(H.activeAds('fashion')) : '')
      + '<div id="cl_fashion" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No fashion items listed', 'Style up Zimbabwe!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Fashion_after = function () { H._applyFilters('fashion'); if (H._initAdCarousels) H._initAdCarousels(); };

})(window.H);
