import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../models/listing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';

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
  final _supabase = Supabase.instance.client;

  List<Listing> _allListings = [];
  List<Listing> _filtered = [];
  bool _loading = true;
  bool _filtersOpen = false;

  // Filters
  final _minPriceCtrl = TextEditingController();
  final _maxPriceCtrl = TextEditingController();
  String _condition = 'Any';
  String _city = 'All Zimbabwe';
  String _sort = 'Newest';

  // Vehicle filters
  final _makeCtrl = TextEditingController();
  final _yearMinCtrl = TextEditingController();
  final _yearMaxCtrl = TextEditingController();

  // Property filters
  String _propType = 'Any';
  String _bedrooms = 'Any';
  String _bathrooms = 'Any';
  String _listingFor = 'Any';

  // Jobs filters
  String _jobType = 'Any';

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
    'Bindura',
    'Marondera',
    'Hwange',
    'Victoria Falls',
  ];

  static const _conditions = ['Any', 'New', 'Like New', 'Used', 'Refurbished'];
  static const _sorts = ['Newest', 'Oldest', 'Price ↑', 'Price ↓'];
  static const _propTypes = ['Any', 'House', 'Flat', 'Land', 'Commercial'];
  static const _bedroomOpts = ['Any', '1', '2', '3', '4', '5+'];
  static const _bathroomOpts = ['Any', '1', '2', '3', '4+'];
  static const _listingForOpts = ['Any', 'For Sale', 'For Rent'];
  static const _jobTypes = [
    'Any',
    'Full-time',
    'Part-time',
    'Contract',
    'Remote',
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _minPriceCtrl.dispose();
    _maxPriceCtrl.dispose();
    _makeCtrl.dispose();
    _yearMinCtrl.dispose();
    _yearMaxCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _supabase
          .from('listings')
          .select('*, profiles(verified, avatar)')
          .eq('category', widget.categoryId)
          .eq('status', 'active')
          .order('created_at', ascending: false)
          .limit(200);

      if (mounted) {
        final listings =
            (data as List).map((m) => Listing.fromMap(m)).toList();
        setState(() {
          _allListings = listings;
          _loading = false;
        });
        _applyFilters();
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _applyFilters() {
    List<Listing> result = List.from(_allListings);

    // Condition filter
    if (_condition != 'Any') {
      result = result
          .where((l) =>
              l.condition?.toLowerCase() == _condition.toLowerCase())
          .toList();
    }

    // City filter
    if (_city != 'All Zimbabwe') {
      result = result
          .where((l) => l.city.toLowerCase().contains(_city.toLowerCase()))
          .toList();
    }

    // Price range
    final minPrice = double.tryParse(_minPriceCtrl.text);
    final maxPrice = double.tryParse(_maxPriceCtrl.text);
    if (minPrice != null) {
      result = result.where((l) => l.price >= minPrice).toList();
    }
    if (maxPrice != null) {
      result = result.where((l) => l.price <= maxPrice).toList();
    }

    // Vehicle filters
    if (widget.categoryId == 'vehicles' && _makeCtrl.text.isNotEmpty) {
      final make = _makeCtrl.text.toLowerCase();
      result = result
          .where((l) => l.title.toLowerCase().contains(make) ||
              l.description.toLowerCase().contains(make))
          .toList();
    }

    // Sort
    switch (_sort) {
      case 'Oldest':
        result.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      case 'Price ↑':
        result.sort((a, b) => a.price.compareTo(b.price));
      case 'Price ↓':
        result.sort((a, b) => b.price.compareTo(a.price));
      default:
        result.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    }

    setState(() => _filtered = result);
  }

  void _resetFilters() {
    setState(() {
      _minPriceCtrl.clear();
      _maxPriceCtrl.clear();
      _condition = 'Any';
      _city = 'All Zimbabwe';
      _sort = 'Newest';
      _makeCtrl.clear();
      _yearMinCtrl.clear();
      _yearMaxCtrl.clear();
      _propType = 'Any';
      _bedrooms = 'Any';
      _bathrooms = 'Any';
      _listingFor = 'Any';
      _jobType = 'Any';
    });
    _applyFilters();
  }

  int get _activeFilterCount {
    int count = 0;
    if (_minPriceCtrl.text.isNotEmpty) count++;
    if (_maxPriceCtrl.text.isNotEmpty) count++;
    if (_condition != 'Any') count++;
    if (_city != 'All Zimbabwe') count++;
    if (_sort != 'Newest') count++;
    if (widget.categoryId == 'vehicles') {
      if (_makeCtrl.text.isNotEmpty) count++;
      if (_yearMinCtrl.text.isNotEmpty) count++;
      if (_yearMaxCtrl.text.isNotEmpty) count++;
    }
    if (widget.categoryId == 'property') {
      if (_propType != 'Any') count++;
      if (_bedrooms != 'Any') count++;
      if (_bathrooms != 'Any') count++;
      if (_listingFor != 'Any') count++;
    }
    if (widget.categoryId == 'jobs') {
      if (_jobType != 'Any') count++;
    }
    return count;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          // Blue header
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.darkBlue, AppColors.primaryBlue],
              ),
            ),
            padding: EdgeInsets.fromLTRB(
              16,
              MediaQuery.of(context).padding.top + 8,
              16,
              12,
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.arrow_back,
                          color: Colors.white, size: 22),
                      padding: EdgeInsets.zero,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        widget.categoryName,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    // Filter badge button
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        IconButton(
                          onPressed: () =>
                              setState(() => _filtersOpen = !_filtersOpen),
                          icon: Icon(
                            _filtersOpen
                                ? Icons.tune
                                : Icons.tune_outlined,
                            color: Colors.white,
                            size: 22,
                          ),
                        ),
                        if (_activeFilterCount > 0)
                          Positioned(
                            top: 6,
                            right: 6,
                            child: Container(
                              width: 16,
                              height: 16,
                              decoration: const BoxDecoration(
                                color: AppColors.orange,
                                shape: BoxShape.circle,
                              ),
                              child: Center(
                                child: Text(
                                  '$_activeFilterCount',
                                  style: const TextStyle(
                                    fontFamily: 'Inter',
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Search bar
                GestureDetector(
                  onTap: () => context.push('/search'),
                  child: Container(
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Row(
                      children: [
                        const Icon(Icons.search,
                            color: Colors.white70, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'Search in ${widget.categoryName}...',
                          style: const TextStyle(
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
          ),

          // Filter panel
          if (_filtersOpen) _FilterPanel(
            categoryId: widget.categoryId,
            condition: _condition,
            city: _city,
            sort: _sort,
            minPriceCtrl: _minPriceCtrl,
            maxPriceCtrl: _maxPriceCtrl,
            makeCtrl: _makeCtrl,
            yearMinCtrl: _yearMinCtrl,
            yearMaxCtrl: _yearMaxCtrl,
            propType: _propType,
            bedrooms: _bedrooms,
            bathrooms: _bathrooms,
            listingFor: _listingFor,
            jobType: _jobType,
            cities: _cities,
            conditions: _conditions,
            sorts: _sorts,
            propTypes: _propTypes,
            bedroomOpts: _bedroomOpts,
            bathroomOpts: _bathroomOpts,
            listingForOpts: _listingForOpts,
            jobTypes: _jobTypes,
            onConditionChanged: (v) {
              setState(() => _condition = v);
              _applyFilters();
            },
            onCityChanged: (v) {
              setState(() => _city = v);
              _applyFilters();
            },
            onSortChanged: (v) {
              setState(() => _sort = v);
              _applyFilters();
            },
            onPropTypeChanged: (v) {
              setState(() => _propType = v);
              _applyFilters();
            },
            onBedroomsChanged: (v) {
              setState(() => _bedrooms = v);
              _applyFilters();
            },
            onBathroomsChanged: (v) {
              setState(() => _bathrooms = v);
              _applyFilters();
            },
            onListingForChanged: (v) {
              setState(() => _listingFor = v);
              _applyFilters();
            },
            onJobTypeChanged: (v) {
              setState(() => _jobType = v);
              _applyFilters();
            },
            onApply: _applyFilters,
            onReset: _resetFilters,
          ),

          // Results count bar
          Container(
            color: AppColors.card,
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Text(
                  _loading
                      ? 'Loading...'
                      : '${_filtered.length} listing${_filtered.length != 1 ? 's' : ''}',
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
          ),
          const Divider(height: 1, color: AppColors.border),

          // Listings grid
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _filtered.isEmpty
                    ? const _EmptyState()
                    : RefreshIndicator(
                        onRefresh: _load,
                        color: AppColors.primaryBlue,
                        child: GridView.builder(
                          padding:
                              const EdgeInsets.fromLTRB(16, 16, 16, 100),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: 0.72,
                          ),
                          itemCount: _filtered.length,
                          itemBuilder: (_, i) =>
                              ListingCard(listing: _filtered[i]),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _FilterPanel extends StatelessWidget {
  final String categoryId;
  final String condition;
  final String city;
  final String sort;
  final TextEditingController minPriceCtrl;
  final TextEditingController maxPriceCtrl;
  final TextEditingController makeCtrl;
  final TextEditingController yearMinCtrl;
  final TextEditingController yearMaxCtrl;
  final String propType;
  final String bedrooms;
  final String bathrooms;
  final String listingFor;
  final String jobType;
  final List<String> cities;
  final List<String> conditions;
  final List<String> sorts;
  final List<String> propTypes;
  final List<String> bedroomOpts;
  final List<String> bathroomOpts;
  final List<String> listingForOpts;
  final List<String> jobTypes;
  final ValueChanged<String> onConditionChanged;
  final ValueChanged<String> onCityChanged;
  final ValueChanged<String> onSortChanged;
  final ValueChanged<String> onPropTypeChanged;
  final ValueChanged<String> onBedroomsChanged;
  final ValueChanged<String> onBathroomsChanged;
  final ValueChanged<String> onListingForChanged;
  final ValueChanged<String> onJobTypeChanged;
  final VoidCallback onApply;
  final VoidCallback onReset;

  const _FilterPanel({
    required this.categoryId,
    required this.condition,
    required this.city,
    required this.sort,
    required this.minPriceCtrl,
    required this.maxPriceCtrl,
    required this.makeCtrl,
    required this.yearMinCtrl,
    required this.yearMaxCtrl,
    required this.propType,
    required this.bedrooms,
    required this.bathrooms,
    required this.listingFor,
    required this.jobType,
    required this.cities,
    required this.conditions,
    required this.sorts,
    required this.propTypes,
    required this.bedroomOpts,
    required this.bathroomOpts,
    required this.listingForOpts,
    required this.jobTypes,
    required this.onConditionChanged,
    required this.onCityChanged,
    required this.onSortChanged,
    required this.onPropTypeChanged,
    required this.onBedroomsChanged,
    required this.onBathroomsChanged,
    required this.onListingForChanged,
    required this.onJobTypeChanged,
    required this.onApply,
    required this.onReset,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Price range
          const Text(
            'Price Range (USD)',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: minPriceCtrl,
                  keyboardType: TextInputType.number,
                  onChanged: (_) => onApply(),
                  decoration: InputDecoration(
                    hintText: 'Min',
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    filled: true,
                    fillColor: AppColors.background,
                    isDense: true,
                  ),
                  style: const TextStyle(fontFamily: 'Inter', fontSize: 13),
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Text('—',
                    style: TextStyle(color: AppColors.textMuted)),
              ),
              Expanded(
                child: TextField(
                  controller: maxPriceCtrl,
                  keyboardType: TextInputType.number,
                  onChanged: (_) => onApply(),
                  decoration: InputDecoration(
                    hintText: 'Max',
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    filled: true,
                    fillColor: AppColors.background,
                    isDense: true,
                  ),
                  style: const TextStyle(fontFamily: 'Inter', fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Condition + City dropdowns
          Row(
            children: [
              Expanded(
                child: _FilterDropdown(
                  label: 'Condition',
                  value: condition,
                  items: conditions,
                  onChanged: onConditionChanged,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _FilterDropdown(
                  label: 'City',
                  value: city,
                  items: cities,
                  onChanged: onCityChanged,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Sort
          _FilterDropdown(
            label: 'Sort By',
            value: sort,
            items: sorts,
            onChanged: onSortChanged,
          ),

          // Category-specific filters
          if (categoryId == 'vehicles') ...[
            const SizedBox(height: 10),
            TextField(
              controller: makeCtrl,
              onChanged: (_) => onApply(),
              decoration: InputDecoration(
                hintText: 'Make (e.g. Toyota, Ford)',
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                filled: true,
                fillColor: AppColors.background,
                isDense: true,
              ),
              style: const TextStyle(fontFamily: 'Inter', fontSize: 13),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: yearMinCtrl,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => onApply(),
                    decoration: InputDecoration(
                      hintText: 'Year from',
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide:
                            const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide:
                            const BorderSide(color: AppColors.border),
                      ),
                      filled: true,
                      fillColor: AppColors.background,
                      isDense: true,
                    ),
                    style:
                        const TextStyle(fontFamily: 'Inter', fontSize: 13),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: yearMaxCtrl,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => onApply(),
                    decoration: InputDecoration(
                      hintText: 'Year to',
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide:
                            const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide:
                            const BorderSide(color: AppColors.border),
                      ),
                      filled: true,
                      fillColor: AppColors.background,
                      isDense: true,
                    ),
                    style:
                        const TextStyle(fontFamily: 'Inter', fontSize: 13),
                  ),
                ),
              ],
            ),
          ],

          if (categoryId == 'property') ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _FilterDropdown(
                    label: 'Type',
                    value: propType,
                    items: propTypes,
                    onChanged: onPropTypeChanged,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _FilterDropdown(
                    label: 'For',
                    value: listingFor,
                    items: listingForOpts,
                    onChanged: onListingForChanged,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _FilterDropdown(
                    label: 'Bedrooms',
                    value: bedrooms,
                    items: bedroomOpts,
                    onChanged: onBedroomsChanged,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _FilterDropdown(
                    label: 'Bathrooms',
                    value: bathrooms,
                    items: bathroomOpts,
                    onChanged: onBathroomsChanged,
                  ),
                ),
              ],
            ),
          ],

          if (categoryId == 'jobs') ...[
            const SizedBox(height: 10),
            _FilterDropdown(
              label: 'Job Type',
              value: jobType,
              items: jobTypes,
              onChanged: onJobTypeChanged,
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterDropdown extends StatelessWidget {
  final String label;
  final String value;
  final List<String> items;
  final ValueChanged<String> onChanged;

  const _FilterDropdown({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          value: value,
          isDense: true,
          decoration: InputDecoration(
            labelText: label,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            filled: true,
            fillColor: AppColors.background,
          ),
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            color: AppColors.textPrimary,
          ),
          items: items
              .map((item) => DropdownMenuItem(
                    value: item,
                    child: Text(item,
                        style: const TextStyle(fontFamily: 'Inter')),
                  ))
              .toList(),
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search_off_outlined, size: 72, color: AppColors.border),
          SizedBox(height: 16),
          Text(
            'No listings found',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Try adjusting your filters or check back later.',
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
