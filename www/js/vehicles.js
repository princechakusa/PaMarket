'use strict';
(function (H) {

  H.pages.Vehicles = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'vehicles'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

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

    var rentalBanner = '<div onclick="H.openInner(\'RentalListings\')" style="margin:10px 12px 0;background:#1A3A8F;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer">'
      + '<div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2M7 17h10"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M5 9l2-4h10l2 4"/></svg></div>'
      + '<div style="flex:1"><div style="font-size:14px;font-weight:800;color:#fff">Vehicle Rentals</div><div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:2px">Browse cars, SUVs, pickups & more for rent</div></div>'
      + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'
      + '</div>';

    return '<div class="page active">'
      + H._catTopbar('Vehicles', '#e53935')
      + H._catHeader('vehicles', 'Vehicles', '#e53935', f)
      + rentalBanner
      + (H.adCarousel && H.activeAds ? H.adCarousel(H.activeAds('vehicles')) : '')
      + '<div id="cl_vehicles" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No vehicles listed', 'Be the first to sell!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Vehicles_after = function () { H._applyFilters('vehicles'); if (H._initAdCarousels) H._initAdCarousels(); };

})(window.H);
