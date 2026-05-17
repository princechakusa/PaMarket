'use strict';
(function (H) {

  H.pages.Pets = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'pets'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('pets', 'subcat', 'Pet Type', [['all', 'All'], ['dogs', 'Dogs'], ['cats', 'Cats'], ['birds', 'Birds'], ['fish', 'Fish & Aquatic'], ['rabbits', 'Rabbits & Small Animals'], ['reptiles', 'Reptiles'], ['livestock', 'Livestock'], ['other', 'Other']])
      + H._txtInput('pets', 'brand', 'Breed', 'e.g. German Shepherd, Persian Cat')
      + H._citysel('pets') + H._priceRange('pets') + H._sortsel('pets');

    return '<div class="page active">'
      + H._catTopbar('Pets', '#FB8C00')
      + H._catHeader('pets', 'Pets', '#FB8C00', f)
      + '<div id="cl_pets" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No pets listed', 'Find your perfect companion!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Pets_after = function () { H._applyFilters('pets'); };

})(window.H);
