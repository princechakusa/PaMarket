'use strict';
(function (H) {

  H.pages.Rooms = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'rooms'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._filterCarouselHtml('rooms', [
      {
        title: '1. Room Type',
        tag: 'BASICS',
        html: H._sel('rooms', 'subcat', 'Room Type', [
                ['all','All'],['single','Single Rooms'],['shared','Shared Rooms'],
                ['cottage','Cottages'],['full-house','Full House Share'],
                ['self-contained','Self-Contained'],['student','Student Digs']
              ])
             + H._pills('rooms', 'furnishing', 'Furnishing', [
                ['Furnished','Furnished'],['Unfurnished','Unfurnished'],['Part Furnished','Part Furnished']
              ])
      },
      {
        title: '2. Price & Location',
        tag: 'RANGE FILTERS',
        html: H._priceRange('rooms') + H._citysel('rooms')
      }
    ], 'rooms');

    return '<div class="page active">'
      + H._catTopbar('Rooms for Rent', '#00838F')
      + H._catHeader('rooms', 'Rooms', '#00838F', f)
      + '<div id="cl_rooms" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No rooms listed', 'Find the perfect room!', 'Post a Room', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Rooms_after = function () { H._applyFilters('rooms'); };

})(window.H);
