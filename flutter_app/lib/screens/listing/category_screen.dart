import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/listing.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';

// ── Category metadata ─────────────────────────────────────────────────────────
// Maps category IDs to display colours — matches CAT_COLORS in home.js
const _kCatColors = {
  'vehicles': Color(0xFFe53935),
  'property': Color(0xFF1E88E5),
  'electronics': Color(0xFF8E24AA),
  'fashion': Color(0xFFF06292),
  'furniture': Color(0xFF6D4C41),
  'services': Color(0xFF00897B),
  'jobs': Color(0xFFF5A623),
  'rooms': Color(0xFF00838F),
  'other': Color(0xFF546E7A),
  'agriculture': Color(0xFF558B2F),
  'pets': Color(0xFFFB8C00),
  'kids': Color(0xFFE91E63),
};

const _kCatIcons = {
  'vehicles': '🚗',
  'property': '🏠',
  'electronics': '📱',
  'fashion': '👗',
  'furniture': '🛋️',
  'services': '🔧',
  'jobs': '💼',
  'agriculture': '🌱',
  'pets': '🐾',
  'kids': '🧸',
  'rooms': '🛏️',
  'other': '📦',
};

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

// Sort options — matches H._sortsel in categories.js
const _kSortValues = ['newest', 'oldest', 'price_asc', 'price_desc'];
const _kSortLabels = [
  'Newest First',
  'Oldest First',
  'Price: Low → High',
  'Price: High → Low',
];

const _kPageSize = 30;

class CategoryScreen extends StatefulWidget {
  final String categoryId;
  final String categoryName;

  const CategoryScreen({
    super.key,
    required this.categoryId,
    required this.categoryName,
  });

