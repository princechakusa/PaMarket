import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

class BlockedUsersScreen extends StatefulWidget {
  const BlockedUsersScreen({super.key});

  @override
  State<BlockedUsersScreen> createState() => _BlockedUsersScreenState();
}

class _BlockedUsersScreenState extends State<BlockedUsersScreen> {
  final _supabase = Supabase.instance.client;
  List<_BlockedUser> _blockedUsers = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (AuthService.isSignedIn) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final uid = AuthService.currentUserId!;
      final data = await _supabase
          .from('blocked_users')
          .select('blocked_id, profiles!blocked_id(name)')
          .eq('user_id', uid);

      if (mounted) {
        setState(() {
          _blockedUsers = (data as List).map((row) {
            final profiles = row['profiles'];
            final name = profiles != null
                ? (profiles['name'] as String? ?? 'Unknown User')
                : 'Unknown User';
            return _BlockedUser(
              blockedId: row['blocked_id'] as String,
              name: name,
            );
          }).toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load blocked users.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _unblock(_BlockedUser user) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Unblock User',
          style: TextStyle(
              fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 18),
        ),
        content: Text(
          'Unblock ${user.name}? They will be able to contact you again.',
          style: const TextStyle(
              fontFamily: 'Inter', color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Unblock'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _supabase
          .from('blocked_users')
          .delete()
          .eq('user_id', AuthService.currentUserId!)
          .eq('blocked_id', user.blockedId);
      if (mounted) {
        setState(() =>
            _blockedUsers.removeWhere((u) => u.blockedId == user.blockedId));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${user.name} has been unblocked'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to unblock user'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Blocked Users')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 56, color: AppColors.error),
                      const SizedBox(height: 12),
                      Text(_error!,
                          style: const TextStyle(
                              fontFamily: 'Inter',
                              color: AppColors.textSecondary)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                          onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : _blockedUsers.isEmpty
                  ? const _EmptyState()
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.primaryBlue,
                      child: ListView.separated(
                        padding:
                            const EdgeInsets.fromLTRB(16, 16, 16, 100),
                        itemCount: _blockedUsers.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 8),
                        itemBuilder: (_, i) => _BlockedUserTile(
                          user: _blockedUsers[i],
                          onUnblock: () => _unblock(_blockedUsers[i]),
                        ),
                      ),
                    ),
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
          Icon(Icons.check_circle_outline, size: 72, color: AppColors.border),
          SizedBox(height: 16),
          Text(
            'No blocked users',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          SizedBox(height: 8),
          Text(
            "You haven't blocked anyone yet.",
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _BlockedUserTile extends StatelessWidget {
  final _BlockedUser user;
  final VoidCallback onUnblock;

  const _BlockedUserTile({
    required this.user,
    required this.onUnblock,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: AppColors.lightBlue,
          radius: 22,
          child: Text(
            user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
            style: const TextStyle(
              fontFamily: 'Inter',
              fontWeight: FontWeight.w700,
              color: AppColors.primaryBlue,
            ),
          ),
        ),
        title: Text(
          user.name,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        trailing: TextButton(
          onPressed: onUnblock,
          style: TextButton.styleFrom(
            foregroundColor: AppColors.primaryBlue,
            textStyle: const TextStyle(
              fontFamily: 'Inter',
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
          child: const Text('Unblock'),
        ),
      ),
    );
  }
}

class _BlockedUser {
  final String blockedId;
  final String name;

  const _BlockedUser({required this.blockedId, required this.name});
}
