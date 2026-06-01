import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/message.dart';

class ChatService {
  static final _client = Supabase.instance.client;
  static const _uuid = Uuid();

  static final _conversationSelect = '''
    *,
    buyer_profile:profiles!conversations_buyer_id_fkey(name, avatar, verified),
    seller_profile:profiles!conversations_seller_id_fkey(name, avatar, verified),
    listing:listings(title, photos)
  ''';

  // ── Conversations ──────────────────────────────────────────────────────

  static Future<List<Conversation>> fetchConversations() async {
    final uid = _client.auth.currentUser!.id;
    final data = await _client
        .from('conversations')
        .select(_conversationSelect)
        .or('buyer_id.eq.$uid,seller_id.eq.$uid')
        .order('last_message_at', ascending: false);

    return (data as List)
        .map((m) => Conversation.fromMap(m as Map<String, dynamic>, uid))
        .toList();
  }

  static Future<Conversation?> fetchConversation(String id) async {
    final uid = _client.auth.currentUser?.id;
    if (uid == null) return null;
    final data = await _client
        .from('conversations')
        .select(_conversationSelect)
        .eq('id', id)
        .maybeSingle();
    if (data == null) return null;
    return Conversation.fromMap(data as Map<String, dynamic>, uid);
  }

  static Future<Conversation?> findOrCreateConversation({
    required String listingId,
    required String sellerId,
  }) async {
    final uid = _client.auth.currentUser!.id;
    if (uid == sellerId) return null;

    final existing = await _client
        .from('conversations')
        .select(_conversationSelect)
        .eq('listing_id', listingId)
        .eq('buyer_id', uid)
        .eq('seller_id', sellerId)
        .maybeSingle();

    if (existing != null) {
      return Conversation.fromMap(
          existing as Map<String, dynamic>, uid);
    }

    final created = await _client
        .from('conversations')
        .insert({
          'listing_id': listingId,
          'buyer_id': uid,
          'seller_id': sellerId,
        })
        .select(_conversationSelect)
        .single();

    return Conversation.fromMap(created as Map<String, dynamic>, uid);
  }

  // ── Messages ───────────────────────────────────────────────────────────

  static Stream<List<Message>> messagesStream(String conversationId) {
    return _client
        .from('messages')
        .stream(primaryKey: ['id'])
        .eq('conversation_id', conversationId)
        .order('created_at')
        .map((data) =>
            data.map((m) => Message.fromMap(m as Map<String, dynamic>)).toList());
  }

  static Future<void> sendMessage({
    required String conversationId,
    String? text,
    String? imageUrl,
  }) async {
    final uid = _client.auth.currentUser!.id;
    final msgId = _uuid.v4();
    await _client.from('messages').insert({
      'id': msgId,
      'conversation_id': conversationId,
      'sender_id': uid,
      'text': text,
      'image_url': imageUrl,
      'read': false,
    });
    await _client.from('conversations').update({
      'last_message': text ?? '[Photo]',
      'last_sender_id': uid,
      'last_message_at': DateTime.now().toIso8601String(),
    }).eq('id', conversationId);
  }

  static Future<String> uploadChatImage(File file) async {
    final uid = _client.auth.currentUser!.id;
    final ext = file.path.split('.').last.toLowerCase();
    final name = '$uid/${_uuid.v4()}.$ext';
    await _client.storage
        .from('chat-images')
        .upload(name, file, fileOptions: const FileOptions(contentType: 'image/jpeg'));
    return _client.storage.from('chat-images').getPublicUrl(name);
  }

  // ── Read receipts ──────────────────────────────────────────────────────

  static Future<void> markRead(String conversationId) async {
    final uid = _client.auth.currentUser?.id;
    if (uid == null) return;
    await _client
        .from('messages')
        .update({'read': true})
        .eq('conversation_id', conversationId)
        .neq('sender_id', uid);
  }

  static Future<void> markAllRead() async {
    final uid = _client.auth.currentUser?.id;
    if (uid == null) return;
    // Fetch all conversation IDs for this user
    final convos = await _client
        .from('conversations')
        .select('id')
        .or('buyer_id.eq.$uid,seller_id.eq.$uid');
    if ((convos as List).isEmpty) return;
    final ids = convos.map((c) => c['id'] as String).toList();
    await _client
        .from('messages')
        .update({'read': true})
        .inFilter('conversation_id', ids)
        .neq('sender_id', uid);
  }

  // ── Delete (local soft-delete) ─────────────────────────────────────────

  /// Does NOT delete from Supabase — mirrors JS behaviour where the
  /// conversation is only removed from the current user's view.
  static Future<void> deleteConversation(String conversationId) async {
    // No-op on Supabase side; the UI simply removes it from the list.
    // If a server-side soft-delete column exists this is the place to set it.
  }

  // ── Unread count ───────────────────────────────────────────────────────

  static Future<int> unreadCount() async {
    final uid = _client.auth.currentUser?.id;
    if (uid == null) return 0;
    final convos = await _client
        .from('conversations')
        .select('id')
        .or('buyer_id.eq.$uid,seller_id.eq.$uid');
    if ((convos as List).isEmpty) return 0;
    final ids = convos.map((c) => c['id'] as String).toList();
    final msgs = await _client
        .from('messages')
        .select('id')
        .inFilter('conversation_id', ids)
        .eq('read', false)
        .neq('sender_id', uid);
    return (msgs as List).length;
  }
}
