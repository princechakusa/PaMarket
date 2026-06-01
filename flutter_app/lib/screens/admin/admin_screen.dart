import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

// ── Entry point ───────────────────────────────────────────────────────────────

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  final _client = Supabase.instance.client;

  // Tab state — mirrors _adminTab in admin.js
  _AdminTab _tab = _AdminTab.overview;

  // Overview stats
  int _totalUsers = 0;
  int _totalListings = 0;
  int _activeListings = 0;
  int _pendingListings = 0;
  int _openReports = 0;
  int _newUsersToday = 0;
  int _verifyQueue = 0;

  // Tab data
  List<Map<String, dynamic>> _users = [];
  List<Map<String, dynamic>> _listings = [];
  List<Map<String, dynamic>> _reports = [];
  List<Map<String, dynamic>> _pendingVerifications = [];
  List<Map<String, dynamic>> _verifiedUsers = [];
  List<Map<String, dynamic>> _adminLogs = [];

  bool _loading = true;

  // Users tab search
  final _userSearchCtrl = TextEditingController();

  // Reports filter
  String _reportFilter = 'all';

  // Listings filter
  String _listingStatusFilter = 'all';
  final _listingSearchCtrl = TextEditingController();

  // Broadcast form
  String _bcastTarget = 'all';
  final _bcastTitleCtrl = TextEditingController();
  final _bcastMsgCtrl = TextEditingController();
  bool _sendingBroadcast = false;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _userSearchCtrl.dispose();
    _listingSearchCtrl.dispose();
    _bcastTitleCtrl.dispose();
    _bcastMsgCtrl.dispose();
    super.dispose();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    await Future.wait([
      _loadOverview(),
      _loadUsers(),
      _loadListings(),
      _loadReports(),
      _loadVerifications(),
      _loadLogs(),
    ]);
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadOverview() async {
    try {
      final now = DateTime.now();
      final todayStart = DateTime(now.year, now.month, now.day);

      final results = await Future.wait([
        _client.from('profiles').select('id, created_at, role, verification_pending, verified'),
        _client.from('listings').select('id, status, created_at'),
        _client.from('reports').select('id, status').eq('status', 'open'),
      ]);

      final users = results[0] as List;
      final listings = results[1] as List;
      final reports = results[2] as List;

      if (!mounted) return;
      setState(() {
        _totalUsers = users.length;
        _newUsersToday = users.where((u) {
          final created = DateTime.tryParse(u['created_at'] as String? ?? '');
          return created != null && created.isAfter(todayStart);
        }).length;
        _verifyQueue = users
            .where((u) =>
                u['verification_pending'] == true && u['verified'] != true)
            .length;

        _totalListings = listings.length;
        _activeListings =
            listings.where((l) => l['status'] == 'active').length;
        _pendingListings =
            listings.where((l) => l['status'] == 'pending').length;

        _openReports = reports.length;
      });
    } catch (_) {}
  }

  Future<void> _loadUsers() async {
    try {
      final data = await _client
          .from('profiles')
          .select('id, name, email, phone, role, status, verified, created_at')
          .order('created_at', ascending: false)
          .limit(200);
      if (mounted) setState(() => _users = List<Map<String, dynamic>>.from(data));
    } catch (_) {}
  }

  Future<void> _loadListings() async {
    try {
      final data = await _client
          .from('listings')
          .select('id, title, status, price, currency, city, created_at, seller_id')
          .order('created_at', ascending: false)
          .limit(200);
      if (mounted) setState(() => _listings = List<Map<String, dynamic>>.from(data));
    } catch (_) {}
  }

  Future<void> _loadReports() async {
    try {
      final data = await _client
          .from('reports')
          .select('*, reporter:profiles!reports_reporter_id_fkey(name)')
          .order('created_at', ascending: false)
          .limit(100);
      if (mounted) setState(() => _reports = List<Map<String, dynamic>>.from(data));
    } catch (_) {}
  }

  Future<void> _loadVerifications() async {
    try {
      final pending = await _client
          .from('profiles')
          .select('id, name, email, phone, avatar_url, verification_pending, id_type')
          .eq('verification_pending', true)
          .eq('verified', false);
      final verified = await _client
          .from('profiles')
          .select('id, name, email, verified, verified_at')
          .eq('verified', true)
          .limit(50);
      if (mounted) {
        setState(() {
          _pendingVerifications = List<Map<String, dynamic>>.from(pending);
          _verifiedUsers = List<Map<String, dynamic>>.from(verified);
        });
      }
    } catch (_) {}
  }

  Future<void> _loadLogs() async {
    // Logs are stored in app_settings or a logs table; we use a local list for now
    // since the JS version stores logs in H.state.adminLogs (local state)
  }

  // ── Admin actions ─────────────────────────────────────────────────────────

  Future<void> _banUser(String userId, {bool permanent = false}) async {
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(permanent ? 'Permanently Ban User' : 'Suspend User 7 Days'),
        content: TextField(
          controller: reasonCtrl,
          decoration: const InputDecoration(
            labelText: 'Reason for action',
            labelStyle: TextStyle(fontFamily: 'Inter'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel',
                style: TextStyle(fontFamily: 'Inter')),
          ),
          ElevatedButton(
            style:
                ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(context, true),
            child: Text(permanent ? 'Ban Permanently' : 'Suspend 7 Days',
                style: const TextStyle(fontFamily: 'Inter')),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      try {
        await _client.from('profiles').update({
          'status': permanent ? 'banned' : 'banned_temp',
          'ban_reason': reasonCtrl.text.trim(),
        }).eq('id', userId);
        _toast(permanent ? 'User banned' : 'User suspended');
        await _loadUsers();
      } catch (_) {
        _toast('Failed to update user');
      }
    }
    reasonCtrl.dispose();
  }

  Future<void> _unbanUser(String userId) async {
    try {
      await _client.from('profiles').update({
        'status': 'active',
        'ban_reason': null,
      }).eq('id', userId);
      _toast('User unbanned');
      await _loadUsers();
    } catch (_) {
      _toast('Failed to unban user');
    }
  }

  Future<void> _approveVerification(String userId) async {
    try {
      await _client.from('profiles').update({
        'verified': true,
        'verification_pending': false,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', userId);
      // Send notification
      await _client.from('notifications').insert({
        'user_id': userId,
        'title': 'Identity Verified ✓',
        'body':
            'Congratulations! Your identity has been verified on PaMarket.',
        'type': 'verify',
        'read': false,
        'created_at': DateTime.now().toIso8601String(),
      });
      _toast('User verified ✓');
      await _loadVerifications();
    } catch (_) {
      _toast('Failed to approve verification');
    }
  }

  Future<void> _rejectVerification(String userId) async {
    try {
      await _client.from('profiles').update({
        'verification_pending': false,
      }).eq('id', userId);
      await _client
          .from('verifications')
          .delete()
          .eq('user_id', userId);
      await _client.from('notifications').insert({
        'user_id': userId,
        'title': 'Verification Unsuccessful',
        'body':
            'Your ID verification could not be approved. Contact support for help.',
        'type': 'warn',
        'read': false,
        'created_at': DateTime.now().toIso8601String(),
      });
      _toast('Verification rejected');
      await _loadVerifications();
    } catch (_) {
      _toast('Failed to reject verification');
    }
  }

  Future<void> _revokeVerification(String userId) async {
    try {
      await _client.from('profiles').update({
        'verified': false,
      }).eq('id', userId);
      _toast('Verification revoked');
      await _loadVerifications();
    } catch (_) {
      _toast('Failed to revoke verification');
    }
  }

  Future<void> _approveListing(String listingId) async {
    try {
      await _client
          .from('listings')
          .update({'status': 'active'}).eq('id', listingId);
      _toast('Listing approved and live');
      await _loadListings();
    } catch (_) {
      _toast('Failed to approve listing');
    }
  }

  Future<void> _rejectListing(String listingId, String title) async {
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Reject Listing'),
        content: TextField(
          controller: reasonCtrl,
          decoration: const InputDecoration(
            labelText: 'Reason for rejection',
            hintText: 'e.g. Misleading content, prohibited item',
            labelStyle: TextStyle(fontFamily: 'Inter'),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style:
                ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Reject Listing'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      final reason =
          reasonCtrl.text.trim().isEmpty ? 'Policy violation' : reasonCtrl.text.trim();
      try {
        await _client.from('listings').update({
          'status': 'rejected',
          'reject_reason': reason,
        }).eq('id', listingId);
        _toast('Listing rejected');
        await _loadListings();
      } catch (_) {
        _toast('Failed to reject listing');
      }
    }
    reasonCtrl.dispose();
  }

  Future<void> _removeListing(String listingId, String title) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Remove Listing'),
        content: Text(
            'Remove "$title" from the marketplace? The seller will be notified.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style:
                ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Remove Listing'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      try {
        await _client.from('listings').update({'status': 'banned'}).eq('id', listingId);
        _toast('Listing removed');
        await _loadListings();
      } catch (_) {
        _toast('Failed to remove listing');
      }
    }
  }

  Future<void> _restoreListing(String listingId) async {
    try {
      await _client
          .from('listings')
          .update({'status': 'active'}).eq('id', listingId);
      _toast('Listing restored');
      await _loadListings();
    } catch (_) {
      _toast('Failed to restore listing');
    }
  }

  Future<void> _resolveReport(String reportId) async {
    try {
      await _client
          .from('reports')
          .update({'status': 'resolved'}).eq('id', reportId);
      _toast('Report resolved');
      await _loadReports();
    } catch (_) {
      _toast('Failed to resolve report');
    }
  }

  Future<void> _sendBroadcast() async {
    final title = _bcastTitleCtrl.text.trim();
    final msg = _bcastMsgCtrl.text.trim();
    if (title.isEmpty || msg.isEmpty) {
      _toast('Enter title and message');
      return;
    }
    setState(() => _sendingBroadcast = true);
    try {
      // Fetch target user IDs
      var query = _client.from('profiles').select('id');
      if (_bcastTarget == 'verified') {
        query = query.eq('verified', true) as dynamic;
      } else if (_bcastTarget == 'unverified') {
        query = query.eq('verified', false) as dynamic;
      }
      final profilesData = await (query as dynamic).limit(5000);
      final userIds = (profilesData as List)
          .map((p) => p['id'] as String?)
          .where((id) => id != null)
          .cast<String>()
          .toList();

      if (userIds.isEmpty) {
        _toast('No users found for this filter');
        return;
      }

      // Insert notifications in batches of 100
      final now = DateTime.now().toIso8601String();
      final batches = <Future>[];
      for (var i = 0; i < userIds.length; i += 100) {
        final batch = userIds
            .sublist(i,
                i + 100 > userIds.length ? userIds.length : i + 100)
            .map((id) => {
                  'user_id': id,
                  'title': title,
                  'body': msg,
                  'type': 'system',
                  'read': false,
                  'created_at': now,
                })
            .toList();
        batches.add(_client.from('notifications').insert(batch));
      }
      await Future.wait(batches);

      _toast('Broadcast sent to ${userIds.length} user${userIds.length != 1 ? 's' : ''}');
      _bcastTitleCtrl.clear();
      _bcastMsgCtrl.clear();
    } catch (_) {
      _toast('Failed to send broadcast');
    } finally {
      if (mounted) setState(() => _sendingBroadcast = false);
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(msg,
            style: const TextStyle(fontFamily: 'Inter', fontSize: 13)),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ));
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    // Access guard — mirrors adminGuard()
    final isAdmin = AuthService.isSignedIn;
    // Role check must come from profile; we rely on the profile 'role' field
    // loaded in _users. For the guard we check if the current user's
    // entry has role == 'admin'.
    final currentId = AuthService.currentUserId;
    final myProfile = currentId != null
        ? _users.where((u) => u['id'] == currentId).firstOrNull
        : null;
    final hasAdminRole = myProfile == null
        ? true // still loading, show content optimistically
        : myProfile['role'] == 'admin';

    if (!isAdmin || (!_loading && !hasAdminRole)) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.primaryBlue,
          foregroundColor: Colors.white,
          title: const Text('Admin',
              style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700)),
        ),
        body: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.block, size: 48, color: AppColors.error),
              SizedBox(height: 16),
              Text(
                'Access Denied',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Admin Panel',
          style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 17,
              fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadAll,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primaryBlue))
          : Column(
              children: [
                _buildTabBar(),
                Expanded(child: _buildBody()),
              ],
            ),
    );
  }

  // ── Tab bar ────────────────────────────────────────────────────────────────

  Widget _buildTabBar() {
    final tabs = <_AdminTab, String>{
      _AdminTab.overview: 'Overview',
      _AdminTab.users: 'Users (${_users.length})',
      _AdminTab.listings: 'Listings (${_listings.length})',
      _AdminTab.reports:
          'Reports (${_reports.where((r) => r['status'] == 'open').length})',
      _AdminTab.verifications:
          'Verify ($_verifyQueue)',
      _AdminTab.notifications: 'Notify',
      _AdminTab.logs: 'Logs',
    };

    return Container(
      color: AppColors.card,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
        child: Row(
          children: tabs.entries.map((e) {
            final selected = _tab == e.key;
            return GestureDetector(
              onTap: () => setState(() => _tab = e.key),
              child: Container(
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: selected ? AppColors.primaryBlue : AppColors.lightBlue,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  e.value,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: selected ? Colors.white : AppColors.primaryBlue,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildBody() {
    switch (_tab) {
      case _AdminTab.overview:
        return _buildOverview();
      case _AdminTab.users:
        return _buildUsers();
      case _AdminTab.listings:
        return _buildListings();
      case _AdminTab.reports:
        return _buildReports();
      case _AdminTab.verifications:
        return _buildVerifications();
      case _AdminTab.notifications:
        return _buildNotifications();
      case _AdminTab.logs:
        return _buildLogs();
    }
  }

  // ── Overview ───────────────────────────────────────────────────────────────

  Widget _buildOverview() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _statsRow([
            _Stat('$_totalUsers', 'Users'),
            _Stat('+$_newUsersToday', 'New Today'),
            _Stat(
                '${_users.where((u) => u['verified'] == true).length}',
                'Verified'),
          ]),
          const SizedBox(height: 10),
          _statsRow([
            _Stat('$_activeListings', 'Active Ads'),
            _Stat('$_pendingListings', 'Pending'),
            _Stat('$_totalListings', 'Total Ads'),
          ]),
          const SizedBox(height: 10),
          _statsRow([
            _Stat('$_openReports', 'Open Reports'),
            _Stat('${_users.where((u) => u['status'] == 'banned').length}', 'Banned'),
            _Stat('$_verifyQueue', 'Verify Queue'),
          ]),
          if (_pendingListings > 0 || _openReports > 0) ...[
            const SizedBox(height: 16),
            const Text(
              'NEEDS ATTENTION',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  if (_pendingListings > 0)
                    _alertRow(
                      '$_pendingListings pending listing${_pendingListings > 1 ? 's' : ''} awaiting review',
                      Colors.amber,
                      () => setState(() {
                        _tab = _AdminTab.listings;
                        _listingStatusFilter = 'pending';
                      }),
                    ),
                  if (_openReports > 0)
                    _alertRow(
                      '$_openReports open report${_openReports > 1 ? 's' : ''} need action',
                      AppColors.error,
                      () => setState(() => _tab = _AdminTab.reports),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _statsRow(List<_Stat> stats) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: stats.map((s) {
          final isLast = stats.last == s;
          return Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                border: isLast
                    ? null
                    : const Border(
                        right: BorderSide(color: AppColors.border)),
              ),
              child: Column(
                children: [
                  Text(s.value,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      )),
                  const SizedBox(height: 2),
                  Text(s.label,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      )),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _alertRow(String msg, Color accentColor, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Text(
              msg,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: accentColor,
              ),
            ),
            const Spacer(),
            const Text(
              'View →',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.primaryBlue,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  Widget _buildUsers() {
    final q = _userSearchCtrl.text.trim().toLowerCase();
    final filtered = q.isEmpty
        ? _users
        : _users
            .where((u) =>
                '${u['name']}${u['email']}${u['phone']}'
                    .toLowerCase()
                    .contains(q))
            .toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: TextField(
            controller: _userSearchCtrl,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Search users...',
              hintStyle: const TextStyle(fontFamily: 'Inter', fontSize: 14),
              prefixIcon: const Icon(Icons.search, color: AppColors.textMuted),
              filled: true,
              fillColor: AppColors.card,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.border),
              ),
            ),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(
                  child: Text('No users found',
                      style: TextStyle(
                          fontFamily: 'Inter',
                          color: AppColors.textSecondary)))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _userCard(filtered[i]),
                ),
        ),
      ],
    );
  }

  Widget _userCard(Map<String, dynamic> u) {
    final isBanned = u['status'] == 'banned' || u['status'] == 'banned_temp';
    final isSuspended = u['status'] == 'banned_temp';
    final isAdmin = u['role'] == 'admin';
    final isVerified = u['verified'] == true;
    final userListings = _listings.where((l) => l['seller_id'] == u['id']).length;

    Color statusColor = AppColors.success;
    String statusLabel = 'Active';
    if (isSuspended) {
      statusColor = AppColors.orange;
      statusLabel = 'Suspended';
    } else if (isBanned) {
      statusColor = AppColors.error;
      statusLabel = 'Banned';
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Text(
                      u['name'] as String? ?? 'Unknown',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (isAdmin) ...[
                      const SizedBox(width: 4),
                      const Text('👑', style: TextStyle(fontSize: 14)),
                    ],
                    if (isVerified) ...[
                      const SizedBox(width: 4),
                      const Text('✓',
                          style: TextStyle(
                              color: AppColors.success,
                              fontWeight: FontWeight.w700)),
                    ],
                  ],
                ),
              ),
              _statusPill(statusLabel, statusColor),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${u['email'] ?? 'no email'} · ${u['phone'] ?? 'no phone'} · $userListings listings',
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (!isBanned) ...[
                _actionBtn('Suspend', AppColors.orange,
                    () => _banUser(u['id'] as String, permanent: false)),
                _actionBtn('Ban', AppColors.error,
                    () => _banUser(u['id'] as String, permanent: true)),
              ] else
                _actionBtn('Unban', AppColors.success,
                    () => _unbanUser(u['id'] as String)),
              if (!isVerified)
                _actionBtn('Verify', AppColors.primaryBlue, () async {
                  await _client.from('profiles').update({
                    'verified': true,
                  }).eq('id', u['id']);
                  _toast('${u['name']} verified');
                  await _loadUsers();
                }),
            ],
          ),
        ],
      ),
    );
  }

  // ── Listings ───────────────────────────────────────────────────────────────

  Widget _buildListings() {
    final q = _listingSearchCtrl.text.trim().toLowerCase();
    var filtered = _listingStatusFilter == 'all'
        ? _listings
        : _listings.where((l) => l['status'] == _listingStatusFilter).toList();
    if (q.isNotEmpty) {
      filtered = filtered
          .where((l) =>
              '${l['title']}${l['city']}'.toLowerCase().contains(q))
          .toList();
    }

    final counts = <String, int>{
      'all': _listings.length,
      'pending': _listings.where((l) => l['status'] == 'pending').length,
      'active': _listings.where((l) => l['status'] == 'active').length,
      'rejected': _listings.where((l) => l['status'] == 'rejected').length,
      'banned': _listings.where((l) => l['status'] == 'banned').length,
    };

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
          child: TextField(
            controller: _listingSearchCtrl,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Search listings...',
              hintStyle: const TextStyle(fontFamily: 'Inter', fontSize: 14),
              prefixIcon: const Icon(Icons.search, color: AppColors.textMuted),
              filled: true,
              fillColor: AppColors.card,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.border),
              ),
            ),
          ),
        ),
        // Status filter tabs
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Row(
            children: [
              for (final entry in [
                ('all', 'All (${counts['all']})'),
                ('pending', 'Pending (${counts['pending']})'),
                ('active', 'Active (${counts['active']})'),
                ('rejected', 'Rejected (${counts['rejected']})'),
                ('banned', 'Removed (${counts['banned']})'),
              ])
                GestureDetector(
                  onTap: () => setState(() => _listingStatusFilter = entry.$1),
                  child: Container(
                    margin: const EdgeInsets.only(right: 6),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: _listingStatusFilter == entry.$1
                          ? AppColors.primaryBlue
                          : AppColors.lightBlue,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      entry.$2,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: _listingStatusFilter == entry.$1
                            ? Colors.white
                            : AppColors.primaryBlue,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(
                  child: Text('No listings found',
                      style: TextStyle(
                          fontFamily: 'Inter',
                          color: AppColors.textSecondary)))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _listingCard(filtered[i]),
                ),
        ),
      ],
    );
  }

  Widget _listingCard(Map<String, dynamic> l) {
    final status = l['status'] as String? ?? 'unknown';
    Color statusColor;
    switch (status) {
      case 'active':
        statusColor = AppColors.success;
      case 'pending':
        statusColor = AppColors.orange;
      default:
        statusColor = AppColors.error;
    }
    final title = l['title'] as String? ?? 'Untitled';

    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(title,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    )),
              ),
              _statusPill(status, statusColor),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${l['city'] ?? ''} · ${l['created_at'] != null ? DateTime.parse(l['created_at'] as String).toLocal().toString().split(' ')[0] : ''}',
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                color: AppColors.textSecondary),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (status == 'pending') ...[
                _actionBtn('Approve', AppColors.success,
                    () => _approveListing(l['id'] as String)),
                _actionBtn('Reject', AppColors.error,
                    () => _rejectListing(l['id'] as String, title)),
              ],
              if (status == 'active')
                _actionBtn('Remove', AppColors.error,
                    () => _removeListing(l['id'] as String, title)),
              if (status != 'active' && status != 'pending')
                _actionBtn('Restore', AppColors.primaryBlue,
                    () => _restoreListing(l['id'] as String)),
            ],
          ),
        ],
      ),
    );
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  Widget _buildReports() {
    final filters = [
      ('all', 'All (${_reports.length})'),
      ('open', 'Open (${_reports.where((r) => r['status'] == 'open').length})'),
      ('resolved', 'Resolved'),
    ];

    final filtered = _reportFilter == 'all'
        ? _reports
        : _reports.where((r) => r['status'] == _reportFilter).toList();

    return Column(
      children: [
        // Filter tabs
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            children: filters
                .map((f) => GestureDetector(
                      onTap: () => setState(() => _reportFilter = f.$1),
                      child: Container(
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: _reportFilter == f.$1
                              ? AppColors.primaryBlue
                              : AppColors.lightBlue,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          f.$2,
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: _reportFilter == f.$1
                                ? Colors.white
                                : AppColors.primaryBlue,
                          ),
                        ),
                      ),
                    ))
                .toList(),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Text(
                    _reports.isEmpty ? 'No reports — All clear!' : 'Nothing here',
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        color: AppColors.textSecondary),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _reportCard(filtered[i]),
                ),
        ),
      ],
    );
  }

  Widget _reportCard(Map<String, dynamic> r) {
    final isOpen = r['status'] == 'open';
    final targetType = r['target_type'] as String? ?? '';
    final reason =
        r['reason'] as String? ?? r['description'] as String? ?? 'No reason given';
    final createdAt = r['created_at'] != null
        ? DateTime.parse(r['created_at'] as String).toLocal().toString().split(' ')[0]
        : '';
    final reporterName = (r['reporter'] as Map?)?['name'] as String? ?? 'User';

    return Opacity(
      opacity: isOpen ? 1.0 : 0.55,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    targetType == 'listing' ? 'Listing report' : 'User report',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                _statusPill(
                  r['status'] as String? ?? 'open',
                  isOpen ? AppColors.orange : AppColors.success,
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '$reason · $createdAt · by $reporterName',
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  color: AppColors.textSecondary),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (targetType == 'user' &&
                    r['target_id'] != null) ...[
                  _actionBtn(
                    'Suspend',
                    AppColors.orange,
                    () => _banUser(r['target_id'] as String,
                        permanent: false),
                  ),
                  _actionBtn(
                    'Ban',
                    AppColors.error,
                    () => _banUser(r['target_id'] as String,
                        permanent: true),
                  ),
                ],
                if (targetType == 'listing' &&
                    r['target_id'] != null)
                  _actionBtn(
                    'Remove Listing',
                    AppColors.error,
                    () => _removeListing(r['target_id'] as String,
                        'this listing'),
                  ),
                if (isOpen)
                  _actionBtn(
                    'Resolve',
                    AppColors.primaryBlue,
                    () => _resolveReport(r['id'] as String),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Verifications ──────────────────────────────────────────────────────────

  Widget _buildVerifications() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Stats
          _statsRow([
            _Stat('${_pendingVerifications.length}', 'Pending'),
            _Stat('${_verifiedUsers.length}', 'Verified'),
            _Stat('$_totalUsers', 'Total Users'),
          ]),
          const SizedBox(height: 16),
          const Text(
            'PENDING VERIFICATION REQUESTS',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 8),
          if (_pendingVerifications.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'No pending verification requests',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      color: AppColors.textSecondary,
                      fontSize: 14),
                ),
              ),
            )
          else
            ...(_pendingVerifications.map((u) => _verificationCard(u, pending: true))),
          const SizedBox(height: 16),
          const Text(
            'VERIFIED USERS',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 8),
          if (_verifiedUsers.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'No verified users yet',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      color: AppColors.textSecondary,
                      fontSize: 14),
                ),
              ),
            )
          else
            ...(_verifiedUsers
                .take(20)
                .map((u) => _verificationCard(u, pending: false))),
          const SizedBox(height: 90),
        ],
      ),
    );
  }

  Widget _verificationCard(Map<String, dynamic> u, {required bool pending}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.primaryBlue.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    _initials(u['name'] as String? ?? 'U'),
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryBlue,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          u['name'] as String? ?? 'Unknown',
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        if (!pending) ...[
                          const SizedBox(width: 6),
                          const Text(
                            '✓ Verified',
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 11,
                              color: AppColors.success,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                    Text(
                      '${u['email'] ?? ''} · ${u['phone'] ?? 'No phone'}',
                      style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (pending) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: AppColors.error),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () =>
                        _rejectVerification(u['id'] as String),
                    child: const Text('Reject',
                        style: TextStyle(fontFamily: 'Inter')),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () =>
                        _approveVerification(u['id'] as String),
                    child: const Text('Approve & Verify',
                        style: TextStyle(fontFamily: 'Inter')),
                  ),
                ),
              ],
            ),
          ] else ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: const BorderSide(color: AppColors.error),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () =>
                    _revokeVerification(u['id'] as String),
                child: const Text('Revoke',
                    style: TextStyle(fontFamily: 'Inter')),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Broadcast notifications ────────────────────────────────────────────────

  Widget _buildNotifications() {
    final targets = [
      ('all', 'All Users'),
      ('verified', 'Verified Users Only'),
      ('unverified', 'Unverified Users Only'),
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Send Broadcast',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(height: 16),
            // Target audience
            const Text('Target Audience',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary)),
            const SizedBox(height: 6),
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(10),
                color: AppColors.background,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _bcastTarget,
                  isExpanded: true,
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      color: AppColors.textPrimary),
                  items: targets
                      .map((t) => DropdownMenuItem(
                            value: t.$1,
                            child: Text(t.$2,
                                style:
                                    const TextStyle(fontFamily: 'Inter')),
                          ))
                      .toList(),
                  onChanged: (v) =>
                      setState(() => _bcastTarget = v ?? 'all'),
                ),
              ),
            ),
            const SizedBox(height: 14),
            const Text('Notification Title',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary)),
            const SizedBox(height: 6),
            TextField(
              controller: _bcastTitleCtrl,
              decoration: InputDecoration(
                hintText: 'e.g. New feature available',
                hintStyle: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    color: AppColors.textMuted),
                filled: true,
                fillColor: AppColors.background,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        const BorderSide(color: AppColors.border)),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        const BorderSide(color: AppColors.border)),
              ),
            ),
            const SizedBox(height: 14),
            const Text('Message',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary)),
            const SizedBox(height: 6),
            TextField(
              controller: _bcastMsgCtrl,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Write your message to all selected users...',
                hintStyle: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    color: AppColors.textMuted),
                filled: true,
                fillColor: AppColors.background,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        const BorderSide(color: AppColors.border)),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        const BorderSide(color: AppColors.border)),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _sendingBroadcast ? null : _sendBroadcast,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                icon: _sendingBroadcast
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2),
                      )
                    : const Icon(Icons.send_rounded, size: 18),
                label: Text(
                  _sendingBroadcast ? 'Sending…' : 'Send Broadcast',
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Logs ───────────────────────────────────────────────────────────────────

  Widget _buildLogs() {
    if (_adminLogs.isEmpty) {
      return const Center(
        child: Text('No logs yet',
            style: TextStyle(fontFamily: 'Inter', color: AppColors.textSecondary)),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _adminLogs.take(50).length,
      separatorBuilder: (_, __) =>
          const Divider(height: 1, color: AppColors.border),
      itemBuilder: (_, i) {
        final log = _adminLogs[i];
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                log['action'] as String? ?? '',
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textPrimary),
              ),
              const SizedBox(height: 2),
              Text(
                '${log['adminName'] ?? 'Admin'} · ${log['t'] != null ? DateTime.fromMillisecondsSinceEpoch(log['t'] as int).toString() : ''}',
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    color: AppColors.textMuted),
              ),
            ],
          ),
        );
      },
    );
  }

  // ── Shared widgets ─────────────────────────────────────────────────────────

  Widget _statusPill(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

enum _AdminTab { overview, users, listings, reports, verifications, notifications, logs }

class _Stat {
  final String value;
  final String label;
  const _Stat(this.value, this.label);
}

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty) return '?';
  if (parts.length == 1) return parts[0][0].toUpperCase();
  return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
}
