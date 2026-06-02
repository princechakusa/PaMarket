import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../models/listing.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';

// ── Job categories — mirrors JOB_CATS in jobs.js ───────────────────────────────
const kJobCats = <String>[
  'Accounting & Finance',
  'Sales & Marketing',
  'IT & Technology',
  'Construction',
  'Healthcare',
  'Education',
  'Hospitality',
  'Administration',
  'Engineering',
  'Driving & Logistics',
];

// Extra brand hexes (green banner gradient) — no AppColors constant exists.
const _kGreen = Color(0xFF22C55E);
const _kGreenDark = Color(0xFF15803D);
const _kOrangeEnd = Color(0xFFF07B00);

/// parseLine — mirrors parseLine(lines, key) in jobs.js.
/// Returns the trimmed value after `KEY:` for the first matching line.
String parseLine(List<String> lines, String key) {
  for (final ln in lines) {
    if (ln.startsWith('$key:')) {
      return ln.substring(key.length + 1).trim();
    }
  }
  return '';
}

// ── Jobs hub — mirrors H.pages.Jobs ───────────────────────────────────────────
class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  final _searchCtrl = TextEditingController();
  List<Listing> _jobs = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await ListingService.fetchListings(
        category: 'jobs',
        limit: 50,
      );
      if (!mounted) return;
      setState(() {
        _jobs = data;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _runSearch(String text) {
    final q = text.trim();
    if (q.isEmpty) {
      context.push('/find-jobs');
    } else {
      context.push('/find-jobs?q=${Uri.encodeComponent(q)}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final recent = (_jobs.toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt)))
        .take(5)
        .toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _buildTopbar(),
          Expanded(
            child: _loading
                ? const Center(
                    child:
                        CircularProgressIndicator(color: AppColors.primaryBlue),
                  )
                : ListView(
                    padding: EdgeInsets.zero,
                    children: [
                      _buildHero(),
                      _buildActionCards(),
                      _buildLookingForWorkBanner(),
                      _buildCategories(),
                      if (recent.isNotEmpty) _buildRecent(recent),
                      _buildBottomCta(),
                      const SizedBox(height: 24),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  // ── Topbar — orange bg, dark-blue back + title, + Post Job pill ──────────────
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
              'Jobs in Zimbabwe',
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
                '+ Post Job',
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

  // ── Hero — orange gradient, big title, sub-line, white search field ──────────
  Widget _buildHero() {
    final n = _jobs.length;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.orange, _kOrangeEnd],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Find Your Dream Job',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: AppColors.primaryBlue,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$n opening${n != 1 ? 's' : ''} across Zimbabwe',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: AppColors.primaryBlue.withValues(alpha: 0.75),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.95),
              borderRadius: BorderRadius.circular(14),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                const Icon(Icons.search, color: Color(0xFF999999), size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _searchCtrl,
                    textInputAction: TextInputAction.search,
                    onSubmitted: _runSearch,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      color: AppColors.primaryBlue,
                    ),
                    decoration: const InputDecoration(
                      hintText: 'Search job title, company, skills…',
                      hintStyle: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        color: Color(0xFF999999),
                      ),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 14),
                    ),
                    cursorColor: AppColors.primaryBlue,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Action cards — Find Jobs (blue) / Hire Talent (white, orange border) ─────
  Widget _buildActionCards() {
    final n = _jobs.length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => context.push('/find-jobs'),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 20),
                decoration: BoxDecoration(
                  color: AppColors.primaryBlue,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primaryBlue.withValues(alpha: 0.25),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    const Icon(Icons.business_center_outlined,
                        color: Colors.white, size: 28),
                    const SizedBox(height: 8),
                    const Text(
                      'Find Jobs',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$n openings',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: Colors.white.withValues(alpha: 0.7),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: GestureDetector(
              onTap: () => context.push('/hire-talent'),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.orange, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Column(
                  children: [
                    Icon(Icons.search,
                        color: AppColors.primaryBlue, size: 28),
                    SizedBox(height: 8),
                    Text(
                      'Hire Talent',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primaryBlue,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Find candidates',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Green "Looking for Work?" banner → /job-profile ──────────────────────────
  Widget _buildLookingForWorkBanner() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
      child: GestureDetector(
        onTap: () => context.push('/job-profile'),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [_kGreen, _kGreenDark],
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
                      'Looking for Work?',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Build your CV profile and let employers find you',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: Colors.white.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              const Icon(Icons.work_outline, color: Colors.white, size: 28),
            ],
          ),
        ),
      ),
    );
  }

  // ── Browse by Category — wrap of pill chips ──────────────────────────────────
  Widget _buildCategories() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Browse by Category',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: kJobCats.map((cat) {
              final cnt = _jobs.where((j) {
                final hay = '${j.title} ${j.description}'.toLowerCase();
                return hay.contains(cat.split(' ').first.toLowerCase());
              }).length;
              return GestureDetector(
                onTap: () =>
                    context.push('/find-jobs?cat=${Uri.encodeComponent(cat)}'),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: RichText(
                    text: TextSpan(
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                      children: [
                        TextSpan(text: cat),
                        TextSpan(
                          text: ' ($cnt)',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // ── Recent Openings — heading + View All + up to 5 cards ─────────────────────
  Widget _buildRecent(List<Listing> recent) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Recent Openings',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              GestureDetector(
                onTap: () => context.push('/find-jobs'),
                child: const Text(
                  'View All →',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryBlue,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...recent.map((l) => JobCard(listing: l)),
        ],
      ),
    );
  }

  // ── Bottom CTA — blue gradient card → /post-listing ──────────────────────────
  Widget _buildBottomCta() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 0),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.primaryBlue, AppColors.darkBlue],
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Hiring? Post a Job Free',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Reach thousands of qualified candidates across Zimbabwe',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: Colors.white.withValues(alpha: 0.7),
              ),
            ),
            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: () => context.push('/post-listing'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.orange,
                foregroundColor: AppColors.primaryBlue,
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              child: const Text(
                'Post a Job →',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Shared JobCard — mirrors jobCard(l) in jobs.js ─────────────────────────────
class JobCard extends StatelessWidget {
  final Listing listing;
  const JobCard({super.key, required this.listing});

  @override
  Widget build(BuildContext context) {
    final l = listing;
    final lines = l.description.split('\n');
    final company = l.sellerName.isNotEmpty
        ? l.sellerName
        : (parseLine(lines, 'COMPANY').isNotEmpty
            ? parseLine(lines, 'COMPANY')
            : 'Company');
    final jobType = parseLine(lines, 'JOB TYPE');
    final salary =
        parseLine(lines, 'SALARY').isNotEmpty ? parseLine(lines, 'SALARY') : 'Negotiable';
    final industry = parseLine(lines, 'INDUSTRY');
    final verified = l.sellerVerified == true;

    final initials = company
        .trim()
        .substring(0, company.trim().length >= 2 ? 2 : company.trim().length)
        .toUpperCase();

    return GestureDetector(
      onTap: () => context.push('/job/${l.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildLogo(l, initials),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          company,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primaryBlue,
                          ),
                        ),
                      ),
                      if (verified) ...[
                        const SizedBox(width: 4),
                        const Icon(Icons.verified,
                            color: AppColors.success, size: 13),
                      ],
                      if (industry.isNotEmpty)
                        Flexible(
                          child: Text(
                            ' · $industry',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 5,
                    runSpacing: 5,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (jobType.isNotEmpty)
                        _chip(
                          label: jobType,
                          bg: AppColors.primaryBlue.withValues(alpha: 0.08),
                          fg: AppColors.primaryBlue,
                        ),
                      _chip(
                        label: salary,
                        bg: AppColors.orange.withValues(alpha: 0.08),
                        fg: AppColors.orangeDark,
                        icon: Icons.payments_outlined,
                      ),
                      if (l.city.isNotEmpty)
                        _chip(
                          label: l.city,
                          bg: AppColors.background,
                          fg: AppColors.textSecondary,
                          icon: Icons.location_on_outlined,
                        ),
                      Text(
                        timeago.format(l.createdAt),
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 11,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLogo(Listing l, String initials) {
    if (l.photos.isNotEmpty && l.photos.first.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.network(
          l.photos.first,
          width: 46,
          height: 46,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _initialsBox(initials),
        ),
      );
    }
    return _initialsBox(initials);
  }

  Widget _initialsBox(String initials) {
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        color: AppColors.primaryBlue.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 17,
          fontWeight: FontWeight.w800,
          color: AppColors.primaryBlue,
        ),
      ),
    );
  }

  Widget _chip({
    required String label,
    required Color bg,
    required Color fg,
    IconData? icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: fg),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}
