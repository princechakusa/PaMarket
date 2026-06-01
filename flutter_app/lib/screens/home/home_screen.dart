import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../models/listing.dart';
import '../../services/auth_service.dart';
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
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _offset = 0;
  static const int _pageSize = 60;

  final ScrollController _scroll = ScrollController();

  static const _cities = [
    'All Zimbabwe', 'Harare', 'Bulawayo', 'Mutare',
    'Gweru', 'Masvingo', 'Chinhoyi', 'Kwekwe', 'Kadoma',
  ];

  static const _categories = [
    _Category(id: 'property',    label: 'Property',    icon: Icons.home,               color: Color(0xFF2196F3)),
    _Category(id: 'vehicles',    label: 'Vehicles',    icon: Icons.local_shipping,     color: Color(0xFFE53935)),
    _Category(id: 'rooms',       label: 'Rooms',       icon: Icons.bed,                color: Color(0xFF009688)),
    _Category(id: 'electronics', label: 'Electronics', icon: Icons.computer,           color: Color(0xFF7B1FA2)),
    _Category(id: 'jobs',        label: 'Jobs',        icon: Icons.work,               color: Color(0xFFFF9800)),
    _Category(id: 'furniture',   label: 'Furniture',   icon: Icons.weekend,            color: Color(0xFFF57C00)),
    _Category(id: 'fashion',     label: 'Fashion',     icon: Icons.shopping_bag,       color: Color(0xFFD81B60)),
    _Category(id: 'services',    label: 'Services',    icon: Icons.settings,           color: Color(0xFF43A047)),
    _Category(id: 'agriculture', label: 'Agriculture', icon: Icons.grass,              color: Color(0xFF558B2F)),
    _Category(id: 'pets',        label: 'Pets',        icon: Icons.pets,               color: Color(0xFFBF360C)),
    _Category(id: 'kids',        label: 'Baby & Kids', icon: Icons.child_care,         color: Color(0xFFAD1457)),
    _Category(id: 'other',       label: 'Other',       icon: Icons.more_horiz,         color: Color(0xFF546E7A)),
  ];

  @override
  void initState() {
    super.initState();
    _loadCity();
    _load();
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

  void _onScroll() {
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 200 &&
        !_loadingMore && _hasMore) {
      _loadMore();
    }
  }

  Future<void> _load({bool refresh = false}) async {
    if (refresh) {
      setState(() { _listings = []; _offset = 0; _hasMore = true; _loading = true; });
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
              expandedHeight: 120,
              flexibleSpace: FlexibleSpaceBar(
                background: _AppHeader(
                  selectedCity: _selectedCity,
                  onSearch: () => context.push('/search'),
                  onNotif: () => context.push('/notifications'),
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
                    child: _HorizontalListings(listings: grouped[cat.id]!.take(4).toList()),
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
  final VoidCallback onSearch;
  final VoidCallback onNotif;
  final VoidCallback onCityTap;

  const _AppHeader({required this.selectedCity, required this.onSearch, required this.onNotif, required this.onCityTap});

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
              const SizedBox(width: 4),
              IconButton(
                onPressed: onNotif,
                padding: EdgeInsets.zero,
                icon: const Icon(Icons.notifications_outlined, color: Colors.white, size: 24),
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
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Center(
                          child: Icon(cat.icon, size: 26, color: cat.color),
                        ),
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      cat.label,
                      style: const TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
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
                if (listingCount > 0) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Text(
                        '$listingCount',
                        style: const TextStyle(fontFamily: 'Inter', fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.orange),
                      ),
                      const SizedBox(width: 8),
                      const Text('ACTIVE ADS',
                          style: TextStyle(fontFamily: 'Inter', fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.orange)),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
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

// ── Horizontal Listings ───────────────────────────────────────────────────────

class _HorizontalListings extends StatelessWidget {
  final List<Listing> listings;
  const _HorizontalListings({required this.listings});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 230,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: listings.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) => SizedBox(width: 160, child: ListingCard(listing: listings[i])),
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
        const Text('Select City', style: TextStyle(fontFamily: 'Inter', fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
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
