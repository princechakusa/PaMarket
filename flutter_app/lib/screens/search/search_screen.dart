import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/listing.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';

// Zimbabwe cities — mirrors H._ZW_CITIES in categories.js
const _kZwCities = [
  'Harare',
  'Bulawayo',
  'Mutare',
  'Gweru',
  'Kwekwe',
  'Kadoma',
  'Masvingo',
  'Chinhoyi',
  'Bindura',
  'Marondera',
  'Hwange',
  'Victoria Falls',
  'Zvishavane',
];

const _kCategories = [
  {'id': 'vehicles', 'name': 'Vehicles', 'icon': '🚗'},
  {'id': 'property', 'name': 'Property', 'icon': '🏠'},
  {'id': 'electronics', 'name': 'Electronics', 'icon': '📱'},
  {'id': 'fashion', 'name': 'Fashion', 'icon': '👗'},
  {'id': 'furniture', 'name': 'Furniture', 'icon': '🛋️'},
  {'id': 'services', 'name': 'Services', 'icon': '🔧'},
  {'id': 'jobs', 'name': 'Jobs', 'icon': '💼'},
  {'id': 'agriculture', 'name': 'Agriculture', 'icon': '🌱'},
  {'id': 'pets', 'name': 'Pets', 'icon': '🐾'},
  {'id': 'kids', 'name': 'Kids', 'icon': '🧸'},
  {'id': 'rooms', 'name': 'Rooms', 'icon': '🛏️'},
  {'id': 'other', 'name': 'Other', 'icon': '📦'},
];

const _kConditions = ['all', 'new', 'like-new', 'used', 'refurbished'];
const _kConditionLabels = ['Any', 'New', 'Like New', 'Used', 'Refurbished'];

const _kSortOptions = ['recent', 'price-low', 'price-high', 'trending'];
const _kSortLabels = ['Latest', 'Price: Low → High', 'Price: High → Low', 'Trending'];

const _kPageSize = 30;

// ── Popular search hints (shown before first search) ─────────────────────────
const _kHints = [
  'iPhone',
  'Toyota',
  'Apartment Harare',
  'Software Developer',
  'Land Rover',
  'Maize seeds',
  'Generator',
  'Plumber',
];

class SearchScreen extends StatefulWidget {
  final String? initialQuery;
  final String? initialCategory;

  const SearchScreen({super.key, this.initialQuery, this.initialCategory});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _focusNode = FocusNode();

  // Filter state — matches browseState in browse.js
  String _sortBy = 'recent';
  String? _selectedCategory;
  String _condition = 'all';
  String? _selectedCity;
  double? _priceMin;
  double? _priceMax;

  // Results
  List<Listing> _results = [];
  bool _loading = false;
  bool _loadingMore = false;
  bool _hasMore = true;
  bool _searched = false;
  int _totalCount = 0;

  // Debounce
  Timer? _debounce;

  // Filter panel visibility — matches toggleFilters() in browse.js
  bool _filtersOpen = false;

