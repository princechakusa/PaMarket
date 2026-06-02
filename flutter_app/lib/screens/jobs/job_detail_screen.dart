import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../models/listing.dart';
import '../../services/listing_service.dart';
import '../../services/auth_service.dart';
import '../../widgets/auth_modal.dart';
import '../../theme/app_theme.dart';

// Brand hexes used in the detail hero (no AppColors constant).
const _kHeroTop = Color(0xFF0A2558);
const _kHeroEnd = Color(0xFF2952CC);

/// parseLine — mirrors parseLine(lines, key) in jobs.js.
String parseLine(List<String> lines, String key) {
  for (final ln in lines) {
    if (ln.startsWith('$key:')) {
      return ln.substring(key.length + 1).trim();
    }
  }
  return '';
}

/// Parses the structured job description into named sections.
/// Mirrors the slice logic in H.pages.JobDetail.
class _JobSections {
  final String description;
  final String responsibilities;
  final String requirements;
  const _JobSections(
      this.description, this.responsibilities, this.requirements);

  static _JobSections parse(String d) {
    final descS = d.indexOf('\nDESCRIPTION:\n');
    final respS = d.indexOf('\nRESPONSIBILITIES:\n');
    final reqS = d.indexOf('\nREQUIREMENTS:\n');
    final applyS = d.indexOf('\nHOW TO APPLY:');

    int next(int from) {
      final candidates = [respS, reqS, applyS, d.length]
          .where((x) => x > from)
          .toList()
        ..sort();
      return candidates.first;
    }

    String description;
    if (descS > -1) {
      description = d.substring(descS + 14, next(descS)).trim();
    } else {
      description = d
          .split('\n')
          .where((ln) => !ln.contains(':'))
          .take(4)
          .join('\n')
          .trim();
    }
    final responsibilities =
        respS > -1 ? d.substring(respS + 19, next(respS)).trim() : '';
    final requirements =
        reqS > -1 ? d.substring(reqS + 15, next(reqS)).trim() : '';
    return _JobSections(description, responsibilities, requirements);
  }
}

// ── Job Detail — mirrors H.pages.JobDetail ────────────────────────────────────
class JobDetailScreen extends StatefulWidget {
  final String jobId;
  const JobDetailScreen({super.key, required this.jobId});

