import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../models/message.dart';
import '../../services/auth_service.dart';
import '../../services/chat_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_modal.dart';

class ConversationsScreen extends StatefulWidget {
  const ConversationsScreen({super.key});

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  List<Conversation> _convos = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!AuthService.isSignedIn) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final list = await ChatService.fetchConversations();
      if (mounted) {
        setState(() {
          _convos = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAllRead() async {
    try {
      await ChatService.markAllRead();
      await _load();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Messages')),
        body: _SignInRequired(
          onSignIn: () => showAuthModal(context, 'Sign in to view messages'),
        ),
      );
    }

    final totalUnread =
        _convos.fold<int>(0, (sum, c) => sum + c.unreadCount);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Messages'),
        backgroundColor: AppColors.primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primaryBlue,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  // Subtitle bar — conversation count + mark all read
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      child: Row(
                        mainAxisAlignment:
                            MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${_convos.length} conversation${_convos.length == 1 ? '' : 's'}',
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          if (totalUnread > 0)
                            GestureDetector(
                              onTap: _markAllRead,
                              child: const Text(
                                'Mark all read',
                                style: TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.primaryBlue,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),

                  if (_convos.isEmpty)
                    const SliverFillRemaining(
                      child: _EmptyChats(),
                    )
                  else
                    SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, i) {
                          final convo = _convos[i];
                          return _ConvoTile(
                            convo: convo,
                            onDelete: () async {
                              try {
                                await ChatService
                                    .deleteConversation(convo.id);
                                await _load();
                              } catch (_) {}
                            },
                          );
                        },
                        childCount: _convos.length,
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}

// ─── Conversation tile with swipe-to-delete ───────────────────────────────

class _ConvoTile extends StatelessWidget {
  final Conversation convo;
  final VoidCallback onDelete;

  const _ConvoTile({required this.convo, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final hasUnread = convo.unreadCount > 0;
    final name = convo.otherUserName ?? 'Deleted User';
    final initials = _initials(name);

    return Dismissible(
      key: ValueKey(convo.id),
      direction: DismissDirection.endToStart,
      background: Container(
        color: AppColors.error,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.delete_outline, color: Colors.white, size: 24),
            SizedBox(height: 4),
            Text(
              'Delete',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
      onDismissed: (_) => onDelete(),
      child: InkWell(
        onTap: () => context.push('/chat/${convo.id}'),
        child: Container(
          color: AppColors.card,
          padding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              // Avatar
              _Avatar(
                avatarUrl: convo.otherUserAvatar,
                initials: initials,
                verified: convo.otherUserVerified ?? false,
              ),
              const SizedBox(width: 12),

              // Body
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name + timestamp row
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 15,
                              fontWeight: hasUnread
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (convo.lastMessageAt != null)
                          Text(
                            timeago.format(convo.lastMessageAt!),
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 11,
                              color: hasUnread
                                  ? AppColors.primaryBlue
                                  : AppColors.textMuted,
                              fontWeight: hasUnread
                                  ? FontWeight.w700
                                  : FontWeight.w400,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),

                    // Last message preview + unread badge
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _previewText(convo),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              color: hasUnread
                                  ? AppColors.textPrimary
                                  : AppColors.textSecondary,
                              fontWeight: hasUnread
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                            ),
                          ),
                        ),
                        if (hasUnread)
                          Container(
                            margin: const EdgeInsets.only(left: 8),
                            width: 10,
                            height: 10,
                            decoration: const BoxDecoration(
                              color: AppColors.primaryBlue,
                              shape: BoxShape.circle,
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
      ),
    );
  }

  String _previewText(Conversation c) {
    if (c.lastMessage == null || c.lastMessage!.isEmpty) {
      return 'Start a conversation';
    }
    // If the current user sent the last message show "You: ..."
    final myId = AuthService.currentUserId;
    if (myId != null && c.lastSenderId == myId) {
      return 'You: ${c.lastMessage}';
    }
    return c.lastMessage!;
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

// ─── Avatar with gradient fallback ───────────────────────────────────────

class _Avatar extends StatelessWidget {
  final String? avatarUrl;
  final String initials;
  final bool verified;

  const _Avatar({
    required this.avatarUrl,
    required this.initials,
    required this.verified,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: const BoxDecoration(shape: BoxShape.circle),
          clipBehavior: Clip.antiAlias,
          child: avatarUrl != null
              ? CachedNetworkImage(
                  imageUrl: avatarUrl!,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => _InitialsAvatar(initials: initials),
                )
              : _InitialsAvatar(initials: initials),
        ),
        if (verified)
          Positioned(
            bottom: -2,
            right: -2,
            child: Container(
              padding: const EdgeInsets.all(2),
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.verified,
                  size: 14, color: AppColors.primaryBlue),
            ),
          ),
      ],
    );
  }
}

class _InitialsAvatar extends StatelessWidget {
  final String initials;
  const _InitialsAvatar({required this.initials});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1A3A8F), Color(0xFF2952CC)],
        ),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ─── Empty state ─────────────────────────────────────────────────────────

class _EmptyChats extends StatelessWidget {
  const _EmptyChats();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.chat_bubble_outline,
                size: 72, color: AppColors.border),
            const SizedBox(height: 16),
            const Text(
              'No messages yet',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'When buyers message you about a listing, it will show up here.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => context.go('/home'),
              child: const Text('Browse Listings'),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Sign-in required state ──────────────────────────────────────────────

class _SignInRequired extends StatelessWidget {
  final VoidCallback onSignIn;
  const _SignInRequired({required this.onSignIn});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.lock_outline,
                size: 64, color: AppColors.border),
            const SizedBox(height: 16),
            const Text(
              'Sign in required',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Sign in to view and send messages.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: onSignIn,
              child: const Text('Sign In'),
            ),
          ],
        ),
      ),
    );
  }
}
