import 'package:flutter/material.dart';
import '../../config/supabase_config.dart';
import '../../models/listing.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _searchCtrl = TextEditingController();
  List<Listing> _results = [];
  bool _loading = false;
  bool _searched = false;

  String? _filterCategory;
  String? _filterProvince;
  double? _filterMaxPrice;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final q = _searchCtrl.text.trim();
    if (q.isEmpty && _filterCategory == null && _filterProvince == null) {
      return;
    }

    setState(() {
      _loading = true;
      _searched = true;
    });
    try {
      final results = await ListingService.fetchListings(
        searchQuery: q.isNotEmpty ? q : null,
        category: _filterCategory,
        province: _filterProvince,
        maxPrice: _filterMaxPrice,
        limit: 50,
      );
      if (mounted) {
        setState(() {
          _results = results;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showFilters() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _FilterSheet(
        category: _filterCategory,
        province: _filterProvince,
        maxPrice: _filterMaxPrice,
        onApply: (cat, prov, price) {
          setState(() {
            _filterCategory = cat;
            _filterProvince = prov;
            _filterMaxPrice = price;
          });
          Navigator.pop(context);
          _search();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasFilters = _filterCategory != null ||
        _filterProvince != null ||
        _filterMaxPrice != null;

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _searchCtrl,
          autofocus: true,
          onSubmitted: (_) => _search(),
          decoration: InputDecoration(
            hintText: 'Search listings...',
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.15),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(20),
              borderSide: BorderSide.none,
            ),
            suffixIcon: IconButton(
              icon: const Icon(Icons.search, color: Colors.white),
              onPressed: _search,
            ),
            hintStyle:
                const TextStyle(color: Colors.white60, fontFamily: 'Inter'),
          ),
          style: const TextStyle(color: Colors.white, fontFamily: 'Inter'),
        ),
        actions: [
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.tune_outlined),
                onPressed: _showFilters,
              ),
              if (hasFilters)
                Positioned(
                  right: 10,
                  top: 10,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.orange,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : !_searched
              ? _SearchHints(onHintTapped: (hint) {
                  _searchCtrl.text = hint;
                  _search();
                })
              : _results.isEmpty
                  ? const _NoResults()
                  : GridView.builder(
                      padding: const EdgeInsets.all(16),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 0.72,
                      ),
                      itemCount: _results.length,
                      itemBuilder: (_, i) =>
                          ListingCard(listing: _results[i]),
                    ),
    );
  }
}

class _FilterSheet extends StatefulWidget {
  final String? category;
  final String? province;
  final double? maxPrice;
  final void Function(String?, String?, double?) onApply;

  const _FilterSheet({
    required this.category,
    required this.province,
    required this.maxPrice,
    required this.onApply,
  });

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  String? _category;
  String? _province;
  final _priceCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _category = widget.category;
    _province = widget.province;
    if (widget.maxPrice != null) {
      _priceCtrl.text = widget.maxPrice!.toStringAsFixed(0);
    }
  }

  @override
  void dispose() {
    _priceCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Text(
                'Filters',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 18,
                    fontWeight: FontWeight.w700),
              ),
              const Spacer(),
              TextButton(
                onPressed: () {
                  setState(() {
                    _category = null;
                    _province = null;
                    _priceCtrl.clear();
                  });
                },
                child: const Text('Clear all'),
              ),
            ],
          ),

          const SizedBox(height: 16),

          const Text('Category',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: _category,
            decoration: const InputDecoration(hintText: 'All categories'),
            items: [
              const DropdownMenuItem(value: null, child: Text('All categories')),
              ...SupabaseConfig.categories.map(
                (c) => DropdownMenuItem(
                    value: c['id'], child: Text(c['label']!)),
              ),
            ],
            onChanged: (v) => setState(() => _category = v),
          ),

          const SizedBox(height: 16),

          const Text('Province',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: _province,
            decoration: const InputDecoration(hintText: 'All provinces'),
            items: [
              const DropdownMenuItem(value: null, child: Text('All provinces')),
              ...SupabaseConfig.provinces.map(
                (p) => DropdownMenuItem(value: p, child: Text(p)),
              ),
            ],
            onChanged: (v) => setState(() => _province = v),
          ),

          const SizedBox(height: 16),

          const Text('Max Price (USD)',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          TextFormField(
            controller: _priceCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
                hintText: 'No limit', prefixText: '\$ '),
          ),

          const SizedBox(height: 24),

          ElevatedButton(
            onPressed: () => widget.onApply(
              _category,
              _province,
              _priceCtrl.text.isNotEmpty
                  ? double.tryParse(_priceCtrl.text)
                  : null,
            ),
            child: const Text('Apply Filters'),
          ),
        ],
      ),
    );
  }
}

class _SearchHints extends StatelessWidget {
  final ValueChanged<String> onHintTapped;

  const _SearchHints({required this.onHintTapped});

  static const _hints = [
    'iPhone',
    'Toyota',
    'Apartment Harare',
    'Software Developer',
    'Land Rover',
    'Maize seeds',
    'Generator',
    'Plumber',
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
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
                color: AppColors.textSecondary),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _hints.map((h) {
              return GestureDetector(
                onTap: () => onHintTapped(h),
                child: Chip(
                  label: Text(h),
                  labelStyle: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      color: AppColors.textPrimary),
                  backgroundColor: AppColors.card,
                  side: const BorderSide(color: AppColors.border),
                  avatar: const Icon(Icons.search,
                      size: 14, color: AppColors.textMuted),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _NoResults extends StatelessWidget {
  const _NoResults();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search_off, size: 64, color: AppColors.border),
          SizedBox(height: 16),
          Text(
            'No results found',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: FontWeight.w700),
          ),
          SizedBox(height: 8),
          Text(
            'Try different keywords or filters',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}
