import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:photo_view/photo_view.dart';
import '../../models/message.dart';
import '../../services/auth_service.dart';
import '../../services/chat_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_modal.dart';

class ChatScreen extends StatefulWidget {
  final String conversationId;
  final String? otherUserName;

  const ChatScreen({
    super.key,
    required this.conversationId,
    this.otherUserName,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _textCtrl = TextEditingController();
  final _scroll = ScrollController();
  bool _sending = false;

  // Conversation metadata loaded once
  Conversation? _convo;

  @override
  void initState() {
    super.initState();
    // Mark all received messages as read when chat opens
    ChatService.markRead(widget.conversationId).catchError((_) {});
    _loadConversation();
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadConversation() async {
    try {
      final c = await ChatService.fetchConversation(widget.conversationId);
      if (mounted) setState(() => _convo = c);
    } catch (_) {}
  }

  void _scrollToBottom({bool animated = true}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        if (animated) {
          _scroll.animateTo(
            _scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
          );
        } else {
          _scroll.jumpTo(_scroll.position.maxScrollExtent);
        }
      }
    });
  }

  Future<void> _send({String? text, String? imageUrl}) async {
    final t = text?.trim();
    if (t != null && t.isEmpty && imageUrl == null) return;
    if (!AuthService.isSignedIn) {
      showAuthModal(context, 'Sign in to send messages');
      return;
    }
    setState(() => _sending = true);
    try {
      await ChatService.sendMessage(
        conversationId: widget.conversationId,
        text: t,
        imageUrl: imageUrl,
      );
      _textCtrl.clear();
      _scrollToBottom();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Message could not be sent. Check your connection and try again.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _pickImage() async {
    if (!AuthService.isSignedIn) {
      showAuthModal(context, 'Sign in to send photos');
      return;
    }
    // Show bottom sheet: camera or gallery
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'Send a photo',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined,
                  color: AppColors.primaryBlue),
              title: const Text('Take Photo',
                  style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w600)),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined,
                  color: AppColors.primaryBlue),
              title: const Text('Choose from Gallery',
                  style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w600)),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.close, color: AppColors.textMuted),
              title: const Text('Cancel',
                  style: TextStyle(fontFamily: 'Inter', color: AppColors.textMuted)),
              onTap: () => Navigator.pop(ctx),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (source == null) return;

    final picker = ImagePicker();
    final xf = await picker.pickImage(source: source, imageQuality: 75);
    if (xf == null) return;

    setState(() => _sending = true);
    try {
      final url = await ChatService.uploadChatImage(File(xf.path));
      await _send(imageUrl: url);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not send photo. Please try again.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _openMenu() {
    final otherId = _convo?.otherId;
    if (otherId == null) return;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.person_outline,
                  color: AppColors.primaryBlue),
              title: const Text('View Profile & Listings',
                  style: TextStyle(
                      fontFamily: 'Inter', fontWeight: FontWeight.w600)),
              onTap: () {
                Navigator.pop(ctx);
                context.push('/profile/$otherId');
              },
            ),
            ListTile(
              leading: const Icon(Icons.block, color: AppColors.error),
              title: const Text('Block User',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w600,
                      color: AppColors.error)),
              onTap: () {
                Navigator.pop(ctx);
                // Block action — navigate back
                context.pop();
              },
            ),
            ListTile(
              leading:
                  const Icon(Icons.flag_outlined, color: AppColors.textMuted),
              title: const Text('Report',
                  style: TextStyle(
                      fontFamily: 'Inter', fontWeight: FontWeight.w600)),
              onTap: () => Navigator.pop(ctx),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn) {
      return Scaffold(
        appBar: AppBar(
          title: Text(widget.otherUserName ?? 'Chat'),
          leading: const BackButton(),
        ),
        body: Center(
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
                  onPressed: () =>
                      showAuthModal(context, 'Sign in to view messages'),
                  child: const Text('Sign In'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final displayName =
        _convo?.otherUserName ?? widget.otherUserName ?? 'Chat';
    final otherAvatar = _convo?.otherUserAvatar;
    final isVerified = _convo?.otherUserVerified ?? false;
    final listingTitle = _convo?.listingTitle;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
        title: GestureDetector(
          onTap: () {
            final otherId = _convo?.otherId;
            if (otherId != null) context.push('/profile/$otherId');
          },
          child: Row(
            children: [
              // Avatar
              Container(
                width: 36,
                height: 36,
                clipBehavior: Clip.antiAlias,
                decoration: const BoxDecoration(shape: BoxShape.circle),
                child: otherAvatar != null
                    ? CachedNetworkImage(
                        imageUrl: otherAvatar,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) =>
                            _InlineInitials(name: displayName),
                      )
                    : _InlineInitials(name: displayName),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    if (isVerified)
                      Row(
                        children: const [
                          Icon(Icons.check_circle,
                              size: 10, color: Color(0xFF4ade80)),
                          SizedBox(width: 3),
                          Text(
                            'Verified',
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 10,
                              color: Color(0xFF4ade80),
                            ),
                          ),
                        ],
                      )
                    else
                      const Text(
                        'Tap to view profile',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 10,
                          color: Colors.white70,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_horiz_rounded),
            onPressed: _openMenu,
          ),
        ],
        titleSpacing: 0,
      ),
      body: Column(
        children: [
          // Listing context strip
          if (listingTitle != null)
            Container(
              width: double.infinity,
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.lightBlue,
                border: const Border(
                    bottom: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.monitor_outlined,
                      size: 13, color: AppColors.primaryBlue),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      listingTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: AppColors.primaryBlue,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // Messages thread
          Expanded(
            child: StreamBuilder<List<Message>>(
              stream: ChatService.messagesStream(widget.conversationId),
              builder: (_, snap) {
                if (!snap.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final messages = snap.data!;

                // Mark incoming messages read
                ChatService.markRead(widget.conversationId)
                    .catchError((_) {});

                if (messages.isEmpty) {
                  return const Center(
                    child: Text(
                      'No messages yet. Say hello!',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  );
                }

                _scrollToBottom(animated: false);

                return ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  itemCount: messages.length,
                  itemBuilder: (_, i) {
                    final msg = messages[i];
                    final isMe =
                        msg.senderId == AuthService.currentUserId;
                    return _MessageBubble(
                      message: msg,
                      isMe: isMe,
                      otherAvatar: otherAvatar,
                      otherName: displayName,
                    );
                  },
                );
              },
            ),
          ),

          // Input bar
          Container(
            padding: EdgeInsets.fromLTRB(
                12,
                8,
                12,
                8 + MediaQuery.of(context).padding.bottom),
            decoration: const BoxDecoration(
              color: AppColors.card,
              border:
                  Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // Attach / plus button
                InkWell(
                  onTap: _sending ? null : _pickImage,
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    width: 38,
                    height: 38,
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.add_circle_outline,
                      color: AppColors.primaryBlue,
                      size: 24,
                    ),
                  ),
                ),
                const SizedBox(width: 6),

                // Text input
                Expanded(
                  child: TextField(
                    controller: _textCtrl,
                    maxLines: 4,
                    minLines: 1,
                    textInputAction: TextInputAction.send,
                    keyboardType: TextInputType.text,
                    autocorrect: false,
                    enableSuggestions: false,
                    onSubmitted: (t) => _send(text: t),
                    decoration: InputDecoration(
                      hintText: 'Type a message…',
                      hintStyle: const TextStyle(
                        fontFamily: 'Inter',
                        color: AppColors.textMuted,
                        fontSize: 14,
                      ),
                      filled: true,
                      fillColor: AppColors.background,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(20),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(width: 8),

                // Send button
                GestureDetector(
                  onTap: _sending
                      ? null
                      : () => _send(text: _textCtrl.text),
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: _sending
                          ? AppColors.border
                          : AppColors.primaryBlue,
                      shape: BoxShape.circle,
                    ),
                    child: _sending
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white),
                          )
                        : const Icon(
                            Icons.send_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Inline initials widget for AppBar avatar ─────────────────────────────

class _InlineInitials extends StatelessWidget {
  final String name;
  const _InlineInitials({required this.name});

  static String _initials(String n) {
    final parts = n.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

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
        _initials(name),
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ─── Message bubble ───────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe;
  final String? otherAvatar;
  final String otherName;

  const _MessageBubble({
    required this.message,
    required this.isMe,
    required this.otherAvatar,
    required this.otherName,
  });

  static String _initials(String n) {
    final parts = n.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          // Other-user avatar (left side)
          if (!isMe) ...
            [
              Container(
                width: 28,
                height: 28,
                margin: const EdgeInsets.only(right: 6, bottom: 2),
                clipBehavior: Clip.antiAlias,
                decoration: const BoxDecoration(shape: BoxShape.circle),
                child: otherAvatar != null
                    ? CachedNetworkImage(
                        imageUrl: otherAvatar!,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => _AvatarFallback(
                            initials: _initials(otherName)),
                      )
                    : _AvatarFallback(initials: _initials(otherName)),
              ),
            ],

          // Bubble
          Container(
            constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.72),
            decoration: BoxDecoration(
              color: isMe ? AppColors.primaryBlue : AppColors.card,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isMe ? 16 : 4),
                bottomRight: Radius.circular(isMe ? 4 : 16),
              ),
              border:
                  isMe ? null : Border.all(color: AppColors.border),
            ),
            child: message.isImage
                ? _ImageMessage(url: message.imageUrl!, isMe: isMe)
                : Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    child: Column(
                      crossAxisAlignment: isMe
                          ? CrossAxisAlignment.end
                          : CrossAxisAlignment.start,
                      children: [
                        Text(
                          message.text ?? '',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            color: isMe
                                ? Colors.white
                                : AppColors.textPrimary,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _formatTime(message.createdAt),
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 10,
                            color: isMe
                                ? Colors.white60
                                : AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class _AvatarFallback extends StatelessWidget {
  final String initials;
  const _AvatarFallback({required this.initials});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1A3A8F), Color(0xFF2952CC)],
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ─── Image message ────────────────────────────────────────────────────────

class _ImageMessage extends StatelessWidget {
  final String url;
  final bool isMe;

  const _ImageMessage({required this.url, required this.isMe});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => Scaffold(
            backgroundColor: Colors.black,
            appBar: AppBar(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              elevation: 0,
            ),
            body:
                PhotoView(imageProvider: CachedNetworkImageProvider(url)),
          ),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(16),
          topRight: const Radius.circular(16),
          bottomLeft: Radius.circular(isMe ? 16 : 4),
          bottomRight: Radius.circular(isMe ? 4 : 16),
        ),
        child: CachedNetworkImage(
          imageUrl: url,
          width: 220,
          height: 200,
          fit: BoxFit.cover,
          errorWidget: (_, __, ___) => Container(
            width: 220,
            height: 200,
            color: AppColors.border,
            child: const Icon(Icons.broken_image_outlined,
                color: AppColors.textMuted, size: 40),
          ),
        ),
      ),
    );
  }
}