  @override
  State<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends State<CategoryScreen> {
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();

  // Results
  List<Listing> _results = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _totalCount = 0;

  // Filter panel visibility — mirrors _toggleFilters in categories.js
  bool _filtersOpen = false;

  // Common filters
  String _sort = 'newest';
  String? _city; // null = All Zimbabwe
  String? _condition; // null = all
  final _minPriceCtrl = TextEditingController();
  final _maxPriceCtrl = TextEditingController();

  // Vehicles-specific filters — mirrors vehicles.js filters
  String _vehicleSubcat = 'all'; // vehicle type
  String _fuelType = 'all';
  final _brandCtrl = TextEditingController();
  final _yearMinCtrl = TextEditingController();
  final _yearMaxCtrl = TextEditingController();

  // Property-specific filters — mirrors property.js filters
  String _propType = 'all';
  String _furnishing = 'all';
  String _beds = 'any';
  String _baths = 'any';
  String _propertyFor = 'both'; // 'sale' | 'rent' | 'both'

  // Search debounce
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
    _load(reset: true);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _scrollCtrl.dispose();
    _minPriceCtrl.dispose();
    _maxPriceCtrl.dispose();
    _brandCtrl.dispose();
    _yearMinCtrl.dispose();
    _yearMaxCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  // Inline search inside category — mirrors cs_ input in categories.js
  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _load(reset: true);
    });
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading && !reset) return;
    setState(() {
      _loading = reset;
      if (reset) {
        _results = [];
        _hasMore = true;
      }
    });

    try {
      final q = _searchCtrl.text.trim();
      final data = await ListingService.fetchListings(
        category: widget.categoryId,
        searchQuery: q.isNotEmpty ? q : null,
        city: _city,
        maxPrice: double.tryParse(_maxPriceCtrl.text),
        limit: _kPageSize,
        offset: 0,
      );

      if (!mounted) return;
      final filtered = _clientFilter(data);
      setState(() {
        _results = filtered;
        _hasMore = data.length == _kPageSize;
        _totalCount = filtered.length;
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
        category: widget.categoryId,
        searchQuery: q.isNotEmpty ? q : null,
        city: _city,
        maxPrice: double.tryParse(_maxPriceCtrl.text),
        limit: _kPageSize,
        offset: _results.length,
      );

      if (!mounted) return;
      final filtered = _clientFilter(data);
      setState(() {
        _results.addAll(filtered);
        _hasMore = data.length == _kPageSize;
        _totalCount = _results.length;
        _loadingMore = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  // Client-side filters that aren't covered by the API parameters
  // Mirrors H._applyFilters logic in categories.js
  List<Listing> _clientFilter(List<Listing> items) {
    List<Listing> list = List.from(items);

    // Price min (API handles max already)
    final minP = double.tryParse(_minPriceCtrl.text);
    if (minP != null) list = list.where((l) => l.price >= minP).toList();

    // Condition
    if (_condition != null && _condition != 'all') {
      list = list
          .where((l) =>
              (l.condition ?? '').toLowerCase() == _condition!.toLowerCase())
          .toList();
    }

    // Vehicles-specific
    if (widget.categoryId == 'vehicles') {
      if (_vehicleSubcat != 'all') {
        list = list.where((l) {
          final sub = (l.description + l.title).toLowerCase();
          return sub.contains(_vehicleSubcat);
        }).toList();
      }
      if (_brandCtrl.text.isNotEmpty) {
        final brand = _brandCtrl.text.toLowerCase();
        list = list
            .where((l) =>
                l.title.toLowerCase().contains(brand) ||
                l.description.toLowerCase().contains(brand))
            .toList();
      }
    }

    // Property-specific
    if (widget.categoryId == 'property') {
      if (_propertyFor == 'sale') {
        list = list.where((l) => !l.description.toLowerCase().contains('rent')).toList();
      } else if (_propertyFor == 'rent') {
        list = list.where((l) => l.description.toLowerCase().contains('rent')).toList();
      }
    }

    // Sort — mirrors H._applyFilters sort in categories.js
    switch (_sort) {
      case 'price_asc':
        list.sort((a, b) => a.price.compareTo(b.price));
      case 'price_desc':
        list.sort((a, b) => b.price.compareTo(a.price));
      case 'oldest':
        list.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      default: // 'newest' — server returns newest first
        list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    }

    return list;
  }

  void _applyFilters() {
    setState(() => _filtersOpen = false);
    _load(reset: true);
  }

  void _clearFilters() {
    _minPriceCtrl.clear();
    _maxPriceCtrl.clear();
    _brandCtrl.clear();
    _yearMinCtrl.clear();
    _yearMaxCtrl.clear();
    setState(() {
      _sort = 'newest';
      _city = null;
      _condition = null;
      _vehicleSubcat = 'all';
      _fuelType = 'all';
      _propType = 'all';
      _furnishing = 'all';
      _beds = 'any';
      _baths = 'any';
      _propertyFor = 'both';
      _filtersOpen = false;
    });
    _load(reset: true);
  }

  int get _activeFilterCount {
    int n = 0;
    if (_city != null) n++;
    if (_condition != null && _condition != 'all') n++;
    if (_minPriceCtrl.text.isNotEmpty) n++;
    if (_maxPriceCtrl.text.isNotEmpty) n++;
    if (_sort != 'newest') n++;
    if (widget.categoryId == 'vehicles') {
      if (_vehicleSubcat != 'all') n++;
      if (_fuelType != 'all') n++;
      if (_brandCtrl.text.isNotEmpty) n++;
      if (_yearMinCtrl.text.isNotEmpty) n++;
      if (_yearMaxCtrl.text.isNotEmpty) n++;
    }
    if (widget.categoryId == 'property') {
      if (_propType != 'all') n++;
      if (_furnishing != 'all') n++;
      if (_beds != 'any') n++;
      if (_baths != 'any') n++;
      if (_propertyFor != 'both') n++;
    }
    return n;
  }

  Color get _catColor =>
      _kCatColors[widget.categoryId] ?? AppColors.primaryBlue;

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _buildHeader(),
          if (_filtersOpen) _buildFilterPanel(),
          _buildResultsBar(),
          const Divider(height: 1, color: AppColors.border),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  // ── Category header — mirrors _catTopbar + _catHeader in categories.js ─────
  Widget _buildHeader() {
    return Container(
      color: _catColor,
      padding: EdgeInsets.fromLTRB(
        14,
        MediaQuery.of(context).padding.top + 6,
        14,
        12,
      ),
      child: Column(
        children: [
          // Top row: back + title + post ad button
          Row(
            children: [
              GestureDetector(
                onTap: () => context.pop(),
                child: const Icon(Icons.arrow_back_ios_new,
                    color: Colors.white, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Row(
                  children: [
                    Text(
                      _kCatIcons[widget.categoryId] ?? '',
                      style: const TextStyle(fontSize: 20),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        widget.categoryName,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              // + Post button — mirrors the "Post" button in _catTopbar
              GestureDetector(
                onTap: () => context.push('/post'),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    '+ Post',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Search bar + filter toggle — mirrors _catHeader in categories.js
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(left: 12),
                        child: Icon(Icons.search,
                            color: Colors.white70, size: 16),
                      ),
                      Expanded(
                        child: TextField(
                          controller: _searchCtrl,
                          onChanged: _onSearchChanged,
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            color: Colors.white,
                          ),
                          decoration: InputDecoration(
                            hintText: 'Search ${widget.categoryName}…',
                            hintStyle: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 14,
                              color: Colors.white.withValues(alpha: 0.65),
                            ),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 12),
                          ),
                          cursorColor: AppColors.orange,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Filter toggle with badge — mirrors fb_ badge in categories.js
              GestureDetector(
                onTap: () => setState(() => _filtersOpen = !_filtersOpen),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.tune, color: Colors.white, size: 14),
                      const SizedBox(width: 5),
                      const Text(
                        'Filter',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      if (_activeFilterCount > 0) ...[  
                        const SizedBox(width: 5),
                        Container(
                          constraints: const BoxConstraints(minWidth: 16),
                          height: 16,
                          padding:
                              const EdgeInsets.symmetric(horizontal: 4),
                          decoration: const BoxDecoration(
                            color: AppColors.orange,
                            borderRadius:
                                BorderRadius.all(Radius.circular(8)),
                          ),
                          child: Center(
                            child: Text(
                              '$_activeFilterCount',
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
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Filter panel — mirrors fp_ panel in categories.js ─────────────────────
  Widget _buildFilterPanel() {
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Price range — mirrors H._priceRange
          const _SectionLabel('Price Range (USD)'),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: _FilterInput(
                  controller: _minPriceCtrl,
                  hint: 'Min Price',
                  keyboardType: TextInputType.number,
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Text('–',
                    style: TextStyle(
                        color: AppColors.textMuted, fontFamily: 'Inter')),
              ),
              Expanded(
                child: _FilterInput(
                  controller: _maxPriceCtrl,
                  hint: 'Max Price',
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // City — mirrors H._citysel
          const _SectionLabel('Location'),
          const SizedBox(height: 6),
          _FilterDropdown<String?>(
            value: _city,
            hint: 'All Zimbabwe',
            items: [
              const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('All Zimbabwe',
                      style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
              ..._kZwCities.map((c) => DropdownMenuItem<String?>(
                    value: c,
                    child: Text(c,
                        style: const TextStyle(
                            fontFamily: 'Inter', fontSize: 13)),
                  )),
            ],
            onChanged: (v) => setState(() => _city = v),
          ),
          const SizedBox(height: 10),

          // Condition
          const _SectionLabel('Condition'),
          const SizedBox(height: 6),
          _FilterDropdown<String?>(
            value: _condition,
            hint: 'Any condition',
            items: [
              const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('Any condition',
                      style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
              const DropdownMenuItem<String?>(
                  value: 'new',
                  child: Text('Brand New',
                      style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
              const DropdownMenuItem<String?>(
                  value: 'used',
                  child: Text('Used',
                      style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
              const DropdownMenuItem<String?>(
                  value: 'like-new',
                  child: Text('Like New',
                      style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
              const DropdownMenuItem<String?>(
                  value: 'refurbished',
                  child: Text('Refurbished',
                      style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
            ],
            onChanged: (v) => setState(() => _condition = v),
          ),
          const SizedBox(height: 10),

          // Sort — mirrors H._sortsel
          const _SectionLabel('Sort By'),
          const SizedBox(height: 6),
          _FilterDropdown<String>(
            value: _sort,
            hint: 'Newest First',
            items: List.generate(
              _kSortValues.length,
              (i) => DropdownMenuItem<String>(
                value: _kSortValues[i],
                child: Text(_kSortLabels[i],
                    style:
                        const TextStyle(fontFamily: 'Inter', fontSize: 13)),
              ),
            ),
            onChanged: (v) {
              if (v != null) setState(() => _sort = v);
            },
          ),
          const SizedBox(height: 10),

          // ── Vehicles-specific ──────────────────────────────────────────────
          if (widget.categoryId == 'vehicles') ...[  
            const _SectionLabel('Vehicle Type'),
            const SizedBox(height: 6),
            _FilterDropdown<String>(
              value: _vehicleSubcat,
              hint: 'All Types',
              items: const [
                DropdownMenuItem(
                    value: 'all',
                    child: Text('All Types',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'car',
                    child: Text('Car',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'suv',
                    child: Text('SUV / 4x4',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'truck',
                    child: Text('Truck / Pickup',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'van',
                    child: Text('Van / Minibus',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'motorcycle',
                    child: Text('Motorcycle',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'bus',
                    child: Text('Bus',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'tractor',
                    child: Text('Tractor',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'boat',
                    child: Text('Boat',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
              ],
              onChanged: (v) {
                if (v != null) setState(() => _vehicleSubcat = v);
              },
            ),
            const SizedBox(height: 10),
            const _SectionLabel('Fuel Type'),
            const SizedBox(height: 6),
            _FilterDropdown<String>(
              value: _fuelType,
              hint: 'All Fuels',
              items: const [
                DropdownMenuItem(
                    value: 'all',
                    child: Text('All',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'petrol',
                    child: Text('Petrol',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'diesel',
                    child: Text('Diesel',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'electric',
                    child: Text('Electric',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'hybrid',
                    child: Text('Hybrid',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'lpg',
                    child: Text('LPG',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
              ],
              onChanged: (v) {
                if (v != null) setState(() => _fuelType = v);
              },
            ),
            const SizedBox(height: 10),
            const _SectionLabel('Make / Brand'),
            const SizedBox(height: 6),
            _FilterInput(
              controller: _brandCtrl,
              hint: 'e.g. Toyota, Honda, BMW',
              keyboardType: TextInputType.text,
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _SectionLabel('Year From'),
                      const SizedBox(height: 6),
                      _FilterInput(
                        controller: _yearMinCtrl,
                        hint: 'e.g. 2015',
                        keyboardType: TextInputType.number,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _SectionLabel('Year To'),
                      const SizedBox(height: 6),
                      _FilterInput(
                        controller: _yearMaxCtrl,
                        hint: 'e.g. 2024',
                        keyboardType: TextInputType.number,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
          ],

          // ── Property-specific ──────────────────────────────────────────────
          if (widget.categoryId == 'property') ...[  
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _SectionLabel('Property Type'),
                      const SizedBox(height: 6),
                      _FilterDropdown<String>(
                        value: _propType,
                        hint: 'All Types',
                        items: const [
                          DropdownMenuItem(
                              value: 'all',
                              child: Text('All Types',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: 'residential',
                              child: Text('Residential',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: 'commercial',
                              child: Text('Commercial',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: 'land',
                              child: Text('Land / Stand',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: 'units',
                              child: Text('Units / Flats',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                        ],
                        onChanged: (v) {
                          if (v != null) setState(() => _propType = v);
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _SectionLabel('Listing For'),
                      const SizedBox(height: 6),
                      _FilterDropdown<String>(
                        value: _propertyFor,
                        hint: 'Both',
                        items: const [
                          DropdownMenuItem(
                              value: 'both',
                              child: Text('For Sale & Rent',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: 'sale',
                              child: Text('For Sale',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: 'rent',
                              child: Text('For Rent',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                        ],
                        onChanged: (v) {
                          if (v != null) setState(() => _propertyFor = v);
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _SectionLabel('Bedrooms'),
                      const SizedBox(height: 6),
                      _FilterDropdown<String>(
                        value: _beds,
                        hint: 'Any',
                        items: const [
                          DropdownMenuItem(
                              value: 'any',
                              child: Text('Any',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: '1',
                              child: Text('1+',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: '2',
                              child: Text('2+',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: '3',
                              child: Text('3+',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: '4',
                              child: Text('4+',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: '5',
                              child: Text('5+',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                        ],
                        onChanged: (v) {
                          if (v != null) setState(() => _beds = v);
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _SectionLabel('Bathrooms'),
                      const SizedBox(height: 6),
                      _FilterDropdown<String>(
                        value: _baths,
                        hint: 'Any',
                        items: const [
                          DropdownMenuItem(
                              value: 'any',
                              child: Text('Any',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: '1',
                              child: Text('1+',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: '2',
                              child: Text('2+',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                          DropdownMenuItem(
                              value: '3',
                              child: Text('3+',
                                  style: TextStyle(
                                      fontFamily: 'Inter', fontSize: 13))),
                        ],
                        onChanged: (v) {
                          if (v != null) setState(() => _baths = v);
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            const _SectionLabel('Furnishing'),
            const SizedBox(height: 6),
            _FilterDropdown<String>(
              value: _furnishing,
              hint: 'All',
              items: const [
                DropdownMenuItem(
                    value: 'all',
                    child: Text('All',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'furnished',
                    child: Text('Furnished',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'unfurnished',
                    child: Text('Unfurnished',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
                DropdownMenuItem(
                    value: 'semi-furnished',
                    child: Text('Semi-Furnished',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 13))),
              ],
              onChanged: (v) {
                if (v != null) setState(() => _furnishing = v);
              },
            ),
            const SizedBox(height: 10),
          ],

          // Action buttons — mirrors Apply/Clear in categories.js
          Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _clearFilters,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text(
                      'Clear',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _applyFilters,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _catColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      elevation: 0,
                    ),
                    child: const Text(
                      'Apply Filters',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Results count — mirrors cc_ span in categories.js
  Widget _buildResultsBar() {
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Text(
            _loading
                ? '…'
                : '$_totalCount listing${_totalCount != 1 ? 's' : ''}',
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const Spacer(),
          if (_activeFilterCount > 0)
            GestureDetector(
              onTap: _clearFilters,
              child: const Text(
                'Clear filters',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primaryBlue,
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ── Body ─────────────────────────────────────────────────────────────────
  Widget _buildBody() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: AppColors.primaryBlue));
    }
    if (_results.isEmpty) return _buildEmptyState();
    return _buildGrid();
  }

  // 2-column grid with infinite scroll — mirrors listing-list in categories.js
  Widget _buildGrid() {
    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      color: _catColor,
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
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child:
                    CircularProgressIndicator(color: _catColor),
              ),
            );
          }
          return ListingCard(listing: _results[i]);
        },
      ),
    );
  }

  // Empty state — mirrors emptyState() in categories.js
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
                color: _catColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Center(
                child: Text(
                  _kCatIcons[widget.categoryId] ?? '📦',
                  style: const TextStyle(fontSize: 36),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'No listings match',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Try adjusting your filters or check back later',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.push('/post'),
              style: ElevatedButton.styleFrom(
                backgroundColor: _catColor,
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: const Text(
                'Post an Ad',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Shared filter sub-widgets ─────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
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

class _FilterInput extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final TextInputType keyboardType;

  const _FilterInput({
    required this.controller,
    required this.hint,
    required this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
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

class _FilterDropdown<T> extends StatelessWidget {
  final T value;
  final String hint;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  const _FilterDropdown({
    required this.value,
    required this.hint,
    required this.items,
    required this.onChanged,
  });

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
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          isDense: true,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            color: AppColors.textPrimary,
          ),
          hint: Text(
            hint,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: AppColors.textMuted,
            ),
          ),
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }
}
