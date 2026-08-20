'use strict';
(function (H) {

  H.pages.Vehicles = function () {
    var ls = (H.state.listings || []).filter(function (l) { return H.isPublicListingEligible(l) && l.cat === 'vehicles'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._filterCarouselHtml('vehicles', [
      {
        title: '1. Vehicle Type',
        tag: 'BASICS',
        html: H._sel('vehicles', 'subcat', 'Vehicle Type', [
                ['all','All Types'],['cars','Cars'],['bakkies','Bakkies & Trucks'],
                ['suvs','SUVs & 4x4'],['kombis','Kombis & Buses'],['motorbikes','Motorbikes'],
                ['trailers','Trailers'],['parts','Spares & Parts'],['tyres','Tyres & Rims']
              ])
             + H._pills('vehicles', 'condition', 'Condition', [
                ['Brand New','Brand New'],['Used','Used'],['For Parts','For Parts']
              ])
      },
      {
        title: '2. Make & Year',
        tag: 'DETAILS',
        html: H._txtInput('vehicles', 'brand', 'Make / Brand', 'e.g. Toyota, Honda, BMW')
             + H._yearRange('vehicles')
             + H._pills('vehicles', 'fuelType', 'Fuel Type', [
                ['Petrol','Petrol'],['Diesel','Diesel'],['Hybrid','Hybrid'],['Electric','Electric']
              ])
      },
      {
        title: '3. Price & Location',
        tag: 'RANGE FILTERS',
        html: H._priceRange('vehicles') + H._citysel('vehicles')
      }
    ], 'vehicles');

    return '<div class="page active">'
      + H._catTopbar('Vehicles', '#e53935')
      + H._catHeader('vehicles', 'Vehicles', '#e53935', f)
      + (H.adCarousel && H.activeAds ? H.adCarousel(H.activeAds('vehicles')) : '')
      + '<div id="cl_vehicles" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No vehicles listed', 'Be the first to sell!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Vehicles_after = function () { H._applyFilters('vehicles'); if (H._initAdCarousels) H._initAdCarousels(); };

})(window.H);
