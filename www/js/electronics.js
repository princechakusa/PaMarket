'use strict';
(function (H) {

  H.pages.Electronics = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'electronics'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('electronics', 'subcat', 'Category', [['all', 'All'], ['phones', 'Phones & Tablets'], ['computers', 'Computers & Laptops'], ['tvs', 'TVs & Screens'], ['audio', 'Audio & Speakers'], ['cameras', 'Cameras'], ['gaming', 'Gaming'], ['appliances', 'Appliances'], ['accessories', 'Accessories']])
      + H._txtInput('electronics', 'brand', 'Brand', 'e.g. Samsung, Apple, Dell')
      + H._sel('electronics', 'condition', 'Condition', [['all', 'All'], ['new', 'Brand New'], ['like-new', 'Like New'], ['good', 'Good'], ['fair', 'Fair']])
      + H._citysel('electronics') + H._priceRange('electronics') + H._sortsel('electronics');

    return '<div class="page active">'
      + H._catTopbar('Electronics', '#8E24AA')
      + H._catHeader('electronics', 'Electronics', '#8E24AA', f)
      + '<div id="cl_electronics" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No electronics listed', 'Buy & sell gadgets!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Electronics_after = function () { H._applyFilters('electronics'); };

})(window.H);