  // Price controllers for filter panel
  final _minPriceCtrl = TextEditingController();
  final _maxPriceCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.initialQuery != null) {
      _searchCtrl.text = widget.initialQuery!;
    }
    if (widget.initialCategory != null) {
      _selectedCategory = widget.initialCategory;
    }
    _scrollCtrl.addListener(_onScroll);

    // Auto-trigger search if there's an initial query or category
    if (_searchCtrl.text.isNotEmpty || _selectedCategory != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _doSearch(reset: true));
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _scrollCtrl.dispose();
    _focusNode.dispose();
    _minPriceCtrl.dispose();
    _maxPriceCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  // Debounced search — 300ms delay, same as browse.js and home.js
  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _doSearch(reset: true);
    });
  }

  Future<void> _doSearch({bool reset = false}) async {
    if (_loading) return;
    final q = _searchCtrl.text.trim();

    if (reset) {
      setState(() {
        _loading = true;
        _searched = true;
        _hasMore = true;
        if (reset) _results = [];
      });
    }

    try {
      final data = await ListingService.fetchListings(
        searchQuery: q.isNotEmpty ? q : null,
        category: _selectedCategory,
        city: (_selectedCity != null) ? _selectedCity : null,
        maxPrice: _priceMax,
        limit: _kPageSize,
        offset: 0,
      );

      if (!mounted) return;
      setState(() {
        _results = _sortResults(data);
        _hasMore = data.length == _kPageSize;
        _totalCount = _results.length;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore || _loading) return;
    setState(() => _loadingMore = true);

    try {
      final q = _searchCtrl.text.trim();
      final data = await ListingService.fetchListings(
        searchQuery: q.isNotEmpty ? q : null,
        category: _selectedCategory,
        city: (_selectedCity != null) ? _selectedCity : null,
        maxPrice: _priceMax,
        limit: _kPageSize,
        offset: _results.length,
      );

      if (!mounted) return;
      final sorted = _sortResults(data);
      setState(() {
        _results.addAll(sorted);
        _hasMore = data.length == _kPageSize;
        _totalCount = _results.length;
        _loadingMore = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  List<Listing> _sortResults(List<Listing> items) {
    final list = List<Listing>.from(items);
    switch (_sortBy) {
      case 'price-low':
        list.sort((a, b) => a.price.compareTo(b.price));
      case 'price-high':
        list.sort((a, b) => b.price.compareTo(a.price));
      default:
        // 'recent' / 'trending' — server already returns newest first
        break;
    }

    // Condition filter (client-side since API may not support it)
    if (_condition != 'all') {
      return list.where((l) =>
        (l.condition ?? '').toLowerCase() == _condition.toLowerCase()).toList();
    }
    return list;
  }

  void _applyFilters() {
    _priceMin = double.tryParse(_minPriceCtrl.text);
    _priceMax = double.tryParse(_maxPriceCtrl.text);
    setState(() => _filtersOpen = false);
    _doSearch(reset: true);
  }

  void _resetFilters() {
    _minPriceCtrl.clear();
    _maxPriceCtrl.clear();
    setState(() {
      _sortBy = 'recent';
      _selectedCategory = null;
      _condition = 'all';
      _selectedCity = null;
      _priceMin = null;
      _priceMax = null;
      _filtersOpen = false;
    });
    _doSearch(reset: true);
  }

  int get _activeFilterCount {
    int n = 0;
    if (_selectedCategory != null) n++;
    if (_condition != 'all') n++;
    if (_selectedCity != null) n++;
    if (_priceMin != null) n++;
    if (_priceMax != null) n++;
    if (_sortBy != 'recent') n++;
    return n;
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _buildHeader(),
          if (_filtersOpen) _buildFilterPanel(),
          if (_searched) _buildResultsBar(),
          const Divider(height: 1, color: AppColors.border),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  // ── Header — matches browse.js app-header ─────────────────────────────────
  Widget _buildHeader() {
    return Container(
      color: AppColors.primaryBlue,
      padding: EdgeInsets.fromLTRB(
        16,
        MediaQuery.of(context).padding.top + 10,
        16,
        12,
      ),
      child: Column(
        children: [
          // Top row: back button + title + filter toggle
          Row(
            children: [
              GestureDetector(
                onTap: () => context.pop(),
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.arrow_back,
                      color: Colors.white, size: 20),
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Browse All',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const Spacer(),
              // Sort dropdown chip
              _SortChip(
                value: _sortBy,
                onChanged: (v) {
                  setState(() => _sortBy = v);
                  // re-sort in-memory, or re-fetch if needed
                  if (_results.isNotEmpty) {
                    setState(() => _results = _sortResults(_results));
                  }
                },
              ),
              const SizedBox(width: 8),
              // Filter toggle with badge — matches toggleFilters() in browse.js
              _FilterToggleButton(
                isOpen: _filtersOpen,
                badgeCount: _activeFilterCount,
                onTap: () => setState(() => _filtersOpen = !_filtersOpen),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Search box — auto-focused, matches search-box in browse.js
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x29000000),
                  blurRadius: 20,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                const Padding(
                  padding: EdgeInsets.only(left: 14),
                  child: Icon(Icons.search, color: AppColors.textMuted, size: 20),
                ),
                Expanded(
                  child: TextField(
                    controller: _searchCtrl,
                    focusNode: _focusNode,
                    autofocus: true,
                    onChanged: _onSearchChanged,
                    onSubmitted: (_) => _doSearch(reset: true),
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      color: AppColors.textPrimary,
                    ),
                    decoration: const InputDecoration(
                      hintText: 'Search all listings…',
                      hintStyle: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        color: AppColors.textMuted,
                      ),
                      border: InputBorder.none,
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 10, vertical: 14),
                    ),
                  ),
                ),
                // Clear button — matches the X button in home.js search bar
                if (_searchCtrl.text.isNotEmpty)
                  GestureDetector(
                    onTap: () {
                      _searchCtrl.clear();
                      _doSearch(reset: true);
                    },
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 10),
                      child: Icon(Icons.close,
                          color: AppColors.textMuted, size: 18),
                    ),
                  )
                else
                  const SizedBox(width: 10),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Filter panel — matches browse-filters-wrap in browse.js ───────────────
  Widget _buildFilterPanel() {
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Categories
            _FilterSectionTitle('Categories'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _kCategories.map((c) {
                final isSelected = _selectedCategory == c['id'];
                return _ChoiceChipItem(
                  label: '${c['icon']} ${c['name']}',
                  selected: isSelected,
                  onTap: () {
                    setState(() {
                      _selectedCategory =
                          isSelected ? null : c['id'] as String;
                    });
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 14),

            // Price range
            _FilterSectionTitle('Price Range (USD)'),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _PriceInput(
                    controller: _minPriceCtrl,
                    hint: 'Min',
                    onChanged: (_) {},
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 10),
                  child: Text('to',
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: AppColors.textMuted)),
                ),
                Expanded(
                  child: _PriceInput(
                    controller: _maxPriceCtrl,
                    hint: 'Max',
                    onChanged: (_) {},
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Condition — matches condition radio buttons in browse.js
            _FilterSectionTitle('Condition'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: List.generate(_kConditions.length, (i) {
                final isSelected = _condition == _kConditions[i];
                return _ChoiceChipItem(
                  label: _kConditionLabels[i],
                  selected: isSelected,
                  onTap: () =>
                      setState(() => _condition = _kConditions[i]),
                );
              }),
            ),
            const SizedBox(height: 14),

            // City / Location
            _FilterSectionTitle('Location'),
            const SizedBox(height: 8),
            _CityDropdown(
              value: _selectedCity,
              onChanged: (v) => setState(() => _selectedCity = v),
            ),
            const SizedBox(height: 18),

            // Action buttons — matches apply/reset in browse.js
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _resetFilters,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text(
                      'Reset',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _applyFilters,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryBlue,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: const Text(
                      'Apply Filters',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Results count bar — matches "X listings" count in categories.js ────────
  Widget _buildResultsBar() {
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Text(
            _loading
                ? 'Searching…'
                : '$_totalCount result${_totalCount != 1 ? 's' : ''} found',
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const Spacer(),
          if (_activeFilterCount > 0)
            GestureDetector(
              onTap: _resetFilters,
              child: const Text(
                'Clear filters',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primaryBlue,
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  Widget _buildBody() {
    if (!_searched) return _buildHints();
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: AppColors.primaryBlue));
    }
    if (_results.isEmpty) return _buildEmptyState();
    return _buildGrid();
  }

  // Popular searches — shown before first search, matches recentSearches in browse.js
  Widget _buildHints() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Popular searches',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _kHints.map((h) {
              return GestureDetector(
                onTap: () {
                  _searchCtrl.text = h;
                  _doSearch(reset: true);
                },
                child: Chip(
                  label: Text(h),
                  labelStyle: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    color: AppColors.textPrimary,
                  ),
                  backgroundColor: AppColors.card,
                  side: const BorderSide(color: AppColors.border),
                  avatar: const Icon(Icons.search,
                      size: 14, color: AppColors.textMuted),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),

          // Browse categories section
          const Text(
            'Browse Categories',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 0.85,
            ),
            itemCount: _kCategories.length,
            itemBuilder: (_, i) {
              final c = _kCategories[i];
              return GestureDetector(
                onTap: () {
                  setState(() => _selectedCategory = c['id'] as String);
                  _doSearch(reset: true);
                },
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: AppColors.lightBlue,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                            color: AppColors.primaryBlue.withValues(alpha: 0.15)),
                      ),
                      child: Center(
                        child: Text(
                          c['icon'] as String,
                          style: const TextStyle(fontSize: 24),
                        ),
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      c['name'] as String,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 1,
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

  // 2-column grid with infinite scroll — matches listing-list in browse.js
  Widget _buildGrid() {
    return RefreshIndicator(
      onRefresh: () => _doSearch(reset: true),
      color: AppColors.primaryBlue,
      child: GridView.builder(
        controller: _scrollCtrl,
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.72,
        ),
        itemCount: _results.length + (_loadingMore ? 1 : 0),
        itemBuilder: (_, i) {
          if (i == _results.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(color: AppColors.primaryBlue),
              ),
            );
          }
          return ListingCard(listing: _results[i]);
        },
      ),
    );
  }

  // Empty state — matches emptyState() in browse.js
  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.lightBlue,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.search_off,
                  size: 42, color: AppColors.primaryBlue),
            ),
            const SizedBox(height: 20),
            const Text(
              'No matches',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Try a different search term or adjust your filters',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: _resetFilters,
              style: OutlinedButton.styleFrom(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                side: const BorderSide(color: AppColors.primaryBlue),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text(
                'Clear filters',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primaryBlue,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Reusable sub-widgets ─────────────────────────────────────────────────────

class _FilterToggleButton extends StatelessWidget {
  final bool isOpen;
  final int badgeCount;
  final VoidCallback onTap;

  const _FilterToggleButton({
    required this.isOpen,
    required this.badgeCount,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            const Icon(Icons.tune, color: Colors.white, size: 16),
            const SizedBox(width: 5),
            const Text(
              'Filters',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
            if (badgeCount > 0) ...[  
              const SizedBox(width: 5),
              Container(
                width: 18,
                height: 18,
                decoration: const BoxDecoration(
                  color: AppColors.orange,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '$badgeCount',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primaryBlue,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SortChip extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;

  const _SortChip({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final idx = _kSortOptions.indexOf(value);
    final label = idx >= 0 ? _kSortLabels[idx] : 'Latest';

    return GestureDetector(
      onTap: () {
        showModalBottomSheet<String>(
          context: context,
          shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
          builder: (_) => _SortSheet(
              currentValue: value, onSelect: (v) => onChanged(v)),
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Text(
              label.length > 10 ? '${label.substring(0, 9)}…' : label,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.expand_more, color: Colors.white70, size: 16),
          ],
        ),
      ),
    );
  }
}

class _SortSheet extends StatelessWidget {
  final String currentValue;
  final ValueChanged<String> onSelect;

  const _SortSheet({required this.currentValue, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Sort By',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          ...List.generate(_kSortOptions.length, (i) {
            final isSelected = currentValue == _kSortOptions[i];
            return ListTile(
              title: Text(
                _kSortLabels[i],
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight:
                      isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected
                      ? AppColors.primaryBlue
                      : AppColors.textPrimary,
                ),
              ),
              trailing: isSelected
                  ? const Icon(Icons.check, color: AppColors.primaryBlue)
                  : null,
              onTap: () {
                onSelect(_kSortOptions[i]);
                Navigator.pop(context);
              },
            );
          }),
        ],
      ),
    );
  }
}

class _FilterSectionTitle extends StatelessWidget {
  final String text;
  const _FilterSectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.textSecondary,
        letterSpacing: 0.5,
      ),
    );
  }
}

class _ChoiceChipItem extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ChoiceChipItem({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppColors.primaryBlue : AppColors.background,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? AppColors.primaryBlue : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color:
                selected ? Colors.white : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}

class _PriceInput extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;

  const _PriceInput({
    required this.controller,
    required this.hint,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      onChanged: onChanged,
      style: const TextStyle(fontFamily: 'Inter', fontSize: 13),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(
            fontFamily: 'Inter', fontSize: 13, color: AppColors.textMuted),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: AppColors.primaryBlue),
        ),
        filled: true,
        fillColor: AppColors.background,
        isDense: true,
      ),
    );
  }
}

class _CityDropdown extends StatelessWidget {
  final String? value;
  final ValueChanged<String?> onChanged;

  const _CityDropdown({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String?>(
          value: value,
          hint: const Text(
            'All Zimbabwe',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: AppColors.textMuted,
            ),
          ),
          isExpanded: true,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            color: AppColors.textPrimary,
          ),
          items: [
            const DropdownMenuItem<String?>(
              value: null,
              child: Text('All Zimbabwe',
                  style: TextStyle(fontFamily: 'Inter', fontSize: 13)),
            ),
            ..._kZwCities.map(
              (c) => DropdownMenuItem<String?>(
                value: c,
                child: Text(c,
                    style:
                        const TextStyle(fontFamily: 'Inter', fontSize: 13)),
              ),
            ),
          ],
          onChanged: onChanged,
        ),
      ),
    );
  }
}
