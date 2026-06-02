import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_modal.dart';

// ── Data model ────────────────────────────────────────────────────────────────────────

class _AppNotification {
  final String id;
  final String type;
  final String title;
  final String body;
  final String? imageUrl;
  final String? deepLink;
  final bool read;
  final DateTime createdAt;

  const _AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.imageUrl,
    this.deepLink,
    required this.read,
    required this.createdAt,
  });

  factory _AppNotification.fromMap(Map<String, dynamic> m) {
    final meta = m['meta'] as Map<String, dynamic>?;
    final rawType = m['type'] as String? ?? '';
    final rawTitle = m['title'] as String? ?? '';
    return _AppNotification(
      id: m['id'] as String,
      type: _inferType(rawType, rawTitle),
      title: rawTitle,
      body: m['body'] as String? ?? '',
      imageUrl: (meta?['imageUrl'] as String?) ?? m['image_url'] as String?,
      deepLink: (meta?['deepLink'] as String?) ?? m['deep_link'] as String?,
      read: m['read'] as bool? ?? false,
      createdAt: DateTime.parse(m['created_at'] as String),
    );
  }

  _AppNotification copyWith({bool? read}) => _AppNotification(
        id: id,
        type: type,
        title: title,
        body: body,
        imageUrl: imageUrl,
        deepLink: deepLink,
        read: read ?? this.read,
        createdAt: createdAt,
      );

  static String _inferType(String type, String title) {
    if (type.isNotEmpty && type != 'system') return type;
    final t = title.toLowerCase();
    if (t.contains('boost') || t.contains('featured')) return 'boost';
    if (t.contains('verif')) return 'verify';
    if (t.contains('message') || t.contains('reply')) return 'message';
    if (t.contains('ban') || t.contains('suspend')) return 'ban';
    if (t.contains('report')) return 'report';
    if (t.contains('sold') ||
        t.contains('paid') ||
        t.contains('payment')) return 'sale';
    if (t.contains('review') || t.contains('appeal')) return 'review';
    return 'info';
  }
}

// ── Type → visual helpers ────────────────────────────────────────────────────────────────────

Color _notifColor(String type) {
  switch (type) {
    case 'boost':
      return const Color(0xFFF5A623);
    case 'verify':
      return const Color(0xFF1D9BF0);
    case 'message':
      return const Color(0xFF22C55E);
    case 'ban':
      return const Color(0xFFFF3B30);
    case 'report':
      return const Color(0xFFFF9500);
    case 'sale':
      return const Color(0xFF007AFF);
    case 'review':
      return const Color(0xFF8B5CF6);
    default:
      return AppColors.primaryBlue;
  }
}

Color _notifBg(String type) {
  switch (type) {
    case 'boost':
      return const Color(0xFFF5A623).withValues(alpha: 0.12);
    case 'verify':
      return const Color(0xFF1D9BF0).withValues(alpha: 0.12);
    case 'message':
      return const Color(0xFF22C55E).withValues(alpha: 0.12);
    case 'ban':
      return const Color(0xFFFF3B30).withValues(alpha: 0.12);
    case 'report':
      return const Color(0xFFFF9500).withValues(alpha: 0.12);
    case 'sale':
      return const Color(0xFF007AFF).withValues(alpha: 0.12);
    case 'review':
      return const Color(0xFF8B5CF6).withValues(alpha: 0.12);
    default:
      return AppColors.lightBlue;
  }
}

IconData _notifIcon(String type) {
  switch (type) {
    case 'boost':
      return Icons.bolt_outlined;
    case 'verify':
      return Icons.verified_user_outlined;
    case 'message':
      return Icons.mail_outlined;
    case 'ban':
      return Icons.block_outlined;
    case 'report':
      return Icons.flag_outlined;
    case 'sale':
      return Icons.attach_money_outlined;
    case 'review':
      return Icons.description_outlined;
    default:
      return Icons.notifications_outlined;
  }
}

String _navHint(String type, String? deepLink) {
  if (type == 'message') return 'Open Messages ›';
  if (type == 'sale') return 'Open Account ›';
  if (deepLink != null && deepLink.isNotEmpty) return 'Tap to open ›';
  if (type == 'info') return 'Tap to view ›';
  return 'Open ›';
}

