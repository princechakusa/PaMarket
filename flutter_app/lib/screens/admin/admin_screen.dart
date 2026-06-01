import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../theme/app_theme.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _client = Supabase.instance.client;

  List<Map<String, dynamic>> _pendingVerifications = [];
  List<Map<String, dynamic>> _reports = [];
  bool _loadingVerif = true;
  bool _loadingReports = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _loadVerifications();
    _loadReports();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _loadVerifications() async {
    try {
      final data = await _client
          .from('profiles')
          .select()
          .eq('verification_pending', true)
          .eq('verified', false);
      if (mounted) {
        setState(() {
          _pendingVerifications = List<Map<String, dynamic>>.from(data);
          _loadingVerif = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingVerif = false);
    }
  }

  Future<void> _loadReports() async {
    try {
      final data = await _client
          .from('reports')
          .select('*, reporter:profiles!reports_reporter_id_fkey(name)')
          .eq('status', 'pending')
          .order('created_at', ascending: false);
      if (mounted) {
        setState(() {
          _reports = List<Map<String, dynamic>>.from(data);
          _loadingReports = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingReports = false);
    }
  }

  Future<void> _approveVerification(String userId) async {
    await _client.from('profiles').update({
      'verified': true,
      'verification_pending': false,
    }).eq('id', userId);
    await _loadVerifications();
  }

  Future<void> _rejectVerification(String userId) async {
    await _client.from('profiles').update({
      'verification_pending': false,
    }).eq('id', userId);
    await _loadVerifications();
  }

  Future<void> _banUser(String userId) async {
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Ban User'),
        content: TextField(
          controller: reasonCtrl,
          decoration: const InputDecoration(labelText: 'Reason for ban'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Ban'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _client.from('profiles').update({
        'status': 'banned',
        'ban_reason': reasonCtrl.text.trim(),
      }).eq('id', userId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('User banned.')));
      }
    }
    reasonCtrl.dispose();
  }

  Future<void> _resolveReport(String reportId, String action) async {
    await _client
        .from('reports')
        .update({'status': action}).eq('id', reportId);
    await _loadReports();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Panel'),
        bottom: TabBar(
          controller: _tabs,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: AppColors.orange,
          tabs: const [
            Tab(text: 'Verifications'),
            Tab(text: 'Reports'),
            Tab(text: 'Users'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _VerificationTab(
            items: _pendingVerifications,
            loading: _loadingVerif,
            onApprove: _approveVerification,
            onReject: _rejectVerification,
          ),
          _ReportsTab(
            reports: _reports,
            loading: _loadingReports,
            onResolve: _resolveReport,
            onBan: _banUser,
          ),
          _UsersTab(client: _client, onBan: _banUser),
        ],
      ),
    );
  }
}

// ── Verifications Tab ──────────────────────────────────────────

class _VerificationTab extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  final bool loading;
  final Future<void> Function(String) onApprove;
  final Future<void> Function(String) onReject;

  const _VerificationTab({
    required this.items,
    required this.loading,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (items.isEmpty) {
      return const Center(
        child: Text('No pending verifications',
            style: TextStyle(fontFamily: 'Inter', color: AppColors.textSecondary)),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final item = items[i];
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item['name'] as String? ?? 'User',
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontWeight: FontWeight.w700,
                        fontSize: 15)),
                Text(item['email'] as String? ?? '',
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: AppColors.textSecondary)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.error,
                          side: const BorderSide(color: AppColors.error),
                        ),
                        onPressed: () => onReject(item['id'] as String),
                        child: const Text('Reject'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.success),
                        onPressed: () => onApprove(item['id'] as String),
                        child: const Text('Approve'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Reports Tab ────────────────────────────────────────────────

class _ReportsTab extends StatelessWidget {
  final List<Map<String, dynamic>> reports;
  final bool loading;
  final Future<void> Function(String, String) onResolve;
  final Future<void> Function(String) onBan;

  const _ReportsTab({
    required this.reports,
    required this.loading,
    required this.onResolve,
    required this.onBan,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (reports.isEmpty) {
      return const Center(
        child: Text('No pending reports',
            style: TextStyle(fontFamily: 'Inter', color: AppColors.textSecondary)),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: reports.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final r = reports[i];
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        r['type'] as String? ?? 'report',
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.error,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      'By: ${r['reporter']?['name'] ?? 'User'}',
                      style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 11,
                          color: AppColors.textMuted),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  r['reason'] as String? ?? '',
                  style: const TextStyle(
                      fontFamily: 'Inter', fontSize: 13, height: 1.4),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () =>
                            onResolve(r['id'] as String, 'dismissed'),
                        child: const Text('Dismiss'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.error),
                        onPressed: () {
                          onResolve(r['id'] as String, 'actioned');
                          if (r['reported_user_id'] != null) {
                            onBan(r['reported_user_id'] as String);
                          }
                        },
                        child: const Text('Ban User'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Users Tab ──────────────────────────────────────────────────

class _UsersTab extends StatefulWidget {
  final dynamic client;
  final Future<void> Function(String) onBan;

  const _UsersTab({required this.client, required this.onBan});

  @override
  State<_UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends State<_UsersTab> {
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _users = [];
  bool _loading = false;

  Future<void> _search() async {
    final q = _searchCtrl.text.trim();
    if (q.isEmpty) return;
    setState(() => _loading = true);
    try {
      final data = await widget.client
          .from('profiles')
          .select()
          .or('name.ilike.%$q%,email.ilike.%$q%')
          .limit(20);
      if (mounted) {
        setState(() {
          _users = List<Map<String, dynamic>>.from(data);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            controller: _searchCtrl,
            onSubmitted: (_) => _search(),
            decoration: InputDecoration(
              hintText: 'Search users by name or email',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                icon: const Icon(Icons.send),
                onPressed: _search,
              ),
            ),
          ),
        ),
        if (_loading)
          const Center(child: CircularProgressIndicator())
        else
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _users.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final u = _users[i];
                final isBanned = u['status'] == 'banned';
                return ListTile(
                  title: Row(
                    children: [
                      Text(u['name'] as String? ?? 'User',
                          style: const TextStyle(
                              fontFamily: 'Inter', fontWeight: FontWeight.w600)),
                      if (u['verified'] == true) ...[
                        const SizedBox(width: 4),
                        const Icon(Icons.verified,
                            size: 14, color: AppColors.primaryBlue),
                      ],
                      if (isBanned) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: AppColors.error,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('BANNED',
                              style: TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 9,
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ],
                  ),
                  subtitle: Text(u['email'] as String? ?? '',
                      style: const TextStyle(
                          fontFamily: 'Inter', fontSize: 12)),
                  trailing: !isBanned
                      ? IconButton(
                          icon: const Icon(Icons.block, color: AppColors.error),
                          onPressed: () => widget.onBan(u['id'] as String),
                        )
                      : IconButton(
                          icon: const Icon(Icons.check_circle_outline,
                              color: AppColors.success),
                          onPressed: () async {
                            await widget.client.from('profiles').update({
                              'status': 'active',
                              'ban_reason': null,
                            }).eq('id', u['id']);
                            _search();
                          },
                        ),
                );
              },
            ),
          ),
      ],
    );
  }
}
