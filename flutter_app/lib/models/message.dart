class Conversation {
  final String id;
  final String listingId;
  final String buyerId;
  final String sellerId;
  final String? lastMessage;
  final DateTime? lastMessageAt;
  final int unreadCount;
  final DateTime createdAt;

  // Joined
  final String? otherUserName;
  final String? otherUserAvatar;
  final bool? otherUserVerified;
  final String? listingTitle;
  final String? listingPhoto;

  const Conversation({
    required this.id,
    required this.listingId,
    required this.buyerId,
    required this.sellerId,
    this.lastMessage,
    this.lastMessageAt,
    required this.unreadCount,
    required this.createdAt,
    this.otherUserName,
    this.otherUserAvatar,
    this.otherUserVerified,
    this.listingTitle,
    this.listingPhoto,
  });

  factory Conversation.fromMap(Map<String, dynamic> map, String currentUserId) {
    final isBuyer = map['buyer_id'] == currentUserId;
    final otherProfile =
        isBuyer ? map['seller_profile'] : map['buyer_profile'];

    return Conversation(
      id: map['id'] as String,
      listingId: map['listing_id'] as String,
      buyerId: map['buyer_id'] as String,
      sellerId: map['seller_id'] as String,
      lastMessage: map['last_message'] as String?,
      lastMessageAt: map['last_message_at'] != null
          ? DateTime.parse(map['last_message_at'] as String)
          : null,
      unreadCount: map['unread_count'] as int? ?? 0,
      createdAt: DateTime.parse(map['created_at'] as String),
      otherUserName: otherProfile?['name'] as String?,
      otherUserAvatar: otherProfile?['avatar'] as String?,
      otherUserVerified: otherProfile?['verified'] as bool?,
      listingTitle: map['listing']?['title'] as String?,
      listingPhoto: map['listing']?['photos'] != null
          ? (map['listing']['photos'] as List).isNotEmpty
              ? (map['listing']['photos'] as List).first as String
              : null
          : null,
    );
  }
}

class Message {
  final String id;
  final String conversationId;
  final String senderId;
  final String? text;
  final String? imageUrl;
  final bool read;
  final DateTime createdAt;

  // Joined
  final String? senderName;
  final String? senderAvatar;

  const Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    this.text,
    this.imageUrl,
    required this.read,
    required this.createdAt,
    this.senderName,
    this.senderAvatar,
  });

  bool get isImage => imageUrl != null && imageUrl!.isNotEmpty;

  factory Message.fromMap(Map<String, dynamic> map) => Message(
        id: map['id'] as String,
        conversationId: map['conversation_id'] as String,
        senderId: map['sender_id'] as String,
        text: map['text'] as String?,
        imageUrl: map['image_url'] as String?,
        read: map['read'] as bool? ?? false,
        createdAt: DateTime.parse(map['created_at'] as String),
        senderName: map['profiles']?['name'] as String?,
        senderAvatar: map['profiles']?['avatar'] as String?,
      );
}
