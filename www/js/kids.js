'use strict';
(function (H) {

  H.pages.Kids = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'kids'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('kids', 'subcat', 'Category', [['all', 'All'], ['clothing', 'Clothing & Shoes'], ['toys', 'Toys & Games'], ['furniture', 'Baby Furniture & Gear'], ['feeding', 'Feeding & Nursing'], ['education', 'Books & Education'], ['strollers', 'Strollers & Car Seats'], ['electronics', 'Kids Electronics'], ['other', 'Other']])
      + H._sel('kids', 'gender', 'For', [['all', 'All'], ['boys', 'Boys'], ['girls', 'Girls'], ['unisex', 'Unisex'], ['baby', 'Baby (0-2yr)']])
      + H._sel('kids', 'condition', 'Condition', [['all', 'All'], ['new', 'Brand New'], ['like-new', 'Like New'], ['good', 'Good'], ['fair', 'Fair']])
      + H._citysel('kids') + H._priceRange('kids') + H._sortsel('kids');

    return '<div class="page active">'
      + H._catTopbar('Baby & Kids', '#E91E63')
      + H._catHeader('kids', 'Baby & Kids', '#E91E63', f)
      + '<div id="cl_kids" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No kids items listed', 'Great deals for little ones!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Kids_after = function () { H._applyFilters('kids'); };

})(window.H);
