'use strict';
(function (H) {

  H.pages.Rooms = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'rooms'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('rooms', 'subcat', 'Room Type', [['all', 'All'], ['single', 'Single Room'], ['double', 'Double Room'], ['self-contained', 'Self-Contained'], ['shared', 'Shared'], ['bachelor', 'Bachelor Flat'], ['cottage', 'Cottage']])
      + H._sel('rooms', 'furnishing', 'Furnishing', [['all', 'All'], ['furnished', 'Furnished'], ['unfurnished', 'Unfurnished'], ['semi-furnished', 'Semi-Furnished']])
      + H._sel('rooms', 'rentalType', 'Rental Type', [['all', 'All'], ['monthly', 'Monthly'], ['daily', 'Daily'], ['nightly', 'Nightly']])
      + H._citysel('rooms') + H._priceRange('rooms') + H._sortsel('rooms');

    return '<div class="page active">'
      + H._catTopbar('Rooms for Rent', '#00838F')
      + H._catHeader('rooms', 'Rooms', '#00838F', f)
      + '<div id="cl_rooms" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No rooms listed', 'Find the perfect room!', 'Post a Room', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Rooms_after = function () { H._applyFilters('rooms'); };

})(window.H);
