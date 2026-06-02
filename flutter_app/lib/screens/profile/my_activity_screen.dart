import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../models/listing.dart';
import '../../services/activity_service.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';

/// Mirrors the master `pages.MyActivity` block in www/js/settings.js.
class MyActivityScreen extends StatefulWidget {
  const MyActivityScreen({super.key});

  @override
  State<MyActivityScreen> createState() => _MyActivityScreenState();
}

class _MyActivityScreenState extends State<MyActivityScreen> {
  bool _loadingViewed = true;
  List<Listing> _viewed = [];

  @override
  void initState() {
    super.initState();
    _loadViewed();
  }

  Future<void> _loadViewed() async {
    final ids = ActivityService.recentlyViewedIds;
    final results = await Future.wait(
      ids.map((id) => ListingService.fetchListing(id)),
    );
    if (!mounted) return;
    setState(() {
      _viewed = results.whereType<Listing>().toList();
      _loadingViewed = false;
    });
  }

  void _removeSearch(String q) {
    ActivityService.recentSearches.removeWhere((s) => s == q);
    setState(() {});
  }

  void _clearSearches() {
    ActivityService.clearSearches();
    setState(() {});
  }

  void _openSearch(String q) {
    context.push('/search');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'My Activity',
          style: TextStyle(
            fontFamily: 'Inter',
            fontWeight: FontWeight.w700,
            fontSize: 18,
            color: Colors.white,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.only(top: 8, bottom: 32),
        children: [
          _sectionLabel('Recent Searches'),
          _buildSearchSection(),
          const SizedBox(height: 12),
          _sectionLabel('Recently Viewed'),
          _buildViewedSection(),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.66,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }

  Widget _emptyCard(String msg) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          Icon(
            Icons.search,
            size: 36,
            color: AppColors.textSecondary.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 10),
          Text(
            msg,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchSection() {
    final searches = ActivityService.recentSearches;
    if (searches.isEmpty) {
      return _emptyCard('No recent searches yet');
    }
    return Column(
      children: [
        Container(
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 4),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (int i = 0; i < searches.length; i++)
                _searchRow(searches[i], showTopBorder: i > 0),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: _clearSearches,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Clear all',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.error,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _searchRow(String q, {required bool showTopBorder}) {
    return InkWell(
      onTap: () => _openSearch(q),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          border: showTopBorder
              ? const Border(top: BorderSide(color: AppColors.border))
              : null,
        ),
        child: Row(
          children: [
            const Icon(Icons.search, size: 16, color: AppColors.textSecondary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                q,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            IconButton(
              onPressed: () => _removeSearch(q),
              icon: const Icon(Icons.close, size: 18),
              color: AppColors.textSecondary,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              visualDensity: VisualDensity.compact,
              tooltip: 'Remove',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildViewedSection() {
    if (_loadingViewed) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_viewed.isEmpty) {
      return _emptyCard('No recently viewed listings');
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 0.72,
        ),
        itemCount: _viewed.length,
        itemBuilder: (_, i) => ListingCard(listing: _viewed[i]),
      ),
    );
  }
}
