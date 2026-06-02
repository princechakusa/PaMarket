import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/listing.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';
import 'jobs_screen.dart';

const _kJobTypes = <List<String>>[
  ['all', 'All'],
  ['full-time', 'Full-time'],
  ['part-time', 'Part-time'],
  ['contract', 'Contract'],
  ['freelance', 'Freelance'],
  ['internship', 'Internship'],
];

const _kQualifications = <List<String>>[
  ['all', 'All'],
  ['none', 'No formal qualification'],
  ['certificate', 'Certificate / Diploma'],
  ['degree', 'Degree'],
  ['postgrad', 'Postgraduate'],
];

// ── Find Jobs — mirrors H.pages.FindJobs ──────────────────────────────────────
class FindJobsScreen extends StatefulWidget {
  final String? initialQuery;
  final String? initialCategory;
  const FindJobsScreen({super.key, this.initialQuery, this.initialCategory});

  @override
  State<FindJobsScreen> createState() => _FindJobsScreenState();
}

class _FindJobsScreenState extends State<FindJobsScreen> {
  final _searchCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();

  List<Listing> _allJobs = [];
  bool _loading = true;
  bool _showFilters = false;

  String _category = 'all';
  String _jobType = 'all';
  String _qualification = 'all';
  String _sort = 'newest';