  @override
  State<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends State<JobDetailScreen> {
  Listing? _job;
  bool _loading = true;
  bool _applying = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final job = await ListingService.fetchListing(widget.jobId);
      if (!mounted) return;
      setState(() {
        _job = job;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _apply() async {
    if (!AuthService.isSignedIn) {
      showAuthModal(context, 'Sign in to apply for jobs');
      return;
    }
    final job = _job;
    if (job == null) return;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Apply for this job?',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Submit your application for "${job.title}". The employer will review your profile and reach out.',
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryBlue,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(13)),
                  ),
                  child: const Text(
                    'Confirm Application',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => Navigator.of(ctx).pop(false),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed != true || !mounted) return;
    setState(() => _applying = true);

    var sent = false;
    try {
      await Supabase.instance.client.from('job_applications').insert({
        'job_id': job.id,
        'applicant_id': AuthService.currentUserId,
        'applied_at': DateTime.now().toIso8601String(),
      });
      sent = true;
    } catch (_) {
      sent = false;
    }

    if (!mounted) return;
    setState(() => _applying = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(sent
            ? 'Application sent!'
            : 'We could not record your application right now. Please contact the employer directly.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primaryBlue),
        ),
      );
    }
    final job = _job;
    if (job == null) return _buildNotFound();

    final lines = job.description.split('\n');
    final company = job.sellerName.isNotEmpty
        ? job.sellerName
        : (parseLine(lines, 'COMPANY').isNotEmpty
            ? parseLine(lines, 'COMPANY')
            : 'Company');
    final jobType = parseLine(lines, 'JOB TYPE');
    final industry = parseLine(lines, 'INDUSTRY');
    final salary = parseLine(lines, 'SALARY').isNotEmpty
        ? parseLine(lines, 'SALARY')
        : 'Not disclosed';
    final deadline = parseLine(lines, 'DEADLINE');
    final sections = _JobSections.parse(job.description);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _buildTopbar(job),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _buildHero(job, company, jobType, industry),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildInfoGrid(job, salary, deadline),
                      if (sections.description.isNotEmpty)
                        _buildSection(
                            'About the Role', sections.description),
                      if (sections.responsibilities.isNotEmpty)
                        _buildSection('Key Responsibilities',
                            sections.responsibilities),
                      if (sections.requirements.isNotEmpty)
                        _buildSection('Requirements', sections.requirements),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _buildApplyBar(),
        ],
      ),
    );
  }

  // ── Dark topbar ──────────────────────────────────────────────────────────────
  Widget _buildTopbar(Listing job) {
    return Container(
      color: AppColors.darkBlue,
      padding: EdgeInsets.fromLTRB(
        8,
        MediaQuery.of(context).padding.top + 6,
        16,
        10,
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: () => context.pop(),
            icon: const Icon(Icons.chevron_left,
                color: Colors.white, size: 28),
          ),
          Expanded(
            child: Text(
              job.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 40),
        ],
      ),
    );
  }

  // ── Gradient hero with logo, title, company, chips ───────────────────────────
  Widget _buildHero(
      Listing job, String company, String jobType, String industry) {
    final initials = company
        .split(' ')
        .where((w) => w.isNotEmpty)
        .take(2)
        .map((w) => w[0])
        .join()
        .toUpperCase();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_kHeroTop, AppColors.primaryBlue, _kHeroEnd],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _buildLogo(job, initials),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      job.title,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      company,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.white.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (jobType.isNotEmpty)
                _heroChip(
                  label: jobType,
                  bg: Colors.white.withValues(alpha: 0.18),
                  fg: Colors.white,
                ),
              if (industry.isNotEmpty)
                _heroChip(
                  label: industry,
                  bg: AppColors.orange.withValues(alpha: 0.19),
                  fg: AppColors.orange,
                ),
              _heroChip(
                label: job.city.isNotEmpty ? job.city : 'Zimbabwe',
                bg: Colors.white.withValues(alpha: 0.12),
                fg: Colors.white.withValues(alpha: 0.8),
                icon: Icons.location_on_outlined,
              ),
              _heroChip(
                label: timeago.format(job.createdAt),
                bg: Colors.white.withValues(alpha: 0.12),
                fg: Colors.white.withValues(alpha: 0.8),
                icon: Icons.access_time,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLogo(Listing job, String initials) {
    if (job.photos.isNotEmpty && job.photos.first.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Image.network(
          job.photos.first,
          width: 56,
          height: 56,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _initialsBox(initials),
        ),
      );
    }
    return _initialsBox(initials);
  }

  Widget _initialsBox(String initials) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2), width: 2),
      ),
      alignment: Alignment.center,
      child: Text(
        initials.isNotEmpty ? initials : 'C',
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 20,
          fontWeight: FontWeight.w900,
          color: Colors.white,
        ),
      ),
    );
  }

  Widget _heroChip({
    required String label,
    required Color bg,
    required Color fg,
    IconData? icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }

  // ── Pulled-up white info grid ────────────────────────────────────────────────
  Widget _buildInfoGrid(Listing job, String salary, String deadline) {
    final items = <List<String>>[
      ['Salary', salary],
      ['Location', job.city.isNotEmpty ? job.city : 'Zimbabwe'],
      deadline.isNotEmpty
          ? ['Deadline', deadline]
          : ['Status', job.status == 'active' ? 'Open' : 'Closed'],
      ['Posted', timeago.format(job.createdAt)],
    ];

    return Transform.translate(
      offset: const Offset(0, -14),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 14,
          mainAxisSpacing: 14,
          childAspectRatio: 3.4,
          children: items.map((it) => _infoItem(it[0], it[1])).toList(),
        ),
      ),
    );
  }

  Widget _infoItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }

  // ── Section card (mirrors _jb) ───────────────────────────────────────────────
  Widget _buildSection(String title, String text) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 3,
                height: 16,
                decoration: BoxDecoration(
                  color: AppColors.primaryBlue,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            text,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              height: 1.8,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  // ── Fixed bottom Apply bar ───────────────────────────────────────────────────
  Widget _buildApplyBar() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.card,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        12 + MediaQuery.of(context).padding.bottom,
      ),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: _applying ? null : _apply,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primaryBlue,
            foregroundColor: Colors.white,
            elevation: 0,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(13)),
          ),
          icon: _applying
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.send_outlined, size: 18),
          label: Text(
            _applying ? 'Applying…' : 'Apply Now',
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  Widget _buildNotFound() {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.darkBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Job',
          style: TextStyle(
            fontFamily: 'Inter',
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.work_off_outlined,
                  size: 56, color: AppColors.textMuted),
              const SizedBox(height: 16),
              const Text(
                'Job not found',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'This posting may have been removed.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 18),
              ElevatedButton(
                onPressed: () => context.push('/find-jobs'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text(
                  'Browse Jobs',
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
      ),
    );
  }
}
