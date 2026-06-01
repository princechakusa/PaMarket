import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/message.dart';

class ChatService {
  static final _client = Supabase.instance.client;
  static const _uuid = Uuid();

  static Future<List<Conversation>> fetchConversations() async {
    final uid = _client.auth.currentUser!.id;
    final data = await _client
        .from('conversations')
        .select('''
          *,
          buyer_profile:profiles!conversations_buyer_id_fkey(name, avatar, verified),
          seller_profile:profiles!conversations_seller_id_fkey(name, avatar, verified),
          listing:listings(title, photos)
        ''')
        .or('buyer_id.eq.$uid,seller_id.eq.$uid')
        .order('last_message_at', ascending: false);

    return (data as List)
        .map((m) => Conversation.fromMap(m, uid))
        .toList();
  }

  static Future<Conversation?> findOrCreateConversation({
    required String listingId,
    required String sellerId,
  }) async {
    final uid = _client.auth.currentUser!.id;
    if (uid == sellerId) return null;

    final existing = await _client
        .from('conversations')
        .select('''
          *,
          buyer_profile:profiles!conversations_buyer_id_fkey(name, avatar, verified),
          seller_profile:profiles!conversations_seller_id_fkey(name, avatar, verified),
          listing:listings(title, photos)
        ''')
        .eq('listing_id', listingId)
        .eq('buyer_id', uid)
        .eq('seller_id', sellerId)
        .maybeSingle();

    if (existing != null) return Conversation.fromMap(existing, uid);

    final created = await _client
        .from('conversations')
        .insert({
          'listing_id': listingId,
          'buyer_id': uid,
          'seller_id': sellerId,
        })
        .select('''
          *,
          buyer_profile:profiles!conversations_buyer_id_fkey(name, avatar, verified),
          seller_profile:profiles!conversations_seller_id_fkey(name, avatar, verified),
          listing:listings(title, photos)
        ''')
        .single();

    return Conversation.fromMap(created, uid);
  }

  static Stream<List<Message>> messagesStream(String conversationId) {
    return _client
        .from('messages')
        .stream(primaryKey: ['id'])
        .eq('conversation_id', conversationId)
        .order('created_at')
        .map((data) => data.map((m) => Message.fromMap(m)).toList());
  }

  static Future<void> sendMessage({
    required String conversationId,
    String? text,
    String? imageUrl,
  }) async {
    final uid = _client.auth.currentUser!.id;
    await _client.from('messages').insert({
      'conversation_id': conversationId,
      'sender_id': uid,
      'text': text,
      'image_url': imageUrl,
      'read': false,
    });
    await _client.from('conversations').update({
      'last_message': text ?? '📷 Photo',
      'last_message_at': DateTime.now().toIso8601String(),
    }).eq('id', conversationId);
  }

  static Future<String> uploadChatImage(File file) async {
    final uid = _client.auth.currentUser!.id;
    final ext = file.path.split('.').last.toLowerCase();
    final name = '$uid/${_uuid.v4()}.$ext';
    await _client.storage.from('chat-images').upload(name, file);
    return _client.storage.from('chat-images').getPublicUrl(name);
  }

  static Future<void> markRead(String conversationId) async {
    final uid = _client.auth.currentUser!.id;
    await _client
        .from('messages')
        .update({'read': true})
        .eq('conversation_id', conversationId)
        .neq('sender_id', uid);
  }

  static Future<int> unreadCount() async {
    final uid = _client.auth.currentUser!.id;
    final convos = await _client
        .from('conversations')
        .select('id')
        .or('buyer_id.eq.$uid,seller_id.eq.$uid');

    if (convos.isEmpty) return 0;
    final ids = (convos as List).map((c) => c['id']).toList();
    final msgs = await _client
        .from('messages')
        .select('id')
        .inFilter('conversation_id', ids)
        .eq('read', false)
        .neq('sender_id', uid);
    return (msgs as List).length;
  }
}
