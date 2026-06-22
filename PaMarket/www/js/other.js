'use strict';
(function (H) {

  H.pages.Other = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'other'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('other', 'subcat', 'Category', [['all', 'All'], ['antiques', 'Antiques & Collectibles'], ['sports', 'Sports & Fitness'], ['music', 'Musical Instruments'], ['books', 'Books & Magazines'], ['art', 'Art & Crafts'], ['tools', 'Tools & DIY'], ['health', 'Health & Beauty'], ['office', 'Office Supplies'], ['food', 'Food & Beverages'], ['other', 'Miscellaneous']])
      + H._sel('other', 'condition', 'Condition', [['all', 'All'], ['new', 'New'], ['like-new', 'Like New'], ['good', 'Good'], ['fair', 'Fair']])
      + H._citysel('other') + H._priceRange('other') + H._sortsel('other');

    return '<div class="page active">'
      + H._catTopbar('Other', '#546E7A')
      + H._catHeader('other', 'Other', '#546E7A', f)
      + '<div id="cl_other" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No listings yet', 'Post anything for sale!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Other_after = function () { H._applyFilters('other'); };

})(window.H);
