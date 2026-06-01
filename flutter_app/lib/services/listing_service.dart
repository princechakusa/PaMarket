import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/listing.dart';

class ListingService {
  static final _client = Supabase.instance.client;
  static const _uuid = Uuid();

  static Future<List<Listing>> fetchListings({
    String? category,
    String? searchQuery,
    String? province,
    String? city,
    double? maxPrice,
    String? currency,
    int limit = 30,
    int offset = 0,
  }) async {
    var query = _client
        .from('listings')
        .select('*, profiles(verified, avatar)')
        .eq('status', 'active');

    if (category != null && category != 'all') {
      query = query.eq('category', category);
    }
    if (province != null && province.isNotEmpty) {
      query = query.eq('province', province);
    }
    if (city != null && city.isNotEmpty) {
      query = query.ilike('city', '%$city%');
    }
    if (maxPrice != null) {
      query = query.lte('price', maxPrice);
    }
    if (searchQuery != null && searchQuery.isNotEmpty) {
      query = query.ilike('title', '%$searchQuery%');
    }

    final data = await query
        .order('created_at', ascending: false)
        .range(offset, offset + limit - 1);

    return (data as List).map((m) => Listing.fromMap(m)).toList();
  }

  static Future<List<Listing>> fetchUserListings(String userId) async {
    final data = await _client
        .from('listings')
        .select()
        .eq('seller_id', userId)
        .neq('status', 'deleted')
        .order('created_at', ascending: false);
    return (data as List).map((m) => Listing.fromMap(m)).toList();
  }

  static Future<Listing?> fetchListing(String id) async {
    final data = await _client
        .from('listings')
        .select('*, profiles(verified, avatar, name, phone)')
        .eq('id', id)
        .maybeSingle();
    if (data == null) return null;
    await _client.rpc('increment_listing_views', params: {'lid': id}).catchError((_) => null);
    return Listing.fromMap(data);
  }

  static Future<String> uploadPhoto(File file, String userId) async {
    final ext = file.path.split('.').last.toLowerCase();
    final name = '$userId/${_uuid.v4()}.$ext';
    await _client.storage.from('listings').upload(name, file);
    return _client.storage.from('listings').getPublicUrl(name);

  }

  static Future<Listing> createListing({
    required String title,
    required String description,
    required double price,
    required String currency,
    required String category,
    required String province,
    required String city,
    String suburb = '',
    String? condition,
    required List<String> photoUrls,
    required String sellerName,
    required String sellerPhone,
  }) async {
    final uid = _client.auth.currentUser!.id;
    final data = await _client
        .from('listings')
        .insert({
          'seller_id': uid,
          'seller_name': sellerName,
          'seller_phone': sellerPhone,
          'title': title,
          'description': description,
          'price': price,
          'currency': currency,
          'category': category,
          'province': province,
          'city': city,
          'suburb': suburb,
          'condition': condition,
          'photos': photoUrls,
        })
        .select()
        .single();
    return Listing.fromMap(data);
  }

  static Future<void> deleteListing(String id) async {
    await _client
        .from('listings')
        .update({'status': 'deleted'}).eq('id', id);
  }

  static Future<void> markSold(String id) async {
    await _client.from('listings').update({'status': 'sold'}).eq('id', id);
  }
}
