import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

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
          .from('notifications')
          .select()
          .eq('user_id', uid)
          .order('created_at', ascending: false)
          .limit(50);

      if (mounted) {
        setState(() {
          _notifications = (data as List)
              .map((row) => _AppNotification.fromMap(row))
              .toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load notifications.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _markAsRead(_AppNotification notif) async {
    if (notif.read) return;
    try {
      await _supabase
          .from('notifications')
          .update({'read': true}).eq('id', notif.id);
      if (mounted) {
        setState(() {
          final idx = _notifications.indexWhere((n) => n.id == notif.id);
          if (idx != -1) {
            _notifications[idx] = notif.copyWith(read: true);
          }
        });
      }
    } catch (_) {
      // Silently fail
    }
  }

  Future<void> _markAllRead() async {
    if (!AuthService.isSignedIn) return;
    try {
      await _supabase
          .from('notifications')
          .update({'read': true})
          .eq('user_id', AuthService.currentUserId!)
          .eq('read', false);
      if (mounted) {
        setState(() {
          _notifications = _notifications
              .map((n) => n.copyWith(read: true))
              .toList();
        });
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to mark all as read')),
        );
      }
    }
  }

  void _onTapNotification(_AppNotification notif) {
    _markAsRead(notif);
    // Navigate based on notification type
    switch (notif.type) {
      case 'message':
        if (notif.referenceId != null) {
          context.push('/chat/${notif.referenceId}');
        }
      case 'listing':
        if (notif.referenceId != null) {
          context.push('/listing/${notif.referenceId}');
        }
      case 'report':
        if (notif.referenceId != null) {
          context.push('/listing/${notif.referenceId}');
        }
      default:
        // system — no specific navigation
        break;
    }
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'message':
        return Icons.chat_outlined;
      case 'listing':
        return Icons.storefront_outlined;
      case 'report':
        return Icons.flag_outlined;
      default:
        return Icons.info_outline;
    }
  }

  Color _colorForType(String type) {
    switch (type) {
      case 'message':
        return AppColors.primaryBlue;
      case 'listing':
        return AppColors.success;
      case 'report':
        return AppColors.error;
      default:
        return AppColors.textSecondary;
    }
  }

  int get _unreadCount => _notifications.where((n) => !n.read).length;

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.notifications_none,
                    size: 72, color: AppColors.border),
                const SizedBox(height: 16),
                const Text(
                  'Sign in to view notifications',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () => context.push('/login'),
                  child: const Text('Sign In'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (_unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text(
                'Mark all read',
                style: TextStyle(
                  color: Colors.white,
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
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
              : _notifications.isEmpty
                  ? const _EmptyState()
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.primaryBlue,
                      child: ListView.separated(
                        itemCount: _notifications.length,
                        separatorBuilder: (_, __) => const Divider(
                            height: 1, color: AppColors.border),
                        itemBuilder: (_, i) {
                          final notif = _notifications[i];
                          return _NotificationTile(
                            notification: notif,
                            icon: _iconForType(notif.type),
                            iconColor: _colorForType(notif.type),
                            onTap: () => _onTapNotification(notif),
                          );
                        },
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
          Icon(Icons.notifications_none, size: 72, color: AppColors.border),
          SizedBox(height: 16),
          Text(
            'No notifications yet',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          SizedBox(height: 8),
          Text(
            "You're all caught up! Check back later.",
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

class _NotificationTile extends StatelessWidget {
  final _AppNotification notification;
  final IconData icon;
  final Color iconColor;
  final VoidCallback onTap;

  const _NotificationTile({
    required this.notification,
    required this.icon,
    required this.iconColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        color: notification.read
            ? AppColors.card
            : AppColors.lightBlue,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 20, color: iconColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (notification.title != null)
                    Text(
                      notification.title!,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: notification.read
                            ? FontWeight.w500
                            : FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  if (notification.body != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      notification.body!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    timeago.format(notification.createdAt),
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            if (!notification.read)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 4, left: 8),
                decoration: const BoxDecoration(
                  color: AppColors.primaryBlue,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _AppNotification {
  final String id;
  final String type;
  final String? title;
  final String? body;
  final String? referenceId;
  final bool read;
  final DateTime createdAt;

  const _AppNotification({
    required this.id,
    required this.type,
    this.title,
    this.body,
    this.referenceId,
    required this.read,
    required this.createdAt,
  });

  factory _AppNotification.fromMap(Map<String, dynamic> map) =>
      _AppNotification(
        id: map['id'] as String,
        type: map['type'] as String? ?? 'system',
        title: map['title'] as String?,
        body: map['body'] as String?,
        referenceId: map['reference_id'] as String?,
        read: map['read'] as bool? ?? false,
        createdAt: DateTime.parse(map['created_at'] as String),
      );

  _AppNotification copyWith({bool? read}) => _AppNotification(
        id: id,
        type: type,
        title: title,
        body: body,
        referenceId: referenceId,
        read: read ?? this.read,
        createdAt: createdAt,
      );
}
