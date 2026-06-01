class Listing {
  final String id;
  final String sellerId;
  final String sellerName;
  final String sellerPhone;
  final String title;
  final String description;
  final double price;
  final String currency;
  final String category;
  final String province;
  final String city;
  final String suburb;
  final List<String> photos;
  final String status;
  final String? condition;
  final int views;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Joined fields
  final bool? sellerVerified;
  final String? sellerAvatar;

  const Listing({
    required this.id,
    required this.sellerId,
    required this.sellerName,
    required this.sellerPhone,
    required this.title,
    required this.description,
    required this.price,
    required this.currency,
    required this.category,
    required this.province,
    required this.city,
    required this.suburb,
    required this.photos,
    required this.status,
    this.condition,
    required this.views,
    required this.createdAt,
    required this.updatedAt,
    this.sellerVerified,
    this.sellerAvatar,
  });

  String get formattedPrice {
    if (price == 0) return 'Negotiable';
    final symbol = currency == 'USD' ? '\$' : 'ZiG';
    if (price >= 1000) {
      return '$symbol${(price / 1000).toStringAsFixed(1)}k';
    }
    return '$symbol${price.toStringAsFixed(price == price.truncate() ? 0 : 2)}';
  }

  String get locationDisplay {
    if (city.isNotEmpty && province.isNotEmpty) return '$city, $province';
    return city.isNotEmpty ? city : province;
  }

  factory Listing.fromMap(Map<String, dynamic> map) => Listing(
        id: map['id'] as String,
        sellerId: map['seller_id'] as String,
        sellerName: map['seller_name'] as String? ?? '',
        sellerPhone: map['seller_phone'] as String? ?? '',
        title: map['title'] as String,
        description: map['description'] as String? ?? '',
        price: (map['price'] as num?)?.toDouble() ?? 0,
        currency: map['currency'] as String? ?? 'USD',
        category: map['category'] as String? ?? 'other',
        province: map['province'] as String? ?? '',
        city: map['city'] as String? ?? '',
        suburb: map['suburb'] as String? ?? '',
        photos: List<String>.from(map['photos'] as List? ?? []),
        status: map['status'] as String? ?? 'active',
        condition: map['condition'] as String?,
        views: map['views'] as int? ?? 0,
        createdAt: DateTime.parse(
            map['created_at'] as String? ?? DateTime.now().toIso8601String()),
        updatedAt: DateTime.parse(
            map['updated_at'] as String? ?? DateTime.now().toIso8601String()),
        sellerVerified: map['profiles'] != null
            ? map['profiles']['verified'] as bool?
            : null,
        sellerAvatar: map['profiles'] != null
            ? map['profiles']['avatar'] as String?
            : null,
      );

  Map<String, dynamic> toInsertMap() => {
        'title': title,
        'description': description,
        'price': price,
        'currency': currency,
        'category': category,
        'province': province,
        'city': city,
        'suburb': suburb,
        'photos': photos,
        'condition': condition,
        'seller_name': sellerName,
        'seller_phone': sellerPhone,
      };
}