// ── Screen ─────────────────────────────────────────────────────────────────────────────

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _supabase = Supabase.instance.client;
  List<_AppNotification> _notifications = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (AuthService.isSignedIn) {
      _load();
    } else {
      setState(() => _loading = false);
    }
  }

  // ── Data loading ────────────────────────────────────────────────────────────────────

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final uid = AuthService.currentUserId!;
      final data = await _supabase
          .from('notifications')
          .select()
          .eq('user_id', uid)
          .order('created_at', ascending: false)
          .limit(100);

      if (!mounted) return;

      final notifs = (data as List)
          .map((row) =>
              _AppNotification.fromMap(row as Map<String, dynamic>))
          .toList();

      // Mark all as read on page open (mirrors pages.Notifications_after)
      final hadUnread = notifs.any((n) => !n.read);
      setState(() {
        _notifications = notifs.map((n) => n.copyWith(read: true)).toList();
        _loading = false;
      });
      if (hadUnread) {
        _supabase
            .from('notifications')
            .update({'read': true})
            .eq('user_id', uid)
            .eq('read', false)
            .then((_) {})
            .catchError((_) {});
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load notifications.';
          _loading = false;
        });
      }
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────────────────

  Future<void> _markAsRead(_AppNotification notif) async {
    if (notif.read) return;
    final idx = _notifications.indexWhere((n) => n.id == notif.id);
    if (idx == -1) return;
    setState(() => _notifications[idx] = notif.copyWith(read: true));
    _supabase
        .from('notifications')
        .update({'read': true})
        .eq('id', notif.id)
        .then((_) {})
        .catchError((_) {});
  }

  Future<void> _markAllRead() async {
    final hasUnread = _notifications.any((n) => !n.read);
    if (!hasUnread) {
      _toast('No unread notifications');
      return;
    }
    setState(() {
      _notifications =
          _notifications.map((n) => n.copyWith(read: true)).toList();
    });
    _toast('Marked all as read');
    if (AuthService.isSignedIn) {
      _supabase
          .from('notifications')
          .update({'read': true})
          .eq('user_id', AuthService.currentUserId!)
          .eq('read', false)
          .then((_) {})
          .catchError((_) {});
    }
  }

  Future<void> _deleteNotif(_AppNotification notif) async {
    setState(() => _notifications.removeWhere((n) => n.id == notif.id));
    _supabase
        .from('notifications')
        .delete()
        .eq('id', notif.id)
        .then((_) {})
        .catchError((_) {});
  }

  Future<void> _clearAll() async {
    if (_notifications.isEmpty) {
      _toast('No notifications to clear');
      return;
    }
    final ids = _notifications.map((n) => n.id).toList();
    setState(() => _notifications = []);
    _toast('Cleared all notifications');
    if (AuthService.isSignedIn) {
      _supabase
          .from('notifications')
          .delete()
          .eq('user_id', AuthService.currentUserId!)
          .inFilter('id', ids)
          .then((_) {})
          .catchError((_) {});
    }
  }

  void _onTap(_AppNotification notif) {
    _markAsRead(notif);
    final link = notif.deepLink;
    final type = notif.type;

    // Deep-link: listing detail
    if (link != null && link.isNotEmpty) {
      final m = RegExp(r'[?&]id=([a-zA-Z0-9_-]+)').firstMatch(link);
      if (m != null) {
        context.push('/listing/${m.group(1)}');
        return;
      }
    }

    // Type-based navigation (mirrors H._notifNavigate)
    switch (type) {
      case 'message':
        context.go('/messages');
      case 'sale':
        context.go('/profile');
      case 'boost':
      case 'verify':
      case 'review':
      case 'ban':
      case 'report':
        context.go('/profile');
      default:
        context.go('/');
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

  int get _unreadCount => _notifications.where((n) => !n.read).length;

  // ── Build ───────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn) {
      return _buildUnauthenticated();
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: _buildAppBar(),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primaryBlue))
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primaryBlue,
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      if (_notifications.isNotEmpty)
                        SliverToBoxAdapter(child: _buildClearBar()),
                      _notifications.isEmpty
                          ? const SliverFillRemaining(
                              hasScrollBody: false, child: _EmptyState())
                          : SliverList(
                              delegate: SliverChildBuilderDelegate(
                                (_, i) => _NotificationTile(
                                  notification: _notifications[i],
                                  onTap: () => _onTap(_notifications[i]),
                                  onDelete: () =>
                                      _deleteNotif(_notifications[i]),
                                ),
                                childCount: _notifications.length,
                              ),
                            ),
                      SliverToBoxAdapter(child: _buildSettingsSection()),
                    ],
                  ),
                ),
    );
  }

  Widget _buildUnauthenticated() {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Notifications',
          style: TextStyle(
              fontFamily: 'Inter', fontSize: 17, fontWeight: FontWeight.w700),
        ),
        actions: const [SizedBox(width: 34)],
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.notifications_outlined,
                size: 48,
                color: AppColors.textMuted.withValues(alpha: 0.4),
              ),
              const SizedBox(height: 16),
              const Text(
                'No notifications yet',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Important updates and app notices will appear here.\nLog in to see account alerts.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 32, vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () => showAuthModal(context, 'Login to continue'),
                child: const Text(
                  'Login to continue',
                  style: TextStyle(
                      fontFamily: 'Inter', fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  AppBar _buildAppBar() {
    final uc = _unreadCount;
    return AppBar(
      backgroundColor: AppColors.primaryBlue,
      foregroundColor: Colors.white,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
        onPressed: () => context.pop(),
      ),
      title: Row(
        children: [
          const Text(
            'Notifications',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 17,
                fontWeight: FontWeight.w700),
          ),
          if (uc > 0) ...[
            const SizedBox(width: 8),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.orange,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                uc > 9 ? '9+' : '$uc',
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primaryBlue,
                ),
              ),
            ),
          ],
        ],
      ),
      actions: [
        if (uc > 0)
          TextButton(
            onPressed: _markAllRead,
            child: const Text(
              'Mark all read',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          )
        else
          const SizedBox(width: 34),
      ],
    );
  }

  Widget _buildClearBar() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.card,
        border:
            Border(bottom: BorderSide(color: AppColors.border)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          TextButton.icon(
            onPressed: _clearAll,
            icon: const Icon(Icons.delete_outline,
                size: 13, color: AppColors.textSecondary),
            label: const Text(
              'Clear all',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline,
              size: 48, color: AppColors.error),
          const SizedBox(height: 12),
          Text(_error!,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  color: AppColors.textSecondary)),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: _load, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _buildSettingsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 20, 16, 8),
          child: Text(
            'NOTIFICATION SETTINGS',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
              letterSpacing: 0.6,
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: ListTile(
            leading: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.lightBlue,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.notifications_outlined,
                  color: AppColors.primaryBlue, size: 20),
            ),
            title: const Text(
              'Notification Preferences',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            trailing: const Text('›',
                style: TextStyle(
                    fontSize: 20,
                    color: AppColors.textSecondary,
                    height: 1)),
            onTap: () {
              // Navigate to NotifSettings screen when available
            },
          ),
        ),
        const SizedBox(height: 90),
      ],
    );
  }
}

