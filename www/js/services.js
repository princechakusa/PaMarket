'use strict';
(function (H) {

  H.pages.Services = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'services'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('services', 'subcat', 'Service Type', [['all', 'All Services'], ['cleaning', 'Cleaning'], ['construction', 'Construction & Building'], ['plumbing', 'Plumbing'], ['electrical', 'Electrical'], ['painting', 'Painting'], ['gardening', 'Gardening & Landscaping'], ['transport', 'Transport & Delivery'], ['photography', 'Photography & Video'], ['catering', 'Catering & Events'], ['it', 'IT & Tech Support'], ['tutoring', 'Tutoring & Education'], ['beauty', 'Beauty & Wellness'], ['security', 'Security'], ['legal', 'Legal & Finance']])
      + H._citysel('services') + H._priceRange('services') + H._sortsel('services');

    return '<div class="page active">'
      + H._catTopbar('Services', '#00897B')
      + H._catHeader('services', 'Services', '#00897B', f)
      + '<div id="cl_services" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No services listed', 'Offer your skills in Zimbabwe!', 'Post a Service', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Services_after = function () { H._applyFilters('services'); };

})(window.H);
