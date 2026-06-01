import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/listing.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';
import '../../widgets/category_bar.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _selectedCategory = 'all';
  List<Listing> _listings = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _offset = 0;
  static const int _pageSize = 30;

  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _load();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
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
        category: _selectedCategory == 'all' ? null : _selectedCategory,
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
        category: _selectedCategory == 'all' ? null : _selectedCategory,
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

  void _onCategoryChanged(String cat) {
    setState(() => _selectedCategory = cat);
    _load(refresh: true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: NestedScrollView(
        controller: _scroll,
        headerSliverBuilder: (_, __) => [
          SliverAppBar(
            floating: true,
            snap: true,
            backgroundColor: AppColors.primaryBlue,
            expandedHeight: 110,
            flexibleSpace: FlexibleSpaceBar(
              background: _AppHeader(
                onSearch: () => context.push('/search'),
                onNotif: () => context.push('/notifications'),
              ),
            ),
          ),
          SliverPersistentHeader(
            pinned: true,
            delegate: _CategoryBarDelegate(
              child: Container(
                color: AppColors.background,
                child: Column(
                  children: [
                    const SizedBox(height: 10),
                    CategoryBar(
                      selected: _selectedCategory,
                      onChanged: _onCategoryChanged,
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
          ),
        ],
        body: _loading
            ? const _LoadingGrid()
            : _listings.isEmpty
                ? _EmptyState(category: _selectedCategory)
                : RefreshIndicator(
                    onRefresh: () => _load(refresh: true),
                    color: AppColors.primaryBlue,
                    child: GridView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 0.72,
                      ),
                      itemCount: _listings.length + (_loadingMore ? 2 : 0),
                      itemBuilder: (_, i) {
                        if (i >= _listings.length) {
                          return const _SkeletonCard();
                        }
                        return ListingCard(listing: _listings[i]);
                      },
                    ),
                  ),
      ),
    );
  }
}

class _AppHeader extends StatelessWidget {
  final VoidCallback onSearch;
  final VoidCallback onNotif;

  const _AppHeader({required this.onSearch, required this.onNotif});

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
        MediaQuery.of(context).padding.top + 12,
        16,
        12,
      ),
      child: Row(
        children: [
          // Logo
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
          const SizedBox(width: 12),

          // Search bar
          Expanded(
            child: GestureDetector(
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
          ),

          const SizedBox(width: 8),

          // Notification icon
          IconButton(
            onPressed: onNotif,
            icon: const Icon(Icons.notifications_outlined,
                color: Colors.white, size: 24),
          ),
        ],
      ),
    );
  }
}

class _CategoryBarDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;

  _CategoryBarDelegate({required this.child});

  @override
  double get minExtent => 60;
  @override
  double get maxExtent => 60;

  @override
  Widget build(_, __, ___) => child;

  @override
  bool shouldRebuild(_) => false;
}

class _LoadingGrid extends StatelessWidget {
  const _LoadingGrid();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.72,
      ),
      itemCount: 8,
      itemBuilder: (_, __) => const _SkeletonCard(),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String category;

  const _EmptyState({required this.category});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.inventory_2_outlined,
                size: 72, color: AppColors.border),
            const SizedBox(height: 16),
            const Text(
              'No listings found',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 18,
                  fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              category == 'all'
                  ? 'Be the first to post!'
                  : 'No listings in this category yet.',
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
