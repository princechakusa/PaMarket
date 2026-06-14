'use strict';
(function (H) {

  H.pages.Vehicles = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'vehicles'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('vehicles', 'subcat', 'Vehicle Type', [['all', 'All Types'], ['car', 'Car'], ['suv', 'SUV / 4x4'], ['truck', 'Truck / Pickup'], ['van', 'Van / Minibus'], ['motorcycle', 'Motorcycle'], ['bus', 'Bus'], ['tractor', 'Tractor'], ['boat', 'Boat']])
      + H._pills('vehicles', 'condition', 'Condition', [['brand new', 'Brand New'], ['used', 'Used'], ['for parts', 'For Parts']])
      + H._pills('vehicles', 'fuelType', 'Fuel', [['petrol', 'Petrol'], ['diesel', 'Diesel'], ['hybrid', 'Hybrid'], ['electric', 'Electric']])
      + H._yearRange('vehicles')
      + H._txtInput('vehicles', 'brand', 'Make / Brand', 'e.g. Toyota, Honda, BMW')
      + H._priceRange('vehicles') + H._citysel('vehicles') + H._amenityFilter('vehicles', 'vehicles') + H._sortsel('vehicles');

    return '<div class="page active">'
      + H._catTopbar('Vehicles', '#e53935')
      + H._catHeader('vehicles', 'Vehicles', '#e53935', f)
      + '<div id="cl_vehicles" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No vehicles listed', 'Be the first to sell!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Vehicles_after = function () { H._applyFilters('vehicles'); };

})(window.H);
