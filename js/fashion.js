'use strict';
(function (H) {

  H.pages.Fashion = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'fashion'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('fashion', 'gender', 'Category', [['all', 'All'], ['women', 'Women'], ['men', 'Men'], ['kids', 'Kids'], ['unisex', 'Unisex']])
      + H._sel('fashion', 'subcat', 'Type', [['all', 'All'], ['clothes', 'Clothes'], ['shoes', 'Shoes'], ['bags', 'Bags & Purses'], ['accessories', 'Accessories'], ['watches', 'Watches & Jewellery'], ['sportswear', 'Sportswear'], ['traditional', 'Traditional Wear']])
      + H._sel('fashion', 'size', 'Size', [['all', 'Any Size'], ['xs', 'XS'], ['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL'], ['xxl', '2XL'], ['xxxl', '3XL+']])
      + H._txtInput('fashion', 'brand', 'Brand', 'e.g. Nike, Zara, H&M')
      + H._sel('fashion', 'condition', 'Condition', [['all', 'All'], ['new', 'Brand New'], ['like-new', 'Like New'], ['good', 'Good'], ['fair', 'Fair']])
      + H._citysel('fashion') + H._priceRange('fashion') + H._sortsel('fashion');

    return '<div class="page active">'
      + H._catTopbar('Fashion', '#F06292')
      + H._catHeader('fashion', 'Fashion', '#F06292', f)
      + '<div id="cl_fashion" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No fashion items listed', 'Style up Zimbabwe!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Fashion_after = function () { H._applyFilters('fashion'); };

})(window.H);
