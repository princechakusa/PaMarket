'use strict';
(function (H) {

  H.pages.Agriculture = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'agriculture'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('agriculture', 'subcat', 'Category', [['all', 'All'], ['livestock', 'Livestock & Animals'], ['crops', 'Crops & Produce'], ['equipment', 'Farm Equipment & Tools'], ['seeds', 'Seeds & Seedlings'], ['land', 'Agricultural Land'], ['inputs', 'Fertilisers & Chemicals'], ['irrigation', 'Irrigation Systems'], ['poultry', 'Poultry'], ['dairy', 'Dairy Products'], ['other', 'Other']])
      + H._sel('agriculture', 'condition', 'Condition', [['all', 'All'], ['new', 'New'], ['used', 'Used'], ['good', 'Good Condition']])
      + H._citysel('agriculture') + H._priceRange('agriculture') + H._sortsel('agriculture');

    return '<div class="page active">'
      + H._catTopbar('Agriculture', '#388E3C')
      + H._catHeader('agriculture', 'Agriculture', '#388E3C', f)
      + '<div id="cl_agriculture" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No agriculture listings', 'Buy & sell farm products!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Agriculture_after = function () { H._applyFilters('agriculture'); };

})(window.H);
