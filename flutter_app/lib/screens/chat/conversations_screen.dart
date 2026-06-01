import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../models/message.dart';
import '../../services/auth_service.dart';
import '../../services/chat_service.dart';
import '../../theme/app_theme.dart';

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

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Messages')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.chat_outlined, size: 64, color: AppColors.border),
              const SizedBox(height: 16),
              const Text('Sign in to view messages'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.push('/login'),
                child: const Text('Sign In'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _convos.isEmpty
              ? _EmptyChats()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    itemCount: _convos.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1, indent: 76),
                    itemBuilder: (_, i) => _ConvoTile(convo: _convos[i]),
                  ),
                ),
    );
  }
}

class _ConvoTile extends StatelessWidget {
  final Conversation convo;

  const _ConvoTile({required this.convo});

  @override
  Widget build(BuildContext context) {
    final hasUnread = convo.unreadCount > 0;

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      onTap: () => context.push('/chat/${convo.id}'),
      leading: Stack(
        clipBehavior: Clip.none,
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: AppColors.lightBlue,
            backgroundImage: convo.otherUserAvatar != null
                ? CachedNetworkImageProvider(convo.otherUserAvatar!)
                : null,
            child: convo.otherUserAvatar == null
                ? Text(
                    convo.otherUserName?.isNotEmpty == true
                        ? convo.otherUserName![0].toUpperCase()
                        : 'U',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryBlue,
                    ),
                  )
                : null,
          ),
          if (convo.otherUserVerified == true)
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
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              convo.otherUserName ?? 'User',
              style: TextStyle(
                fontFamily: 'Inter',
                fontWeight:
                    hasUnread ? FontWeight.w700 : FontWeight.w600,
                fontSize: 15,
              ),
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
                fontWeight: hasUnread ? FontWeight.w700 : FontWeight.w400,
              ),
            ),
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (convo.listingTitle != null)
            Text(
              convo.listingTitle!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                color: AppColors.orange,
                fontWeight: FontWeight.w600,
              ),
            ),
          Row(
            children: [
              Expanded(
                child: Text(
                  convo.lastMessage ?? 'Start a conversation',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    color: hasUnread
                        ? AppColors.textPrimary
                        : AppColors.textSecondary,
                    fontWeight: hasUnread ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
              if (hasUnread)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primaryBlue,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${convo.unreadCount}',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 10,
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmptyChats extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
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
                fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          const Text(
            'Message a seller to start chatting',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textSecondary),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () => context.go('/home'),
            child: const Text('Browse Listings'),
          ),
        ],
      ),
    );
  }
}