  @override
  void initState() {
    super.initState();
    _searchCtrl.text = widget.initialQuery ?? '';
    if (widget.initialCategory != null &&
        widget.initialCategory!.trim().isNotEmpty) {
      _category = widget.initialCategory!;
    }
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await ListingService.fetchListings(
        category: 'jobs',
        limit: 100,
      );
      if (!mounted) return;
      setState(() {
        _allJobs = data;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _clearFilters() {
    setState(() {
      _category = 'all';
      _jobType = 'all';
      _qualification = 'all';
      _sort = 'newest';
      _cityCtrl.clear();
    });
  }

  int get _activeFilterCount {
    var n = 0;
    if (_category != 'all') n++;
    if (_jobType != 'all') n++;
    if (_qualification != 'all') n++;
    if (_cityCtrl.text.trim().isNotEmpty) n++;
    if (_sort != 'newest') n++;
    return n;
  }

  List<Listing> get _filtered {
    var jobs = _allJobs.toList();
    final q = _searchCtrl.text.toLowerCase().trim();
    if (q.isNotEmpty) {
      jobs = jobs.where((l) {
        final hay =
            '${l.title} ${l.description} ${l.city} ${l.sellerName}'
                .toLowerCase();
        return hay.contains(q);
      }).toList();
    }
    final city = _cityCtrl.text.toLowerCase().trim();
    if (city.isNotEmpty) {
      jobs = jobs.where((l) {
        return '${l.city} ${l.province}'.toLowerCase().contains(city);
      }).toList();
    }
    if (_category != 'all') {
      final key = _category.split(' ').first.toLowerCase();
      jobs = jobs.where((l) {
        return '${l.title} ${l.description}'.toLowerCase().contains(key);
      }).toList();
    }
    if (_jobType != 'all') {
      final key = _jobType.replaceAll('-', ' ');
      jobs = jobs
          .where((l) => l.description.toLowerCase().contains(key))
          .toList();
    }
    jobs.sort((a, b) => _sort == 'oldest'
        ? a.createdAt.compareTo(b.createdAt)
        : b.createdAt.compareTo(a.createdAt));
    return jobs;
  }

  @override
  Widget build(BuildContext context) {
    final jobs = _loading ? <Listing>[] : _filtered;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _buildTopbar(),
          _buildSearchBar(jobs.length),
          if (_showFilters) _buildFilterPanel(),
          Expanded(
            child: _loading
                ? const Center(
                    child:
                        CircularProgressIndicator(color: AppColors.primaryBlue),
                  )
                : jobs.isEmpty
                    ? _buildEmpty()
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 88),
                        itemCount: jobs.length,
                        itemBuilder: (_, i) => JobCard(listing: jobs[i]),
                      ),
          ),
        ],
      ),
    );
  }

  // ── Topbar — orange, "Find Jobs", + Post ─────────────────────────────────────
  Widget _buildTopbar() {
    return Container(
      color: AppColors.orange,
      padding: EdgeInsets.fromLTRB(
        8,
        MediaQuery.of(context).padding.top + 6,
        12,
        10,
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: () => context.pop(),
            icon: const Icon(Icons.chevron_left,
                color: AppColors.primaryBlue, size: 28),
          ),
          const Expanded(
            child: Text(
              'Find Jobs',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.primaryBlue,
              ),
            ),
          ),
          GestureDetector(
            onTap: () => context.push('/post-listing'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.primaryBlue,
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
    );
  }

  // ── Orange search bar + Filter toggle + count ────────────────────────────────
  Widget _buildSearchBar(int count) {
    return Container(
      color: AppColors.orange,
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: [
                      const Icon(Icons.search,
                          color: Color(0xFF999999), size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _searchCtrl,
                          onChanged: (_) => setState(() {}),
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            color: AppColors.primaryBlue,
                          ),
                          decoration: const InputDecoration(
                            hintText: 'Search jobs…',
                            hintStyle: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 14,
                              color: Color(0xFF999999),
                            ),
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(vertical: 12),
                          ),
                          cursorColor: AppColors.primaryBlue,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => setState(() => _showFilters = !_showFilters),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.tune,
                          color: AppColors.primaryBlue, size: 14),
                      const SizedBox(width: 5),
                      const Text(
                        'Filter',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryBlue,
                        ),
                      ),
                      if (_activeFilterCount > 0) ...[
                        const SizedBox(width: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 4, vertical: 1),
                          constraints: const BoxConstraints(minWidth: 16),
                          decoration: BoxDecoration(
                            color: AppColors.primaryBlue,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '$_activeFilterCount',
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
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
          const SizedBox(height: 8),
          Text(
            '$count job${count != 1 ? 's' : ''}',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.primaryBlue.withValues(alpha: 0.75),
            ),
          ),
        ],
      ),
    );
  }

  // ── Collapsible filter panel ─────────────────────────────────────────────────
  Widget _buildFilterPanel() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.card,
        border: Border(
          bottom: BorderSide(color: AppColors.orange, width: 2),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _dropdown(
            label: 'Job Category',
            value: _category,
            items: [
              const ['all', 'All Categories'],
              ...kJobCats.map((c) => [c, c]),
              const ['Other', 'Other'],
            ],
            onChanged: (v) => setState(() => _category = v),
          ),
          const SizedBox(height: 12),
          _dropdown(
            label: 'Job Type',
            value: _jobType,
            items: _kJobTypes,
            onChanged: (v) => setState(() => _jobType = v),
          ),
          const SizedBox(height: 12),
          _dropdown(
            label: 'Qualification',
            value: _qualification,
            items: _kQualifications,
            onChanged: (v) => setState(() => _qualification = v),
          ),
          const SizedBox(height: 12),
          _label('City'),
          const SizedBox(height: 6),
          TextField(
            controller: _cityCtrl,
            onChanged: (_) => setState(() {}),
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              color: AppColors.textPrimary,
            ),
            decoration: InputDecoration(
              hintText: 'Any city',
              hintStyle: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textMuted,
              ),
              isDense: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              filled: true,
              fillColor: AppColors.background,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.primaryBlue),
              ),
            ),
          ),
          const SizedBox(height: 12),
          _dropdown(
            label: 'Sort',
            value: _sort,
            items: const [
              ['newest', 'Newest'],
              ['oldest', 'Oldest'],
            ],
            onChanged: (v) => setState(() => _sort = v),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                flex: 1,
                child: OutlinedButton(
                  onPressed: _clearFilters,
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.background,
                    side: const BorderSide(color: AppColors.border),
                    padding: const EdgeInsets.symmetric(vertical: 10),
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
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: () => setState(() => _showFilters = false),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.orange,
                    foregroundColor: AppColors.primaryBlue,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
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
        ],
      ),
    );
  }

  Widget _label(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: AppColors.textSecondary,
      ),
    );
  }

  Widget _dropdown({
    required String label,
    required String value,
    required List<List<String>> items,
    required ValueChanged<String> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(label),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              icon: const Icon(Icons.keyboard_arrow_down,
                  color: AppColors.textSecondary),
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textPrimary,
              ),
              dropdownColor: AppColors.card,
              items: items
                  .map((it) => DropdownMenuItem<String>(
                        value: it[0],
                        child: Text(
                          it[1],
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ))
                  .toList(),
              onChanged: (v) {
                if (v != null) onChanged(v);
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.work_off_outlined,
                size: 56, color: AppColors.textMuted),
            const SizedBox(height: 16),
            const Text(
              'No jobs match',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Try adjusting your filters',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
