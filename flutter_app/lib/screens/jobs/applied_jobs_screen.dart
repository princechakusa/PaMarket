import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_modal.dart';

// ── Data model ──────────────────────────────────────────────────────────────

class _JobApplication {
  final String? jobId;
  final String jobTitle;
  final String company;
  final String status;
  final DateTime? appliedAt;

  const _JobApplication({
    required this.jobId,
    required this.jobTitle,
    required this.company,
    required this.status,
    required this.appliedAt,
  });

  factory _JobApplication.fromMap(Map<String, dynamic> m) {
    final rawJobId = m['job_id'];
    DateTime? applied;
    final rawApplied = m['applied_at'];
    if (rawApplied is String && rawApplied.isNotEmpty) {
      applied = DateTime.tryParse(rawApplied);
    } else if (rawApplied is DateTime) {
      applied = rawApplied;
    }
    return _JobApplication(
      jobId: rawJobId == null ? null : rawJobId.toString(),
      jobTitle: (m['job_title'] as String?)?.trim().isNotEmpty == true
          ? m['job_title'] as String
          : 'Job',
      company: (m['company'] as String?) ?? '',
      status: (m['status'] as String?) ?? 'pending',
      appliedAt: applied,
    );
  }
}

// ── Status → visual helpers ───────────────────────────────────────────────────

Color _statusColor(String status) {
  switch (status) {
    case 'reviewed':
      return AppColors.primaryBlue;
    case 'shortlisted':
      return const Color(0xFF22C55E);
    case 'rejected':
      return AppColors.error;
    case 'pending':
    default:
      return AppColors.orange;
  }
}

String _statusLabel(String status) {
  switch (status) {
    case 'reviewed':
      return 'Reviewed';
    case 'shortlisted':
      return 'Shortlisted';
    case 'rejected':
      return 'Not selected';
    case 'pending':
    default:
      return 'Pending';
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

class AppliedJobsScreen extends StatefulWidget {
  const AppliedJobsScreen({super.key});

  @override
  State<AppliedJobsScreen> createState() => _AppliedJobsScreenState();
}

class _AppliedJobsScreenState extends State<AppliedJobsScreen> {
  List<_JobApplication> _applications = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!AuthService.isSignedIn) {
      if (mounted) {
        setState(() {
          _applications = const [];
          _loading = false;
        });
      }
      return;
    }

    List<_JobApplication> results = const [];
    try {
      final client = Supabase.instance.client;
      final data = await client
          .from('job_applications')
          .select()
          .eq('applicant_id', AuthService.currentUserId!)
          .order('applied_at', ascending: false);

      results = (data as List)
          .whereType<Map<String, dynamic>>()
          .map(_JobApplication.fromMap)
          .toList();
    } catch (_) {
      // Table may not exist or query failed — treat as empty.
      results = const [];
    }

    if (mounted) {
      setState(() {
        _applications = results;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: _buildAppBar(),
        body: const _SignInEmptyState(),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: _buildAppBar(),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primaryBlue),
            )
          : RefreshIndicator(
              color: AppColors.primaryBlue,
              onRefresh: _load,
              child: _applications.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 80),
                        _EmptyState(),
                      ],
                    )
                  : ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 88),
                      itemCount: _applications.length,
                      itemBuilder: (context, i) =>
                          _ApplicationCard(app: _applications[i]),
                    ),
            ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.primaryBlue,
      foregroundColor: Colors.white,
      elevation: 0,
      title: const Text(
        'My Applications',
        style: TextStyle(
          fontFamily: 'Inter',
          fontWeight: FontWeight.w700,
          fontSize: 17,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ── Application card ───────────────────────────────────────────────────────────

class _ApplicationCard extends StatelessWidget {
  const _ApplicationCard({required this.app});

  final _JobApplication app;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(app.status);
    return GestureDetector(
      onTap: app.jobId == null
          ? null
          : () => context.push('/job/${app.jobId}'),
      child: Container(
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    app.jobTitle,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                _StatusPill(status: app.status),
              ],
            ),
            if (app.company.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                app.company,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            const SizedBox(height: 4),
            Text(
              app.appliedAt == null
                  ? 'Applied recently'
                  : 'Applied ${timeago.format(app.appliedAt!)}',
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        _statusLabel(status),
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

// ── Empty states ───────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        children: [
          const Icon(
            Icons.work_outline,
            size: 64,
            color: AppColors.textMuted,
          ),
          const SizedBox(height: 16),
          const Text(
            'No applications yet',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Browse jobs and apply directly in the app.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => context.push('/find-jobs'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryBlue,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Browse Jobs',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SignInEmptyState extends StatelessWidget {
  const _SignInEmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.lock_outline,
              size: 64,
              color: AppColors.textMuted,
            ),
            const SizedBox(height: 16),
            const Text(
              'Sign in required',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Sign in to view your job applications.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => showAuthModal(
                  context,
                  'Sign in to view your applications',
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Sign In',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
