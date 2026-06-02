import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../models/listing.dart';
import '../../services/auth_service.dart';
import '../../services/chat_service.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';
import '../../widgets/auth_modal.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _selectedCity = 'All Zimbabwe';
  List<Listing> _listings = [];
  List<_SponsoredAd> _sponsored = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _offset = 0;
  int _unreadMsgs = 0;
  int _unreadNotifs = 0;
  static const int _pageSize = 60;

  final ScrollController _scroll = ScrollController();

  static const _cities = [
    'All Zimbabwe', 'Harare', 'Bulawayo', 'Mutare',
    'Gweru', 'Masvingo', 'Chinhoyi', 'Kwekwe', 'Kadoma',
  ];

  // Order + colors mirror CATEGORIES and CAT_COLORS in www/js/app.js + home.js
  static const _categories = [
    _Category(id: 'property',    label: 'Property',    icon: Icons.home,           color: Color(0xFF1E88E5)),
    _Category(id: 'vehicles',    label: 'Vehicles',    icon: Icons.local_shipping, color: Color(0xFFE53935)),
    _Category(id: 'rooms',       label: 'Rooms',       icon: Icons.bed,            color: Color(0xFF00838F)),
    _Category(id: 'electronics', label: 'Electronics', icon: Icons.computer,       color: Color(0xFF8E24AA)),
    _Category(id: 'jobs',        label: 'Jobs',        icon: Icons.work,           color: Color(0xFFF5A623)),
    _Category(id: 'furniture',   label: 'Furniture',   icon: Icons.weekend,        color: Color(0xFF6D4C41)),
    _Category(id: 'fashion',     label: 'Fashion',     icon: Icons.shopping_bag,   color: Color(0xFFF06292)),
    _Category(id: 'services',    label: 'Services',    icon: Icons.settings,       color: Color(0xFF00897B)),
    _Category(id: 'agriculture', label: 'Agriculture', icon: Icons.grass,          color: Color(0xFF558B2F)),
    _Category(id: 'pets',        label: 'Pets',        icon: Icons.pets,           color: Color(0xFFFB8C00)),
    _Category(id: 'kids',        label: 'Baby & Kids', icon: Icons.child_care,     color: Color(0xFFE91E63)),
    _Category(id: 'other',       label: 'Other',       icon: Icons.more_horiz,     color: Color(0xFF546E7A)),
  ];

  @override
  void initState() {
    super.initState();
    _loadCity();
    _load();
    _loadSponsored();
    _loadBadges();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadCity() async {
    final prefs = await SharedPreferences.getInstance();
    final city = prefs.getString('selected_city') ?? 'All Zimbabwe';
    if (mounted) setState(() => _selectedCity = city);
  }

  Future<void> _saveCity(String city) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('selected_city', city);
  }

  // Unread badges for notifications + messages icons (mirrors home.js header)
  Future<void> _loadBadges() async {
    if (!AuthService.isSignedIn) {
      if (mounted) setState(() { _unreadMsgs = 0; _unreadNotifs = 0; });
      return;
    }
    try {
      final msgs = await ChatService.unreadCount();
      int notifs = 0;
      final uid = AuthService.currentUserId;
      if (uid != null) {
        final data = await Supabase.instance.client
            .from('notifications')
            .select('id')
            .eq('user_id', uid)
            .eq('read', false);
        notifs = (data as List).length;
      }
      if (mounted) setState(() { _unreadMsgs = msgs; _unreadNotifs = notifs; });
    } catch (_) {/* badges are best-effort */}
  }

  // "Hot on PaMarket" sponsored ads (mirrors paidAds in home.js)
  Future<void> _loadSponsored() async {
    try {
      final nowIso = DateTime.now().toIso8601String();
      final data = await Supabase.instance.client
          .from('paid_ads')
          .select()
          .eq('active', true)
          .gt('ends_at', nowIso)
          .order('created_at', ascending: false)
          .limit(10);
      final ads = (data as List)
          .map((m) => _SponsoredAd.fromMap(m as Map<String, dynamic>))
          .toList();
      if (mounted) setState(() => _sponsored = ads);
    } catch (_) {/* table may not exist yet — show nothing */}
  }

  void _onScroll() {
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 200 &&
        !_loadingMore && _hasMore) {
      _loadMore();
    }
  }

  Future<void> _load({bool refresh = false}) async {
    if (refresh) {
      setState(() { _listings = []; _offset = 0; _hasMore = true; _loading = true; });
      _loadBadges();
      _loadSponsored();
    }
    try {
      final items = await ListingService.fetchListings(
        city: _selectedCity == 'All Zimbabwe' ? null : _selectedCity,
        limit: _pageSize, offset: 0,
      );
      if (mounted) {
        setState(() {
          _listings = items;
          _offset = items.length;
          _hasMore = items.length == _pageSize;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    try {
      final items = await ListingService.fetchListings(
        city: _selectedCity == 'All Zimbabwe' ? null : _selectedCity,
        limit: _pageSize, offset: _offset,
      );
      if (mounted) {
        setState(() {
          _listings.addAll(items);
          _offset += items.length;
          _hasMore = items.length == _pageSize;
          _loadingMore = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _showCityPicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _CityPickerSheet(
        cities: _cities,
        selectedCity: _selectedCity,
        onSelected: (city) {
          Navigator.pop(context);
          setState(() => _selectedCity = city);
          _saveCity(city);
          _load(refresh: true);
        },
      ),
    );
  }

  void _openMessages() {
    if (!AuthService.isSignedIn) {
      showAuthModal(context, 'Sign in to view messages');
      return;
    }
    context.push('/messages');
  }

  Map<String, List<Listing>> _groupByCategory() {
    final map = <String, List<Listing>>{};
    for (final listing in _listings) {
      map.putIfAbsent(listing.category, () => []).add(listing);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _loading ? <String, List<Listing>>{} : _groupByCategory();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        onRefresh: () => _load(refresh: true),
        color: AppColors.primaryBlue,
        child: CustomScrollView(
          controller: _scroll,
          slivers: [
            SliverAppBar(
              floating: true,
              snap: true,
              backgroundColor: AppColors.primaryBlue,
              expandedHeight: 124,
              flexibleSpace: FlexibleSpaceBar(
                background: _AppHeader(
                  selectedCity: _selectedCity,
                  unreadMsgs: _unreadMsgs,
                  unreadNotifs: _unreadNotifs,
                  onSearch: () => context.push('/search'),
                  onNotif: () => context.push('/notifications'),
                  onMessages: _openMessages,
                  onCityTap: _showCityPicker,
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: _CategoryGrid(categories: _categories),
            ),

            SliverToBoxAdapter(
              child: _PromoBanner(listingCount: _listings.length),
            ),

            if (_sponsored.isNotEmpty)
              SliverToBoxAdapter(
                child: _SponsoredRow(ads: _sponsored),
              ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: ElevatedButton.icon(
                  onPressed: () {
                    if (!AuthService.isSignedIn) {
                      showAuthModal(context, 'Log in to post an ad');
                    } else {
                      context.push('/post-listing');
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.orange,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                  icon: const Icon(Icons.add, size: 20),
                  label: const Text('Post a Free Ad'),
                ),
              ),
            ),

            if (_loading)
              const SliverToBoxAdapter(
                child: SizedBox(height: 300, child: Center(child: CircularProgressIndicator())),
              )
            else if (_listings.isEmpty)
              const SliverToBoxAdapter(child: _EmptyState())
            else ...[
              for (final cat in _categories)
                if (grouped.containsKey(cat.id)) ...[
                  SliverToBoxAdapter(
                    child: _CategorySectionHeader(
                      category: cat,
                      count: grouped[cat.id]!.length,
                      onSeeAll: () => context.push(
                        '/category/${cat.id}?name=${Uri.encodeComponent(cat.label)}',
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: _CategoryGridSection(listings: grouped[cat.id]!.take(4).toList()),
                  ),
                ],

              if (_loadingMore)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }
}

// ── App Header ────────────────────────────────────────────────────────────────

class _AppHeader extends StatelessWidget {
  final String selectedCity;
  final int unreadMsgs;
  final int unreadNotifs;
  final VoidCallback onSearch;
  final VoidCallback onNotif;
  final VoidCallback onMessages;
  final VoidCallback onCityTap;

  const _AppHeader({
    required this.selectedCity,
    required this.unreadMsgs,
    required this.unreadNotifs,
    required this.onSearch,
    required this.onNotif,
    required this.onMessages,
    required this.onCityTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.darkBlue, AppColors.primaryBlue],
        ),
      ),
      padding: EdgeInsets.fromLTRB(16, MediaQuery.of(context).padding.top + 10, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              RichText(
                text: const TextSpan(children: [
                  TextSpan(text: 'Pa', style: TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.5)),
                  TextSpan(text: 'Market', style: TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.orange, letterSpacing: -0.5)),
                ]),
              ),
              const Spacer(),
              // City chip
              GestureDetector(
                onTap: onCityTap,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.location_on_outlined, color: Colors.white70, size: 14),
                      const SizedBox(width: 4),
                      Text(selectedCity, style: const TextStyle(fontFamily: 'Inter', color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(width: 4),
                      const Icon(Icons.keyboard_arrow_down, color: Colors.white70, size: 16),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Notifications icon (circular w/ badge) — mirrors home.js
              _HeaderIconButton(
                icon: Icons.notifications_outlined,
                badge: unreadNotifs,
                onTap: onNotif,
              ),
              const SizedBox(width: 6),
              // Messages icon (circular w/ badge) — mirrors home.js
              _HeaderIconButton(
                icon: Icons.chat_bubble_outline,
                badge: unreadMsgs,
                onTap: onMessages,
              ),
            ],
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: onSearch,
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: const Row(
                children: [
                  Icon(Icons.search, color: AppColors.textMuted, size: 18),
                  SizedBox(width: 8),
                  Text('Search cars, houses, jobs...', style: TextStyle(fontFamily: 'Inter', color: AppColors.textMuted, fontSize: 14)),
                  Spacer(),
                  Icon(Icons.close, color: AppColors.textMuted, size: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Circular header icon button with an orange unread badge
class _HeaderIconButton extends StatelessWidget {
  final IconData icon;
  final int badge;
  final VoidCallback onTap;

  const _HeaderIconButton({required this.icon, required this.badge, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 40,
        height: 40,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: Colors.white, size: 20),
            ),
            if (badge > 0)
              Positioned(
                top: 2,
                right: 2,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: const BoxDecoration(
                    color: AppColors.orange,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      badge > 9 ? '9+' : '$badge',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: AppColors.primaryBlue,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Category Grid (4-column) ──────────────────────────────────────────────────

class _CategoryGrid extends StatelessWidget {
  final List<_Category> categories;

  const _CategoryGrid({required this.categories});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Browse Categories',
                style: TextStyle(fontFamily: 'Inter', fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              GestureDetector(
                onTap: () => context.push('/search'),
                child: const Text(
                  'See all',
                  style: TextStyle(fontFamily: 'Inter', fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.primaryBlue),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              childAspectRatio: 0.80,
              crossAxisSpacing: 8,
              mainAxisSpacing: 12,
            ),
            itemCount: categories.length,
            itemBuilder: (ctx, i) {
              final cat = categories[i];
              return GestureDetector(
                onTap: () => ctx.push('/category/${cat.id}?name=${Uri.encodeComponent(cat.label)}'),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: cat.color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: cat.color.withValues(alpha: 0.18), width: 1.5),
                        ),
                        child: Center(
                          child: Icon(cat.icon, size: 26, color: cat.color),
                        ),
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      cat.label,
                      style: const TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── Promo Banner ─────────────────────────────────────────────────────────────

class _PromoBanner extends StatelessWidget {
  final int listingCount;
  const _PromoBanner({required this.listingCount});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primaryBlue, AppColors.darkBlue],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('ZIMBABWE\'S FREE MARKETPLACE',
                    style: TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: FontWeight.w600, color: Colors.white60, letterSpacing: 0.8)),
                const SizedBox(height: 4),
                const Text('Buy. Sell. Hire.',
                    style: TextStyle(fontFamily: 'Inter', fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
                const SizedBox(height: 2),
                const Text('Real people. Real deals.',
                    style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: Colors.white70)),
              ],
            ),
          ),
          if (listingCount > 0)
            Column(
              children: [
                Text(
                  '$listingCount',
                  style: const TextStyle(fontFamily: 'Inter', fontSize: 30, fontWeight: FontWeight.w800, color: AppColors.orange, height: 1),
                ),
                const SizedBox(height: 3),
                const Text('ACTIVE ADS',
                    style: TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white70)),
              ],
            ),
        ],
      ),
    );
  }
}

// ── Hot on PaMarket (sponsored ads) ───────────────────────────────────────────

class _SponsoredRow extends StatelessWidget {
  final List<_SponsoredAd> ads;
  const _SponsoredRow({required this.ads});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('SPONSORED',
                    style: TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primaryBlue, letterSpacing: 0.8)),
                SizedBox(height: 2),
                Text('Hot on PaMarket',
                    style: TextStyle(fontFamily: 'Inter', fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
              ],
            ),
          ),
          SizedBox(
            height: 192,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: ads.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, i) => _SponsoredCard(ad: ads[i]),
            ),
          ),
        ],
      ),
    );
  }
}

class _SponsoredCard extends StatelessWidget {
  final _SponsoredAd ad;
  const _SponsoredCard({required this.ad});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        // Link handling can be added (url_launcher) when a deep/external link exists.
      },
      child: Container(
        width: 170,
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(18),
          boxShadow: const [BoxShadow(color: Color(0x1F000000), blurRadius: 16, offset: Offset(0, 4))],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 128,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    color: ad.bgColor,
                    alignment: Alignment.center,
                    child: Text(
                      ad.initials,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 38,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -1,
                        color: Colors.white.withValues(alpha: 0.35),
                      ),
                    ),
                  ),
                  if (ad.imageUrl != null && ad.imageUrl!.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: ad.imageUrl!,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('AD',
                          style: TextStyle(fontFamily: 'Inter', fontSize: 8, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: 0.5)),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 13),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ad.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                  ),
                  if (ad.subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      ad.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontFamily: 'Inter', fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Category Section Header ───────────────────────────────────────────────────

class _CategorySectionHeader extends StatelessWidget {
  final _Category category;
  final int count;
  final VoidCallback onSeeAll;

  const _CategorySectionHeader({required this.category, required this.count, required this.onSeeAll});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: category.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(category.icon, color: category.color, size: 16),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Latest in ${category.label}',
              style: const TextStyle(fontFamily: 'Inter', fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
            ),
          ),
          GestureDetector(
            onTap: onSeeAll,
            child: Row(
              children: [
                Text('See all $count', style: const TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primaryBlue)),
                const Icon(Icons.arrow_forward_ios, size: 12, color: AppColors.primaryBlue),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Category Section — 2-column grid (Dubizzle style, mirrors home.js) ─────────

class _CategoryGridSection extends StatelessWidget {
  final List<Listing> listings;
  const _CategoryGridSection({required this.listings});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 0.72,
        ),
        itemCount: listings.length,
        itemBuilder: (_, i) => ListingCard(listing: listings[i]),
      ),
    );
  }
}

// ── Empty State ───────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 40),
      child: Column(
        children: [
          const Icon(Icons.inventory_2_outlined, size: 72, color: AppColors.border),
          const SizedBox(height: 16),
          const Text('No listings yet', style: TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text('Be the first to post in your city!',
              style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: AppColors.textSecondary), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

// ── City Picker ───────────────────────────────────────────────────────────────

class _CityPickerSheet extends StatelessWidget {
  final List<String> cities;
  final String selectedCity;
  final ValueChanged<String> onSelected;

  const _CityPickerSheet({required this.cities, required this.selectedCity, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 16),
        const Text('Select your city', style: TextStyle(fontFamily: 'Inter', fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        const SizedBox(height: 8),
        const Divider(color: AppColors.border),
        ...cities.map((city) => ListTile(
              title: Text(
                city,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 15,
                  fontWeight: city == selectedCity ? FontWeight.w700 : FontWeight.w400,
                  color: city == selectedCity ? AppColors.primaryBlue : AppColors.textPrimary,
                ),
              ),
              trailing: city == selectedCity ? const Icon(Icons.check, color: AppColors.primaryBlue) : null,
              onTap: () => onSelected(city),
            )),
        const SizedBox(height: 16),
      ],
    );
  }
}

// ── Category Model ────────────────────────────────────────────────────────────

class _Category {
  final String id;
  final String label;
  final IconData icon;
  final Color color;

  const _Category({required this.id, required this.label, required this.icon, required this.color});
}

// ── Sponsored Ad Model ────────────────────────────────────────────────────────

class _SponsoredAd {
  final String id;
  final String title;
  final String subtitle;
  final String? imageUrl;
  final String? linkUrl;
  final Color bgColor;

  const _SponsoredAd({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.imageUrl,
    required this.linkUrl,
    required this.bgColor,
  });

  String get initials {
    final source = title.trim().isNotEmpty ? title.trim() : 'AD';
    final parts = source.split(RegExp(r'\s+'));
    final letters = parts.take(2).map((w) => w.isNotEmpty ? w[0] : '').join();
    return letters.isEmpty ? 'AD' : letters.toUpperCase();
  }

  factory _SponsoredAd.fromMap(Map<String, dynamic> m) {
    final business = m['business_name'] as String?;
    final headline = m['headline'] as String?;
    final hex = (m['bg_color'] as String?) ?? '#1A3A8F';
    return _SponsoredAd(
      id: m['id'].toString(),
      title: (headline != null && headline.isNotEmpty)
          ? headline
          : (business ?? 'Sponsored'),
      subtitle: (m['tagline'] as String?) ?? '',
      imageUrl: m['image_url'] as String?,
      linkUrl: m['link_url'] as String?,
      bgColor: _parseHex(hex),
    );
  }

  static Color _parseHex(String hex) {
    var h = hex.replaceAll('#', '').trim();
    if (h.length == 6) h = 'FF$h';
    final value = int.tryParse(h, radix: 16) ?? 0xFF1A3A8F;
    return Color(value);
  }
}
