'use strict';
(function (H) {

  H.pages.Other = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'other'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._filterCarouselHtml('other', [
      {
        title: '1. Category & Condition',
        tag: 'BASICS',
        html: H._sel('other', 'subcat', 'Category', [
                ['all','All'],['antiques','Antiques & Collectibles'],['sports','Sports & Fitness'],
                ['music','Musical Instruments'],['books','Books & Magazines'],
                ['art','Art & Crafts'],['tools','Tools & DIY'],['health','Health & Beauty'],
                ['office','Office Supplies'],['food','Food & Beverages'],['other','Miscellaneous']
              ])
             + H._pills('other', 'condition', 'Condition', [
                ['new','New'],['like-new','Like New'],['used','Used'],['refurbished','Refurbished']
              ])
      },
      {
        title: '2. Price & Location',
        tag: 'RANGE FILTERS',
        html: H._priceRange('other') + H._citysel('other')
      }
    ]);

    return '<div class="page active">'
      + H._catTopbar('Other', '#546E7A')
      + H._catHeader('other', 'Other', '#546E7A', f)
      + (H.adCarousel && H.activeAds ? H.adCarousel(H.activeAds('other')) : '')
      + '<div id="cl_other" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No listings yet', 'Post anything for sale!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Other_after = function () { H._applyFilters('other'); if (H._initAdCarousels) H._initAdCarousels(); };

})(window.H);
