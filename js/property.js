'use strict';
(function (H) {

  H.pages.Property = function () {
    var all = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'property'; });
    var sale = all.filter(function (l) { return !l.rentalType; }).sort(function (a, b) { return b.createdAt - a.createdAt; });
    var rent = all.filter(function (l) { return !!l.rentalType; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var fSale = H._sel('property_sale', 'propType', 'Property Type', [['all', 'All Types'], ['residential', 'Residential'], ['commercial', 'Commercial'], ['land', 'Land / Stand'], ['units', 'Units / Flats']])
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + H._sel('property_sale', 'beds', 'Bedrooms', [['any', 'Any'], ['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+'], ['5', '5+']])
      + H._sel('property_sale', 'baths', 'Bathrooms', [['any', 'Any'], ['1', '1+'], ['2', '2+'], ['3', '3+']])
      + '</div>'
      + H._sel('property_sale', 'furnishing', 'Furnishing', [['all', 'All'], ['furnished', 'Furnished'], ['unfurnished', 'Unfurnished'], ['semi-furnished', 'Semi-Furnished']])
      + H._citysel('property_sale') + H._priceRange('property_sale') + H._sortsel('property_sale');

    var fRent = H._sel('property_rent', 'propType', 'Category', [['all', 'All'], ['residential', 'Residential'], ['rooms', 'Rooms'], ['commercial', 'Commercial']])
      + H._sel('property_rent', 'rentalType', 'Rental Type', [['all', 'All'], ['monthly', 'Monthly'], ['daily', 'Daily'], ['nightly', 'Nightly']])
      + H._sel('property_rent', 'furnishing', 'Furnishing', [['all', 'All'], ['furnished', 'Furnished'], ['unfurnished', 'Unfurnished'], ['semi-furnished', 'Semi-Furnished']])
      + H._citysel('property_rent') + H._priceRange('property_rent') + H._sortsel('property_rent');

    return '<div class="page active">'
      + H._catTopbar('Property', '#1A3A8F')
      + '<div style="background:#1A3A8F;padding:0 14px">'
      + '<div style="display:flex;border-bottom:2px solid rgba(255,255,255,.15)">'
      + '<button id="ptab_sale" onclick="H._propTab(\'sale\')" style="flex:1;padding:12px 0;background:none;border:none;border-bottom:3px solid #F5A623;margin-bottom:-2px;color:#fff;font-size:14px;font-weight:700;cursor:pointer">For Sale</button>'
      + '<button id="ptab_rent" onclick="H._propTab(\'rent\')" style="flex:1;padding:12px 0;background:none;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;color:rgba(255,255,255,.6);font-size:14px;font-weight:600;cursor:pointer">For Rent</button>'
      + '</div></div>'
      + '<div id="pp_sale">'
      + H._catHeader('property_sale', 'Property for Sale', '#1A3A8F', fSale)
      + '<div id="cl_property_sale" style="padding-bottom:88px">'
      + (sale.length ? '<div class="listing-list">' + sale.map(H.renderListCard).join('') + '</div>' : H.emptyState('No properties for sale', 'Be the first to list one!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>'
      + '<div id="pp_rent" style="display:none">'
      + H._catHeader('property_rent', 'Property for Rent', '#1A3A8F', fRent)
      + '<div id="cl_property_rent" style="padding-bottom:88px">'
      + (rent.length ? '<div class="listing-list">' + rent.map(H.renderListCard).join('') + '</div>' : H.emptyState('No rental properties', 'Be the first to list one!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>'
      + '</div>';
  };

  H.pages.Property_after = function () { H._propTab('sale'); };

  H._propTab = function (tab) {
    var ps = document.getElementById('pp_sale'), pr = document.getElementById('pp_rent');
    var ts = document.getElementById('ptab_sale'), tr = document.getElementById('ptab_rent');
    if (!ps) return;
    var isSale = tab === 'sale';
    ps.style.display = isSale ? '' : 'none';
    pr.style.display = isSale ? 'none' : '';
    ts.style.color = isSale ? '#fff' : 'rgba(255,255,255,.6)';
    ts.style.fontWeight = isSale ? '700' : '600';
    ts.style.borderBottomColor = isSale ? '#F5A623' : 'transparent';
    tr.style.color = isSale ? 'rgba(255,255,255,.6)' : '#fff';
    tr.style.fontWeight = isSale ? '600' : '700';
    tr.style.borderBottomColor = isSale ? 'transparent' : '#F5A623';
    H._applyFilters(isSale ? 'property_sale' : 'property_rent');
  };

})(window.H);
