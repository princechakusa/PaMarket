import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:url_launcher/url_launcher.dart';
import '../../models/listing.dart';
import '../../services/auth_service.dart';
import '../../services/chat_service.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';

class ListingDetailScreen extends StatefulWidget {
  final String listingId;

  const ListingDetailScreen({super.key, required this.listingId});

  @override
  State<ListingDetailScreen> createState() => _ListingDetailScreenState();
}

class _ListingDetailScreenState extends State<ListingDetailScreen> {
  Listing? _listing;
  bool _loading = true;
  final PageController _photoController = PageController();
  int _photoIndex = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _photoController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final l = await ListingService.fetchListing(widget.listingId);
      if (mounted) {
        setState(() {
          _listing = l;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openWhatsApp() async {
    final phone = _listing?.sellerPhone
        .replaceAll(RegExp(r'[^\d+]'), '')
        .replaceFirst(RegExp(r'^0'), '+263');
    if (phone == null || phone.isEmpty) return;
    final url = Uri.parse(
        'https://wa.me/$phone?text=Hi, I saw your listing on PaMarket: ${_listing?.title}');
    if (await canLaunchUrl(url)) launchUrl(url);
  }

  Future<void> _callSeller() async {
    final phone = _listing?.sellerPhone;
    if (phone == null || phone.isEmpty) return;
    final url = Uri.parse('tel:$phone');
    if (await canLaunchUrl(url)) launchUrl(url);
  }

  Future<void> _openChat() async {
    if (!AuthService.isSignedIn) {
      context.push('/login');
      return;
    }
    final l = _listing;
    if (l == null) return;

    if (AuthService.currentUserId == l.sellerId) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("That's your own listing.")),
      );
      return;
    }

    final convo = await ChatService.findOrCreateConversation(
      listingId: l.id,
      sellerId: l.sellerId,
    );
    if (convo != null && mounted) {
      context.push('/chat/${convo.id}');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final l = _listing;
    if (l == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Listing')),
        body: const Center(child: Text('Listing not found.')),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              // Photo carousel
              SliverAppBar(
                expandedHeight: 320,
                pinned: true,
                backgroundColor: AppColors.primaryBlue,
                flexibleSpace: FlexibleSpaceBar(
                  background: Stack(
                    children: [
                      PageView.builder(
                        controller: _photoController,
                        onPageChanged: (i) =>
                            setState(() => _photoIndex = i),
                        itemCount:
                            l.photos.isEmpty ? 1 : l.photos.length,
                        itemBuilder: (_, i) {
                          if (l.photos.isEmpty) {
                            return Container(
                              color: AppColors.lightBlue,
                              child: const Center(
                                child: Icon(Icons.image_outlined,
                                    size: 60, color: AppColors.border),
                              ),
                            );
                          }
                          return CachedNetworkImage(
                            imageUrl: l.photos[i],
                            fit: BoxFit.cover,
                          );
                        },
                      ),
                      if (l.photos.length > 1)
                        Positioned(
                          bottom: 16,
                          left: 0,
                          right: 0,
                          child: Center(
                            child: SmoothPageIndicator(
                              controller: _photoController,
                              count: l.photos.length,
                              effect: const WormEffect(
                                dotWidth: 8,
                                dotHeight: 8,
                                activeDotColor: AppColors.orange,
                                dotColor: Colors.white54,
                              ),
                            ),
                          ),
                        ),
                      // Photo count badge
                      if (l.photos.length > 1)
                        Positioned(
                          top: 16,
                          right: 16,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.black54,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '${_photoIndex + 1}/${l.photos.length}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              // Content
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Category chip
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.lightBlue,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          l.category.replaceAll('-', ' ').toUpperCase(),
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primaryBlue,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ),

                      const SizedBox(height: 10),

                      // Title
                      Text(
                        l.title,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                          height: 1.2,
                        ),
                      ),

                      const SizedBox(height: 8),

                      // Price
                      Text(
                        l.formattedPrice,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primaryBlue,
                        ),
                      ),

                      const SizedBox(height: 12),

                      // Location + time row
                      Row(
                        children: [
                          const Icon(Icons.location_on_outlined,
                              size: 15, color: AppColors.textMuted),
                          const SizedBox(width: 4),
                          Text(
                            l.locationDisplay,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              color: AppColors.textMuted,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            timeago.format(l.createdAt),
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),

                      if (l.condition != null) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(Icons.info_outline,
                                size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              'Condition: ${l.condition}',
                              style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 13,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ],

                      const Divider(height: 28),

                      // Description
                      const Text(
                        'Description',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        l.description,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 14,
                          color: AppColors.textSecondary,
                          height: 1.6,
                        ),
                      ),

                      const Divider(height: 28),

                      // Seller
                      _SellerRow(listing: l),

                      const SizedBox(height: 24),

                      // Views
                      Row(
                        children: [
                          const Icon(Icons.visibility_outlined,
                              size: 14, color: AppColors.textMuted),
                          const SizedBox(width: 4),
                          Text(
                            '${l.views} views',
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // Bottom action bar
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _ContactBar(
              onWhatsApp: _openWhatsApp,
              onCall: _callSeller,
              onMessage: _openChat,
              listing: l,
            ),
          ),
        ],
      ),
    );
  }
}

class _SellerRow extends StatelessWidget {
  final Listing listing;

  const _SellerRow({required this.listing});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 22,
          backgroundColor: AppColors.lightBlue,
          backgroundImage: listing.sellerAvatar != null
              ? CachedNetworkImageProvider(listing.sellerAvatar!)
              : null,
          child: listing.sellerAvatar == null
              ? Text(
                  listing.sellerName.isNotEmpty
                      ? listing.sellerName[0].toUpperCase()
                      : 'U',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryBlue,
                  ),
                )
              : null,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    listing.sellerName,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (listing.sellerVerified == true) ...[
                    const SizedBox(width: 4),
                    const Icon(Icons.verified,
                        size: 16, color: AppColors.primaryBlue),
                  ],
                ],
              ),
              const Text(
                'Seller',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
        TextButton(
          onPressed: () =>
              context.push('/profile/${listing.sellerId}'),
          child: const Text('View Profile'),
        ),
      ],
    );
  }
}

class _ContactBar extends StatelessWidget {
  final Listing listing;
  final VoidCallback onWhatsApp;
  final VoidCallback onCall;
  final VoidCallback onMessage;

  const _ContactBar({
    required this.listing,
    required this.onWhatsApp,
    required this.onCall,
    required this.onMessage,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 12, 16, 12 + MediaQuery.of(context).padding.bottom),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: const Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          _ContactBtn(
            icon: Icons.chat_outlined,
            label: 'Message',
            onTap: onMessage,
            primary: true,
          ),
          const SizedBox(width: 8),
          _ContactBtn(
            icon: Icons.chat_bubble_outline,
            label: 'WhatsApp',
            onTap: onWhatsApp,
            color: const Color(0xFF25D366),
          ),
          const SizedBox(width: 8),
          _ContactBtn(
            icon: Icons.call_outlined,
            label: 'Call',
            onTap: onCall,
            color: AppColors.success,
          ),
        ],
      ),
    );
  }
}

class _ContactBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool primary;
  final Color? color;

  const _ContactBtn({
    required this.icon,
    required this.label,
    required this.onTap,
    this.primary = false,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final bg = primary
        ? AppColors.primaryBlue
        : (color ?? AppColors.card);
    final fg = primary || color != null ? Colors.white : AppColors.textPrimary;

    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 46,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: primary || color != null
                  ? Colors.transparent
                  : AppColors.border,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: fg),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: fg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
