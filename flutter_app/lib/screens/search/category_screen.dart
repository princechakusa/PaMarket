import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/listing.dart';
import '../../services/auth_service.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';
import '../../widgets/auth_modal.dart';

// ── Category metadata ─────────────────────────────────────────────────────────

const _kCatColors = {
  'vehicles': Color(0xFF1A3A8F),
  'property': Color(0xFF059669),
  'electronics': Color(0xFF7C3AED),
  'fashion': Color(0xFFDB2777),
  'furniture': Color(0xFFD97706),
  'services': Color(0xFF0891B2),
  'jobs': Color(0xFF16A34A),
  'agriculture': Color(0xFF65A30D),
  'pets': Color(0xFFF59E0B),
  'kids': Color(0xFFEA580C),
  'rooms': Color(0xFF1D4ED8),
  'other': Color(0xFF6B7280),
};

const _kCatLabels = {
  'vehicles': 'Vehicles',
  'property': 'Property',
  'electronics': 'Electronics',
  'fashion': 'Fashion',
  'furniture': 'Furniture',
  'services': 'Services',
  'jobs': 'Jobs',
  'agriculture': 'Agriculture',
  'pets': 'Pets',
  'kids': 'Baby & Kids',
  'rooms': 'Rooms',
  'other': 'Other',
};

IconData _catIcon(String cat) {
  switch (cat) {
    case 'vehicles':
      return Icons.local_shipping;
    case 'property':
      return Icons.home_outlined;
    case 'electronics':
      return Icons.devices;
    case 'fashion':
      return Icons.checkroom;
    case 'furniture':
      return Icons.chair;
    case 'services':
      return Icons.build;
    case 'jobs':
      return Icons.work;
    case 'agriculture':
      return Icons.agriculture;
    case 'pets':
      return Icons.pets;
    case 'kids':
      return Icons.child_care;
    case 'rooms':
      return Icons.bed;
    default:
      return Icons.category;
  }
}

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

// ── Category Screen ───────────────────────────────────────────────────────────

class CategoryScreen extends StatefulWidget {
  final String category;
  final String? initialQuery;

  const CategoryScreen({
    super.key,
    required this.category,
    this.initialQuery,
  });

