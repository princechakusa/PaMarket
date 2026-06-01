import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../models/listing.dart';
import '../../services/auth_service.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';

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
    'All Zimbabwe',
    'Harare',
    'Bulawayo',
    'Mutare',
    'Gweru',
    'Masvingo',
    'Chinhoyi',
    'Kwekwe',
    'Kadoma',
  ];

  static const _categories = [
    _Category(
      id: 'vehicles',
      label: 'Vehicles',
      icon: Icons.directions_car,
      color: Color(0xFF2196F3),
    ),
    _Category(
      id: 'property',
      label: 'Property',
      icon: Icons.home,
      color: Color(0xFF4CAF50),
    ),
    _Category(
      id: 'electronics',
      label: 'Electronics',
      icon: Icons.phone_android,
      color: Color(0xFF9C27B0),
    ),
    _Category(
      id: 'fashion',
      label: 'Fashion',
      icon: Icons.shopping_bag,
      color: Color(0xFFE91E63),
    ),
    _Category(
      id: 'furniture',
      label: 'Furniture',
      icon: Icons.weekend,
      color: Color(0xFFFF9800),
    ),
    _Category(
      id: 'services',
      label: 'Services',
      icon: Icons.build,
      color: Color(0xFF00BCD4),
    ),
    _Category(
      id: 'jobs',
      label: 'Jobs',
      icon: Icons.work,
      color: Color(0xFF3F51B5),
    ),
    _Category(
      id: 'agriculture',
      label: 'Agriculture',
      icon: Icons.grass,
      color: Color(0xFF689F38),
    ),
    _Category(
      id: 'pets',
      label: 'Pets',
      icon: Icons.pets,
      color: Color(0xFF795548),
    ),
    _Category(
      id: 'kids',
      label: 'Kids',
      icon: Icons.child_care,
      color: Color(0xFFFF5722),
    ),
    _Category(
      id: 'rooms',
      label: 'Rooms',
      icon: Icons.meeting_room,
      color: Color(0xFF607D8B),
    ),
    _Category(
      id: 'other',
      label: 'Other',
      icon: Icons.category,
      color: Color(0xFF9E9E9E),
    ),
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
    if (_scroll.position.pixels >=
            _scroll.position.maxScrollExtent - 200 &&
        !_loadingMore &&
        _hasMore) {
      _loadMore();
    }
  }

  Future<void> _load({bool refresh = false}) async {
    if (refresh) {
      setState(() {
        _listings = [];
        _offset = 0;
        _hasMore = true;
        _loading = true;
      });
    }
    try {
      final items = await ListingService.fetchListings(
        city: _selectedCity == 'All Zimbabwe' ? null : _selectedCity,
        limit: _pageSize,
        offset: 0,
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
        limit: _pageSize,
        offset: _offset,
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
            // App bar / header
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

            // Promo banner
            SliverToBoxAdapter(
              child: _PromoBanner(listingCount: _listings.length),
            ),

            // Category grid
            const SliverToBoxAdapter(
              child: _CategorySection(categories: _categories),
            ),

            // Post a Free Ad button
            SliverToBoxAdapter(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: ElevatedButton.icon(
                  onPressed: () {
                    if (!AuthService.isSignedIn) {
                      _showLoginRequired(context, 'Log in to post an ad');
                    } else {
                      context.push('/post-listing');
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.orange,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 48),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                    textStyle: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  icon: const Icon(Icons.add, size: 20),
                  label: const Text('Post a Free Ad'),
                ),
              ),
            ),

            // Loading state
            if (_loading)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 300,
                  child: const Center(child: CircularProgressIndicator()),
                ),
              )
            else if (_listings.isEmpty)
              const SliverToBoxAdapter(child: _EmptyState())
            else ...
            [
              for (final cat in _categories)
                if (grouped.containsKey(cat.id)) ...
                [
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
                    child: _HorizontalListings(
                      listings: grouped[cat.id]!.take(4).toList(),
                    ),
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

  void _showLoginRequired(BuildContext context, String message) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_outline,
                size: 48, color: AppColors.primaryBlue),
            const SizedBox(height: 14),
            Text(
              message,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                context.push('/login');
              },
              child: const Text('Sign In'),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: () {
                Navigator.pop(context);
                context.push('/signup');
              },
              child: const Text('Create Account'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _AppHeader extends StatelessWidget {
  final String selectedCity;
  final VoidCallback onSearch;
  final VoidCallback onNotif;
  final VoidCallback onCityTap;

  const _AppHeader({
    required this.selectedCity,
    required this.onSearch,
    required this.onNotif,
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
      padding: EdgeInsets.fromLTRB(
        16,
        MediaQuery.of(context).padding.top + 10,
        16,
        12,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              RichText(
                text: const TextSpan(children: [
                  TextSpan(
                    text: 'Pa',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.5,
                    ),
                  ),
                  TextSpan(
                    text: 'Market',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.orange,
                      letterSpacing: -0.5,
                    ),
                  ),
                ]),
              ),
              const Spacer(),
              GestureDetector(
                onTap: onCityTap,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.location_on_outlined,
                          color: Colors.white70, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        selectedCity,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.keyboard_arrow_down,
                          color: Colors.white70, size: 16),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 4),
              IconButton(
                onPressed: onNotif,
                padding: EdgeInsets.zero,
                icon: const Icon(Icons.notifications_outlined,
                    color: Colors.white, size: 24),
              ),
            ],
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: onSearch,
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(20),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: const Row(
                children: [
                  Icon(Icons.search, color: Colors.white70, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Search listings...',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      color: Colors.white60,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

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
                const Text(
                  "Zimbabwe's Free Marketplace",
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Buy. Sell. Hire.',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    color: Colors.white70,
                  ),
                ),
                if (listingCount > 0) ...
                [
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.orange.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: AppColors.orange.withValues(alpha: 0.5)),
                    ),
                    child: Text(
                      '$listingCount active listings',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.orange,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const Icon(
            Icons.storefront_outlined,
            color: Colors.white24,
            size: 64,
          ),
        ],
      ),
    );
  }
}

