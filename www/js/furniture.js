'use strict';
(function (H) {

  H.pages.Furniture = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'furniture'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('furniture', 'subcat', 'Furniture Type', [['all', 'All'], ['sofas', 'Sofas & Lounge'], ['bedroom', 'Bedroom Sets'], ['dining', 'Dining Room'], ['office', 'Office Furniture'], ['outdoor', 'Outdoor'], ['kitchen', 'Kitchen'], ['wardrobes', 'Wardrobes'], ['decor', 'Home Décor']])
      + H._sel('furniture', 'condition', 'Condition', [['all', 'All'], ['new', 'Brand New'], ['like-new', 'Like New'], ['good', 'Good'], ['fair', 'Fair']])
      + H._txtInput('furniture', 'brand', 'Material', 'e.g. Wood, Leather, Fabric')
      + H._citysel('furniture') + H._priceRange('furniture') + H._sortsel('furniture');

    return '<div class="page active">'
      + H._catTopbar('Furniture', '#6D4C41')
      + H._catHeader('furniture', 'Furniture', '#6D4C41', f)
      + '<div id="cl_furniture" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No furniture listed', 'Furnish your home!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Furniture_after = function () { H._applyFilters('furniture'); };

})(window.H);