  @override
  State<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends State<CategoryScreen> {
  // ── Controllers & state
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _debounce;

  bool _filtersVisible = false;
  bool _loading = false;
  bool _loadingMore = false;
  bool _hasMore = true;

  List<Listing> _listings = [];
  static const _pageSize = 20;

  // ── Filter state
  String _sort = 'newest';
  String? _city;
  String? _condition;
  double? _priceMin;
  double? _priceMax;

  // vehicles
  String? _vehicleType;
  String? _fuelType;
  String? _vehicleBrand;
  int? _yearFrom;
  int? _yearTo;

  // property
  String? _propType;
  String? _listingFor; // sale / rent
  String? _beds;
  String? _baths;
  String? _furnishing;

  // jobs
  String? _jobCategory;
  String? _jobType;
  double? _salaryMin;
  double? _salaryMax;

  // electronics
  String? _electronicsCat;
  String? _electronicsBrand;

  // fashion
  String? _fashionGender;
  String? _fashionType;
  String? _fashionSize;
  String? _fashionBrand;

  // agriculture
  String? _agricultureCat;

  // furniture
  String? _furnitureType;
  String? _furnitureMaterial;

  // pets
  String? _petType;
  String? _petBreed;

  // kids
  String? _kidsCat;
  String? _kidsFor;

  // rooms
  String? _roomType;
  String? _roomFurnishing;
  String? _roomRentalType;

  // services
  String? _serviceType;

  // other
  String? _otherCat;

  // text controllers for numeric fields
  final _priceMinCtrl = TextEditingController();
  final _priceMaxCtrl = TextEditingController();
  final _salaryMinCtrl = TextEditingController();
  final _salaryMaxCtrl = TextEditingController();
  final _yearFromCtrl = TextEditingController();
  final _yearToCtrl = TextEditingController();
  final _brandCtrl = TextEditingController();
  final _petBreedCtrl = TextEditingController();
  final _materialCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.initialQuery != null) {
      _searchController.text = widget.initialQuery!;
    }
    _scrollController.addListener(_onScroll);
    _fetchListings(reset: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    _priceMinCtrl.dispose();
    _priceMaxCtrl.dispose();
    _salaryMinCtrl.dispose();
    _salaryMaxCtrl.dispose();
    _yearFromCtrl.dispose();
    _yearToCtrl.dispose();
    _brandCtrl.dispose();
    _petBreedCtrl.dispose();
    _materialCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        !_loadingMore &&
        _hasMore) {
      _fetchListings(reset: false);
    }
  }

  void _onSearchChanged(String val) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _fetchListings(reset: true);
    });
  }

  Future<void> _fetchListings({required bool reset}) async {
    if (_loading || (_loadingMore && !reset)) return;
    if (reset) {
      setState(() {
        _loading = true;
        _listings = [];
        _hasMore = true;
      });
    } else {
      setState(() => _loadingMore = true);
    }

    try {
      final offset = reset ? 0 : _listings.length;
      final results = await ListingService.fetchListings(
        category: widget.category,
        searchQuery: _searchController.text.trim().isEmpty
            ? null
            : _searchController.text.trim(),
        city: _city,
        maxPrice: _priceMax,
        limit: _pageSize,
        offset: offset,
      );

      // Client-side filters not supported by service
      var filtered = results.where((l) {
        if (_priceMin != null && l.price < _priceMin!) return false;
        if (_condition != null &&
            _condition!.isNotEmpty &&
            _condition != 'all' &&
            (l.condition ?? '').toLowerCase() != _condition) return false;
        return true;
      }).toList();

      // Sort
      filtered.sort((a, b) {
        switch (_sort) {
          case 'price_asc':
            return a.price.compareTo(b.price);
          case 'price_desc':
            return b.price.compareTo(a.price);
          default:
            return b.createdAt.compareTo(a.createdAt);
        }
      });

      if (mounted) {
        setState(() {
          if (reset) {
            _listings = filtered;
          } else {
            _listings.addAll(filtered);
          }
          _hasMore = results.length == _pageSize;
          _loading = false;
          _loadingMore = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  int get _activeFilterCount {
    int count = 0;
    if (_sort != 'newest') count++;
    if (_city != null && _city!.isNotEmpty) count++;
    if (_condition != null && _condition!.isNotEmpty && _condition != 'all') count++;
    if (_priceMin != null) count++;
    if (_priceMax != null) count++;
    // category-specific
    if (_vehicleType != null && _vehicleType != 'all') count++;
    if (_fuelType != null && _fuelType != 'all') count++;
    if (_vehicleBrand != null && _vehicleBrand!.isNotEmpty) count++;
    if (_yearFrom != null) count++;
    if (_yearTo != null) count++;
    if (_propType != null && _propType != 'all') count++;
    if (_listingFor != null && _listingFor != 'all') count++;
    if (_beds != null && _beds != 'any') count++;
    if (_baths != null && _baths != 'any') count++;
    if (_furnishing != null && _furnishing != 'all') count++;
    if (_jobCategory != null && _jobCategory != 'all') count++;
    if (_jobType != null && _jobType != 'all') count++;
    if (_salaryMin != null) count++;
    if (_salaryMax != null) count++;
    if (_electronicsCat != null && _electronicsCat != 'all') count++;
    if (_electronicsBrand != null && _electronicsBrand!.isNotEmpty) count++;
    if (_fashionGender != null && _fashionGender != 'all') count++;
    if (_fashionType != null && _fashionType != 'all') count++;
    if (_fashionSize != null && _fashionSize != 'all') count++;
    if (_fashionBrand != null && _fashionBrand!.isNotEmpty) count++;
    if (_agricultureCat != null && _agricultureCat != 'all') count++;
    if (_furnitureType != null && _furnitureType != 'all') count++;
    if (_furnitureMaterial != null && _furnitureMaterial!.isNotEmpty) count++;
    if (_petType != null && _petType != 'all') count++;
    if (_petBreed != null && _petBreed!.isNotEmpty) count++;
    if (_kidsCat != null && _kidsCat != 'all') count++;
    if (_kidsFor != null && _kidsFor != 'all') count++;
    if (_roomType != null && _roomType != 'all') count++;
    if (_roomFurnishing != null && _roomFurnishing != 'all') count++;
    if (_roomRentalType != null && _roomRentalType != 'all') count++;
    if (_serviceType != null && _serviceType != 'all') count++;
    if (_otherCat != null && _otherCat != 'all') count++;
    return count;
  }

  void _clearFilters() {
    _priceMinCtrl.clear();
    _priceMaxCtrl.clear();
    _salaryMinCtrl.clear();
    _salaryMaxCtrl.clear();
    _yearFromCtrl.clear();
    _yearToCtrl.clear();
    _brandCtrl.clear();
    _petBreedCtrl.clear();
    _materialCtrl.clear();
    setState(() {
      _sort = 'newest';
      _city = null;
      _condition = null;
      _priceMin = null;
      _priceMax = null;
      _vehicleType = null;
      _fuelType = null;
      _vehicleBrand = null;
      _yearFrom = null;
      _yearTo = null;
      _propType = null;
      _listingFor = null;
      _beds = null;
      _baths = null;
      _furnishing = null;
      _jobCategory = null;
      _jobType = null;
      _salaryMin = null;
      _salaryMax = null;
      _electronicsCat = null;
      _electronicsBrand = null;
      _fashionGender = null;
      _fashionType = null;
      _fashionSize = null;
      _fashionBrand = null;
      _agricultureCat = null;
      _furnitureType = null;
      _furnitureMaterial = null;
      _petType = null;
      _petBreed = null;
      _kidsCat = null;
      _kidsFor = null;
      _roomType = null;
      _roomFurnishing = null;
      _roomRentalType = null;
      _serviceType = null;
      _otherCat = null;
    });
    _fetchListings(reset: true);
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final catColor =
        _kCatColors[widget.category] ?? AppColors.primaryBlue;
    final catLabel =
        _kCatLabels[widget.category] ?? _capitalize(widget.category);
    final catIcon = _catIcon(widget.category);
    final filterCount = _activeFilterCount;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          // ── Header
          _buildHeader(
            catColor: catColor,
            catLabel: catLabel,
            catIcon: catIcon,
            filterCount: filterCount,
          ),
          // ── Filter panel (collapsible)
          if (_filtersVisible)
            _buildFilterPanel(catColor: catColor, catLabel: catLabel),
          // ── Results
          Expanded(
            child: _buildResults(catColor: catColor, catLabel: catLabel),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader({
    required Color catColor,
    required String catLabel,
    required IconData catIcon,
    required int filterCount,
  }) {
    return Container(
      color: catColor,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // top bar: back + title + icon
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => context.pop(),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.arrow_back_ios_new,
                          color: Colors.white, size: 16),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Icon(catIcon, color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      catLabel,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  // post button
                  GestureDetector(
                    onTap: () {
                      if (!AuthService.isSignedIn) {
                        showAuthModal(context,
                            'Sign in to post an ad');
                        return;
                      }
                      context.push('/post');
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
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
            ),
            // search bar row
            Padding(
              padding:
                  const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.18),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const SizedBox(width: 12),
                          Icon(Icons.search,
                              color: Colors.white.withOpacity(0.7),
                              size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: _searchController,
                              onChanged: _onSearchChanged,
                              style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 14,
                                color: Colors.white,
                              ),
                              decoration: InputDecoration(
                                hintText:
                                    'Search $catLabel...',
                                hintStyle: TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 14,
                                  color:
                                      Colors.white.withOpacity(0.6),
                                ),
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding:
                                    const EdgeInsets.symmetric(
                                        vertical: 12),
                              ),
                              cursorColor: AppColors.orange,
                            ),
                          ),
                          if (_searchController.text.isNotEmpty)
                            GestureDetector(
                              onTap: () {
                                _searchController.clear();
                                _fetchListings(reset: true);
                              },
                              child: Padding(
                                padding:
                                    const EdgeInsets.only(right: 10),
                                child: Icon(Icons.close,
                                    color:
                                        Colors.white.withOpacity(0.7),
                                    size: 16),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // filter toggle
                  GestureDetector(
                    onTap: () =>
                        setState(() => _filtersVisible = !_filtersVisible),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.tune,
                              color: Colors.white, size: 16),
                          const SizedBox(width: 4),
                          const Text(
                            'Filter',
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                          if (filterCount > 0) ...
                            [
                              const SizedBox(width: 5),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 5, vertical: 1),
                                decoration: BoxDecoration(
                                  color: AppColors.orange,
                                  borderRadius:
                                      BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '$filterCount',
                                  style: const TextStyle(
                                    fontFamily: 'Inter',
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF1A3A8F),
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
            ),
            // results count
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  _loading
                      ? '...'
                      : '${_listings.length} listing${_listings.length != 1 ? "s" : ""}'.toString(),
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.white.withOpacity(0.75),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Filter Panel ────────────────────────────────────────────────────────────

  Widget _buildFilterPanel({
    required Color catColor,
    required String catLabel,
  }) {
    return Container(
      color: AppColors.card,
      child: Column(
        children: [
          SingleChildScrollView(
            padding:
                const EdgeInsets.fromLTRB(14, 14, 14, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Universal filters
                _buildDropdown(
                  label: 'Sort By',
                  value: _sort,
                  items: const [
                    ('newest', 'Newest First'),
                    ('price_asc', 'Price: Low to High'),
                    ('price_desc', 'Price: High to Low'),
                  ],
                  onChanged: (v) => setState(() => _sort = v ?? 'newest'),
                ),
                _buildDropdown(
                  label: 'Location',
                  value: _city,
                  nullable: true,
                  items: const [
                    (null, 'All Zimbabwe'),
                    ('Harare', 'Harare'),
                    ('Bulawayo', 'Bulawayo'),
                    ('Mutare', 'Mutare'),
                    ('Gweru', 'Gweru'),
                    ('Kwekwe', 'Kwekwe'),
                    ('Kadoma', 'Kadoma'),
                    ('Masvingo', 'Masvingo'),
                    ('Chinhoyi', 'Chinhoyi'),
                    ('Bindura', 'Bindura'),
                    ('Marondera', 'Marondera'),
                    ('Hwange', 'Hwange'),
                    ('Victoria Falls', 'Victoria Falls'),
                    ('Zvishavane', 'Zvishavane'),
                  ],
                  onChanged: (v) => setState(() => _city = v),
                ),
                // Category-specific extra filters
                ..._buildCategoryFilters(),
                // Condition (all except jobs, property, rooms)
                if (!['jobs'].contains(widget.category))
                  _buildDropdown(
                    label: 'Condition',
                    value: _condition,
                    nullable: true,
                    items: const [
                      (null, 'Any Condition'),
                      ('new', 'Brand New'),
                      ('like-new', 'Like New'),
                      ('good', 'Good'),
                      ('fair', 'Fair'),
                      ('used', 'Used'),
                    ],
                    onChanged: (v) => setState(() => _condition = v),
                  ),
                // Price range
                _buildPriceRange(),
                const SizedBox(height: 4),
              ],
            ),
          ),
          // action buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _clearFilters,
                    style: OutlinedButton.styleFrom(
                      padding:
                          const EdgeInsets.symmetric(vertical: 12),
                      side: const BorderSide(
                          color: AppColors.border),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
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
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: () {
                      setState(() => _filtersVisible = false);
                      _fetchListings(reset: true);
                    },
                    style: ElevatedButton.styleFrom(
                      padding:
                          const EdgeInsets.symmetric(vertical: 12),
                      backgroundColor: catColor,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
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
          Container(
            height: 2,
            color: catColor,
          ),
        ],
      ),
    );
  }

  List<Widget> _buildCategoryFilters() {
    switch (widget.category) {
      case 'vehicles':
        return _vehicleFilters();
      case 'property':
        return _propertyFilters();
      case 'jobs':
        return _jobFilters();
      case 'electronics':
        return _electronicsFilters();
      case 'fashion':
        return _fashionFilters();
      case 'agriculture':
        return _agricultureFilters();
      case 'furniture':
        return _furnitureFilters();
      case 'pets':
        return _petFilters();
      case 'kids':
        return _kidsFilters();
      case 'rooms':
        return _roomFilters();
      case 'services':
        return _serviceFilters();
      case 'other':
        return _otherFilters();
      default:
        return [];
    }
  }

  // vehicles
  List<Widget> _vehicleFilters() => [
        _buildDropdown(
          label: 'Vehicle Type',
          value: _vehicleType,
          nullable: true,
          items: const [
            (null, 'All Types'),
            ('car', 'Car'),
            ('suv', 'SUV / 4x4'),
            ('truck', 'Truck / Pickup'),
            ('van', 'Van / Minibus'),
            ('motorcycle', 'Motorcycle'),
            ('bus', 'Bus'),
            ('tractor', 'Tractor'),
            ('boat', 'Boat'),
          ],
          onChanged: (v) => setState(() => _vehicleType = v),
        ),
        _buildDropdown(
          label: 'Fuel Type',
          value: _fuelType,
          nullable: true,
          items: const [
            (null, 'All'),
            ('petrol', 'Petrol'),
            ('diesel', 'Diesel'),
            ('electric', 'Electric'),
            ('hybrid', 'Hybrid'),
            ('lpg', 'LPG'),
          ],
          onChanged: (v) => setState(() => _fuelType = v),
        ),
        _buildTextInput(
          controller: _brandCtrl,
          label: 'Make / Brand',
          hint: 'e.g. Toyota, Honda, BMW',
          onChanged: (v) => setState(() => _vehicleBrand = v.isEmpty ? null : v),
        ),
        _buildYearRange(),
      ];

  // property
  List<Widget> _propertyFilters() => [
        _buildDropdown(
          label: 'Property Type',
          value: _propType,
          nullable: true,
          items: const [
            (null, 'All Types'),
            ('residential', 'Residential'),
            ('commercial', 'Commercial'),
            ('land', 'Land / Stand'),
            ('units', 'Units / Flats'),
          ],
          onChanged: (v) => setState(() => _propType = v),
        ),
        _buildDropdown(
          label: 'Listing For',
          value: _listingFor,
          nullable: true,
          items: const [
            (null, 'Sale & Rent'),
            ('sale', 'For Sale'),
            ('rent', 'For Rent'),
          ],
          onChanged: (v) => setState(() => _listingFor = v),
        ),
        Row(
          children: [
            Expanded(
              child: _buildDropdown(
                label: 'Bedrooms',
                value: _beds,
                nullable: true,
                items: const [
                  (null, 'Any'),
                  ('studio', 'Studio'),
                  ('1', '1+'),
                  ('2', '2+'),
                  ('3', '3+'),
                  ('4', '4+'),
                  ('5', '5+'),
                ],
                onChanged: (v) => setState(() => _beds = v),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _buildDropdown(
                label: 'Bathrooms',
                value: _baths,
                nullable: true,
                items: const [
                  (null, 'Any'),
                  ('1', '1+'),
                  ('2', '2+'),
                  ('3', '3+'),
                ],
                onChanged: (v) => setState(() => _baths = v),
              ),
            ),
          ],
        ),
        _buildDropdown(
          label: 'Furnishing',
          value: _furnishing,
          nullable: true,
          items: const [
            (null, 'Any'),
            ('furnished', 'Furnished'),
            ('unfurnished', 'Unfurnished'),
            ('semi-furnished', 'Semi-Furnished'),
          ],
          onChanged: (v) => setState(() => _furnishing = v),
        ),
      ];

  // jobs
  List<Widget> _jobFilters() => [
        _buildDropdown(
          label: 'Job Category',
          value: _jobCategory,
          nullable: true,
          items: const [
            (null, 'All Categories'),
            ('accounting', 'Accounting & Finance'),
            ('sales', 'Sales & Marketing'),
            ('it', 'IT & Technology'),
            ('construction', 'Construction'),
            ('healthcare', 'Healthcare'),
            ('education', 'Education'),
            ('hospitality', 'Hospitality'),
            ('administration', 'Administration'),
            ('engineering', 'Engineering'),
            ('driving', 'Driving & Logistics'),
            ('other', 'Other'),
          ],
          onChanged: (v) => setState(() => _jobCategory = v),
        ),
        _buildDropdown(
          label: 'Employment Type',
          value: _jobType,
          nullable: true,
          items: const [
            (null, 'All'),
            ('full-time', 'Full-time'),
            ('part-time', 'Part-time'),
            ('contract', 'Contract'),
            ('freelance', 'Freelance'),
            ('internship', 'Internship'),
          ],
          onChanged: (v) => setState(() => _jobType = v),
        ),
        _buildLabel('Salary Range (USD)'),
        Row(
          children: [
            Expanded(
              child: _buildNumberInput(
                controller: _salaryMinCtrl,
                hint: 'Min',
                onChanged: (v) => setState(() {
                  _salaryMin = v.isEmpty ? null : double.tryParse(v);
                }),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _buildNumberInput(
                controller: _salaryMaxCtrl,
                hint: 'Max',
                onChanged: (v) => setState(() {
                  _salaryMax = v.isEmpty ? null : double.tryParse(v);
                }),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
      ];

  // electronics
  List<Widget> _electronicsFilters() => [
        _buildDropdown(
          label: 'Category',
          value: _electronicsCat,
          nullable: true,
          items: const [
            (null, 'All'),
            ('phones', 'Phones & Tablets'),
            ('computers', 'Computers & Laptops'),
            ('tvs', 'TVs & Screens'),
            ('audio', 'Audio & Speakers'),
            ('cameras', 'Cameras'),
            ('gaming', 'Gaming'),
            ('appliances', 'Appliances'),
            ('accessories', 'Accessories'),
          ],
          onChanged: (v) => setState(() => _electronicsCat = v),
        ),
        _buildTextInput(
          controller: _brandCtrl,
          label: 'Brand',
          hint: 'e.g. Samsung, Apple, Dell',
          onChanged: (v) =>
              setState(() => _electronicsBrand = v.isEmpty ? null : v),
        ),
      ];

  // fashion
  List<Widget> _fashionFilters() => [
        _buildDropdown(
          label: 'Category',
          value: _fashionGender,
          nullable: true,
          items: const [
            (null, 'All'),
            ('women', 'Women'),
            ('men', 'Men'),
            ('kids', 'Kids'),
            ('unisex', 'Unisex'),
          ],
          onChanged: (v) => setState(() => _fashionGender = v),
        ),
        _buildDropdown(
          label: 'Type',
          value: _fashionType,
          nullable: true,
          items: const [
            (null, 'All'),
            ('clothes', 'Clothes'),
            ('shoes', 'Shoes'),
            ('bags', 'Bags & Purses'),
            ('accessories', 'Accessories'),
            ('watches', 'Watches & Jewellery'),
            ('sportswear', 'Sportswear'),
            ('traditional', 'Traditional Wear'),
          ],
          onChanged: (v) => setState(() => _fashionType = v),
        ),
        _buildDropdown(
          label: 'Size',
          value: _fashionSize,
          nullable: true,
          items: const [
            (null, 'Any Size'),
            ('xs', 'XS'),
            ('s', 'S'),
            ('m', 'M'),
            ('l', 'L'),
            ('xl', 'XL'),
            ('xxl', '2XL'),
            ('xxxl', '3XL+'),
          ],
          onChanged: (v) => setState(() => _fashionSize = v),
        ),
        _buildTextInput(
          controller: _brandCtrl,
          label: 'Brand',
          hint: 'e.g. Nike, Zara, H&M',
          onChanged: (v) =>
              setState(() => _fashionBrand = v.isEmpty ? null : v),
        ),
      ];

  // agriculture
  List<Widget> _agricultureFilters() => [
        _buildDropdown(
          label: 'Category',
          value: _agricultureCat,
          nullable: true,
          items: const [
            (null, 'All'),
            ('livestock', 'Livestock & Animals'),
            ('crops', 'Crops & Produce'),
            ('equipment', 'Farm Equipment & Tools'),
            ('seeds', 'Seeds & Seedlings'),
            ('land', 'Agricultural Land'),
            ('inputs', 'Fertilisers & Chemicals'),
            ('irrigation', 'Irrigation Systems'),
            ('poultry', 'Poultry'),
            ('dairy', 'Dairy Products'),
            ('other', 'Other'),
          ],
          onChanged: (v) => setState(() => _agricultureCat = v),
        ),
      ];

  // furniture
  List<Widget> _furnitureFilters() => [
        _buildDropdown(
          label: 'Furniture Type',
          value: _furnitureType,
          nullable: true,
          items: const [
            (null, 'All'),
            ('sofas', 'Sofas & Lounge'),
            ('bedroom', 'Bedroom Sets'),
            ('dining', 'Dining Room'),
            ('office', 'Office Furniture'),
            ('outdoor', 'Outdoor'),
            ('kitchen', 'Kitchen'),
            ('wardrobes', 'Wardrobes'),
            ('decor', 'Home Decor'),
          ],
          onChanged: (v) => setState(() => _furnitureType = v),
        ),
        _buildTextInput(
          controller: _materialCtrl,
          label: 'Material',
          hint: 'e.g. Wood, Leather, Fabric',
          onChanged: (v) =>
              setState(() => _furnitureMaterial = v.isEmpty ? null : v),
        ),
      ];

  // pets
  List<Widget> _petFilters() => [
        _buildDropdown(
          label: 'Pet Type',
          value: _petType,
          nullable: true,
          items: const [
            (null, 'All'),
            ('dogs', 'Dogs'),
            ('cats', 'Cats'),
            ('birds', 'Birds'),
            ('fish', 'Fish & Aquatic'),
            ('rabbits', 'Rabbits & Small Animals'),
            ('reptiles', 'Reptiles'),
            ('livestock', 'Livestock'),
            ('other', 'Other'),
          ],
          onChanged: (v) => setState(() => _petType = v),
        ),
        _buildTextInput(
          controller: _petBreedCtrl,
          label: 'Breed',
          hint: 'e.g. German Shepherd, Persian Cat',
          onChanged: (v) =>
              setState(() => _petBreed = v.isEmpty ? null : v),
        ),
      ];

  // kids
  List<Widget> _kidsFilters() => [
        _buildDropdown(
          label: 'Category',
          value: _kidsCat,
          nullable: true,
          items: const [
            (null, 'All'),
            ('clothing', 'Clothing & Shoes'),
            ('toys', 'Toys & Games'),
            ('furniture', 'Baby Furniture & Gear'),
            ('feeding', 'Feeding & Nursing'),
            ('education', 'Books & Education'),
            ('strollers', 'Strollers & Car Seats'),
            ('electronics', 'Kids Electronics'),
            ('other', 'Other'),
          ],
          onChanged: (v) => setState(() => _kidsCat = v),
        ),
        _buildDropdown(
          label: 'For',
          value: _kidsFor,
          nullable: true,
          items: const [
            (null, 'All'),
            ('boys', 'Boys'),
            ('girls', 'Girls'),
            ('unisex', 'Unisex'),
            ('baby', 'Baby (0-2yr)'),
          ],
          onChanged: (v) => setState(() => _kidsFor = v),
        ),
      ];

  // rooms
  List<Widget> _roomFilters() => [
        _buildDropdown(
          label: 'Room Type',
          value: _roomType,
          nullable: true,
          items: const [
            (null, 'All'),
            ('single', 'Single Room'),
            ('double', 'Double Room'),
            ('self-contained', 'Self-Contained'),
            ('shared', 'Shared'),
            ('bachelor', 'Bachelor Flat'),
            ('cottage', 'Cottage'),
          ],
          onChanged: (v) => setState(() => _roomType = v),
        ),
        _buildDropdown(
          label: 'Furnishing',
          value: _roomFurnishing,
          nullable: true,
          items: const [
            (null, 'Any'),
            ('furnished', 'Furnished'),
            ('unfurnished', 'Unfurnished'),
            ('semi-furnished', 'Semi-Furnished'),
          ],
          onChanged: (v) => setState(() => _roomFurnishing = v),
        ),
        _buildDropdown(
          label: 'Rental Type',
          value: _roomRentalType,
          nullable: true,
          items: const [
            (null, 'All'),
            ('monthly', 'Monthly'),
            ('daily', 'Daily'),
            ('nightly', 'Nightly'),
          ],
          onChanged: (v) => setState(() => _roomRentalType = v),
        ),
      ];

  // services
  List<Widget> _serviceFilters() => [
        _buildDropdown(
          label: 'Service Type',
          value: _serviceType,
          nullable: true,
          items: const [
            (null, 'All Services'),
            ('cleaning', 'Cleaning'),
            ('construction', 'Construction & Building'),
            ('plumbing', 'Plumbing'),
            ('electrical', 'Electrical'),
            ('painting', 'Painting'),
            ('gardening', 'Gardening & Landscaping'),
            ('transport', 'Transport & Delivery'),
            ('photography', 'Photography & Video'),
            ('catering', 'Catering & Events'),
            ('it', 'IT & Tech Support'),
            ('tutoring', 'Tutoring & Education'),
            ('beauty', 'Beauty & Wellness'),
            ('security', 'Security'),
            ('legal', 'Legal & Finance'),
          ],
          onChanged: (v) => setState(() => _serviceType = v),
        ),
      ];

  // other
  List<Widget> _otherFilters() => [
        _buildDropdown(
          label: 'Category',
          value: _otherCat,
          nullable: true,
          items: const [
            (null, 'All'),
            ('antiques', 'Antiques & Collectibles'),
            ('sports', 'Sports & Fitness'),
            ('music', 'Musical Instruments'),
            ('books', 'Books & Magazines'),
            ('art', 'Art & Crafts'),
            ('tools', 'Tools & DIY'),
            ('health', 'Health & Beauty'),
            ('office', 'Office Supplies'),
            ('food', 'Food & Beverages'),
            ('other', 'Miscellaneous'),
          ],
          onChanged: (v) => setState(() => _otherCat = v),
        ),
      ];

  // ── Helper widgets ──────────────────────────────────────────────────────────

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textSecondary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildDropdown({
    required String label,
    required String? value,
    required List<(String?, String)> items,
    required ValueChanged<String?> onChanged,
    bool nullable = false,
  }) {
    // Ensure value exists in items; fallback to first item
    final allValues = items.map((e) => e.$1).toList();
    final safeValue = allValues.contains(value) ? value : allValues.first;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildLabel(label),
          Container(
            decoration: BoxDecoration(
              color: AppColors.background,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(9),
            ),
            padding:
                const EdgeInsets.symmetric(horizontal: 10),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String?>(
                value: safeValue,
                isExpanded: true,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: AppColors.textPrimary,
                ),
                items: items
                    .map((e) => DropdownMenuItem<String?>(
                          value: e.$1,
                          child: Text(e.$2),
                        ))
                    .toList(),
                onChanged: onChanged,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextInput({
    required TextEditingController controller,
    required String label,
    required String hint,
    required ValueChanged<String> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildLabel(label),
          Container(
            decoration: BoxDecoration(
              color: AppColors.background,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(9),
            ),
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: AppColors.textPrimary,
              ),
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: AppColors.textMuted,
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 9),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNumberInput({
    required TextEditingController controller,
    required String hint,
    required ValueChanged<String> onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.background,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(9),
      ),
      child: TextField(
        controller: controller,
        keyboardType: TextInputType.number,
        onChanged: onChanged,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 13,
          color: AppColors.textPrimary,
        ),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            color: AppColors.textMuted,
          ),
          border: InputBorder.none,
          isDense: true,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        ),
      ),
    );
  }

  Widget _buildPriceRange() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildLabel('Price Range (USD)'),
          Row(
            children: [
              Expanded(
                child: _buildNumberInput(
                  controller: _priceMinCtrl,
                  hint: 'Min',
                  onChanged: (v) => setState(() {
                    _priceMin = v.isEmpty ? null : double.tryParse(v);
                  }),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildNumberInput(
                  controller: _priceMaxCtrl,
                  hint: 'Max',
                  onChanged: (v) => setState(() {
                    _priceMax = v.isEmpty ? null : double.tryParse(v);
                  }),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildYearRange() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildLabel('Year Range'),
          Row(
            children: [
              Expanded(
                child: _buildNumberInput(
                  controller: _yearFromCtrl,
                  hint: 'From (e.g. 2010)',
                  onChanged: (v) => setState(() {
                    _yearFrom = v.isEmpty ? null : int.tryParse(v);
                  }),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildNumberInput(
                  controller: _yearToCtrl,
                  hint: 'To (e.g. 2024)',
                  onChanged: (v) => setState(() {
                    _yearTo = v.isEmpty ? null : int.tryParse(v);
                  }),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Results ─────────────────────────────────────────────────────────────────

  Widget _buildResults({
    required Color catColor,
    required String catLabel,
  }) {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(
          color: AppColors.primaryBlue,
        ),
      );
    }

    if (_listings.isEmpty) {
      return _buildEmptyState(
          catColor: catColor, catLabel: catLabel);
    }

    return RefreshIndicator(
      color: catColor,
      onRefresh: () => _fetchListings(reset: true),
      child: GridView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
        gridDelegate:
            const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 0.72,
        ),
        itemCount:
            _listings.length + (_loadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == _listings.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(
                  color: AppColors.primaryBlue,
                  strokeWidth: 2,
                ),
              ),
            );
          }
          return ListingCard(listing: _listings[index]);
        },
      ),
    );
  }

  Widget _buildEmptyState({
    required Color catColor,
    required String catLabel,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _catIcon(widget.category),
              size: 64,
              color: catColor.withOpacity(0.25),
            ),
            const SizedBox(height: 16),
            Text(
              'No listings yet in $catLabel',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _activeFilterCount > 0
                  ? 'Try adjusting your filters'
                  : 'Be the first to post an ad in this category',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 24),
            if (_activeFilterCount > 0)
              OutlinedButton(
                onPressed: _clearFilters,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 24, vertical: 12),
                  side: BorderSide(color: catColor),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text(
                  'Clear Filters',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: catColor,
                  ),
                ),
              )
            else
              ElevatedButton(
                onPressed: () {
                  if (!AuthService.isSignedIn) {
                    showAuthModal(
                        context, 'Sign in to post an ad');
                    return;
                  }
                  context.push('/post');
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 24, vertical: 12),
                  backgroundColor: catColor,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: const Text(
                  'Post the first ad',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}