class _CategorySection extends StatelessWidget {
  final List<_Category> categories;

  const _CategorySection({required this.categories});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 20, 16, 10),
          child: Text(
            'Browse by Category',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        SizedBox(
          height: 96,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: categories.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (ctx, i) {
              final cat = categories[i];
              return GestureDetector(
                onTap: () => ctx.push(
                  '/category/${cat.id}?name=${Uri.encodeComponent(cat.label)}',
                ),
                child: Container(
                  width: 72,
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: cat.color,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(cat.icon,
                            size: 22, color: Colors.white),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        cat.label,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _CategorySectionHeader extends StatelessWidget {
  final _Category category;
  final int count;
  final VoidCallback onSeeAll;

  const _CategorySectionHeader({
    required this.category,
    required this.count,
    required this.onSeeAll,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: category.color,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(category.icon, color: Colors.white, size: 16),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              category.label,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          GestureDetector(
            onTap: onSeeAll,
            child: Row(
              children: [
                Text(
                  'See all $count',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primaryBlue,
                  ),
                ),
                const Icon(Icons.arrow_forward_ios,
                    size: 12, color: AppColors.primaryBlue),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

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
        itemBuilder: (_, i) => SizedBox(
          width: 160,
          child: ListingCard(listing: listings[i]),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 40),
      child: Column(
        children: [
          const Icon(Icons.inventory_2_outlined,
              size: 72, color: AppColors.border),
          const SizedBox(height: 16),
          const Text(
            'No listings yet',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Be the first to post in your city!',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _CityPickerSheet extends StatelessWidget {
  final List<String> cities;
  final String selectedCity;
  final ValueChanged<String> onSelected;

  const _CityPickerSheet({
    required this.cities,
    required this.selectedCity,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 16),
        const Text(
          'Select City',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        const Divider(color: AppColors.border),
        ...cities.map((city) => ListTile(
              title: Text(
                city,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 15,
                  fontWeight: city == selectedCity
                      ? FontWeight.w700
                      : FontWeight.w400,
                  color: city == selectedCity
                      ? AppColors.primaryBlue
                      : AppColors.textPrimary,
                ),
              ),
              trailing: city == selectedCity
                  ? const Icon(Icons.check, color: AppColors.primaryBlue)
                  : null,
              onTap: () => onSelected(city),
            )),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _Category {
  final String id;
  final String label;
  final IconData icon;
  final Color color;

  const _Category({
    required this.id,
    required this.label,
    required this.icon,
    required this.color,
  });
}