// ── Empty state ─────────────────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 60),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.notifications_outlined,
            size: 48,
            color: AppColors.textMuted.withValues(alpha: 0.4),
          ),
          const SizedBox(height: 16),
          const Text(
            'No notifications yet',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            "You'll be notified about messages, saves,\nand activity on your listings.",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Notification tile ─────────────────────────────────────────────────────────────────────────────

class _NotificationTile extends StatelessWidget {
  final _AppNotification notification;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  const _NotificationTile({
    required this.notification,
    required this.onTap,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final n = notification;
    final color = _notifColor(n.type);

    return Stack(
      children: [
        InkWell(
          onTap: onTap,
          child: Container(
            color: n.read
                ? AppColors.card
                : const Color(0xFF1A3A8F).withValues(alpha: 0.04),
            padding: const EdgeInsets.fromLTRB(16, 14, 40, 14),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Image or icon
                    if (n.imageUrl != null && n.imageUrl!.isNotEmpty)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.network(
                          n.imageUrl!,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _iconBubble(color),
                        ),
                      )
                    else
                      _iconBubble(color),

                    const SizedBox(width: 12),

                    // Text
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (n.title.isNotEmpty)
                            Text(
                              n.title,
                              style: TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 14,
                                fontWeight: n.read
                                    ? FontWeight.w600
                                    : FontWeight.w800,
                                color: AppColors.textPrimary,
                                height: 1.3,
                              ),
                            ),
                          if (n.body.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Text(
                              n.body,
                              style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 13,
                                color: AppColors.textSecondary,
                                height: 1.5,
                              ),
                            ),
                          ],
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Text(
                                timeago.format(n.createdAt),
                                style: const TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 11,
                                  color: AppColors.textMuted,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _navHint(n.type, n.deepLink),
                                style: TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: color,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Unread dot
                    if (!n.read)
                      Container(
                        width: 9,
                        height: 9,
                        margin: const EdgeInsets.only(top: 6),
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                const Divider(height: 1, color: AppColors.border),
              ],
            ),
          ),
        ),

        // Delete button — absolutely positioned at right centre
        Positioned(
          right: 10,
          top: 0,
          bottom: 0,
          child: Center(
            child: GestureDetector(
              onTap: onDelete,
              child: Opacity(
                opacity: 0.55,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  child: const Icon(
                    Icons.delete_outline,
                    size: 15,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _iconBubble(Color color) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: _notifBg(notification.type),
        shape: BoxShape.circle,
      ),
      child: Icon(_notifIcon(notification.type), size: 18, color: color),
    );
  }
}
