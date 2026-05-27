'use strict';
(function (H) {

  H.pages.Vehicles = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'vehicles'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('vehicles', 'subcat', 'Vehicle Type', [['all', 'All Types'], ['car', 'Car'], ['suv', 'SUV / 4x4'], ['truck', 'Truck / Pickup'], ['van', 'Van / Minibus'], ['motorcycle', 'Motorcycle'], ['bus', 'Bus'], ['tractor', 'Tractor'], ['boat', 'Boat']])
      + H._sel('vehicles', 'condition', 'Condition', [['all', 'All'], ['new', 'Brand New'], ['used', 'Used'], ['accident-free', 'Accident Free']])
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">'
      + '<div><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Year From</div>'
      + '<input type="number" min="1960" max="2026" placeholder="e.g. 2015" oninput="H._setFilter(\'vehicles\',\'yearMin\',this.value)" style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box"></div>'
      + '<div><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Year To</div>'
      + '<input type="number" min="1960" max="2026" placeholder="e.g. 2024" oninput="H._setFilter(\'vehicles\',\'yearMax\',this.value)" style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box"></div>'
      + '</div>'
      + H._sel('vehicles', 'fuelType', 'Fuel Type', [['all', 'All'], ['petrol', 'Petrol'], ['diesel', 'Diesel'], ['electric', 'Electric'], ['hybrid', 'Hybrid'], ['lpg', 'LPG']])
      + H._txtInput('vehicles', 'brand', 'Make / Brand', 'e.g. Toyota, Honda, BMW')
      + H._citysel('vehicles') + H._priceRange('vehicles') + H._sortsel('vehicles');

    return '<div class="page active">'
      + H._catTopbar('Vehicles', '#e53935')
      + H._catHeader('vehicles', 'Vehicles', '#e53935', f)
      + '<div id="cl_vehicles" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No vehicles listed', 'Be the first to sell!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Vehicles_after = function () { H._applyFilters('vehicles'); };

})(window.H);
