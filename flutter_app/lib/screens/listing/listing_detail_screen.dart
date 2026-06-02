import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:url_launcher/url_launcher.dart';

import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_modal.dart';
import '../../widgets/listing_card.dart';
import '../../models/listing.dart';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class ListingDetailScreen extends StatefulWidget {
  final String listingId;

  const ListingDetailScreen({super.key, required this.listingId});

  @override
  State<ListingDetailScreen> createState() => _ListingDetailScreenState();
}

class _ListingDetailScreenState extends State<ListingDetailScreen> {
  // ---- state ----------------------------------------------------------------
  Map<String, dynamic>? _listing;
  List<Map<String, dynamic>> _similar = [];
  bool _loading = true;
  bool _error = false;
  bool _isSaved = false;
  bool _saveBusy = false;

  final PageController _pageCtrl = PageController();
  int _photoIndex = 0;
  bool _descExpanded = false;

  // ---- lifecycle ------------------------------------------------------------

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  // ---- data -----------------------------------------------------------------

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final db = Supabase.instance.client;

      // Fetch listing + seller profile in one query
      final data = await db
          .from('listings')
          .select('*, profiles:user_id(*)')
          .eq('id', widget.listingId)
          .single();

      // Increment view count (ignore failure)
      final uid = AuthService.currentUserId;
      if (uid == null || uid != (data['user_id'] as String?)) {
        db
            .from('listings')
            .update({'views': ((data['views'] as int?) ?? 0) + 1})
            .eq('id', widget.listingId)
            .then((_) {});
      }

      // Check saved state
      bool saved = false;
      if (uid != null) {
        final s = await db
            .from('saved_listings')
            .select()
            .eq('user_id', uid)
            .eq('listing_id', widget.listingId)
            .maybeSingle();
        saved = s != null;
      }

      // Fetch similar listings (same category, not this one, active)
      final cat = data['category'] as String?;
      List<Map<String, dynamic>> similar = [];
      if (cat != null) {
        final rows = await db
            .from('listings')
            .select()
            .eq('category', cat)
            .eq('status', 'active')
            .neq('id', widget.listingId)
            .limit(6);
        similar = List<Map<String, dynamic>>.from(rows as List);
      }

      if (mounted) {
        setState(() {
          _listing = Map<String, dynamic>.from(data as Map);
          _similar = similar;
          _isSaved = saved;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  // ---- save / bookmark ------------------------------------------------------

  Future<void> _toggleSave() async {
    if (!AuthService.isSignedIn) {
      showAuthModal(context, 'Sign in to save listings');
      return;
    }
    if (_saveBusy) return;
    setState(() => _saveBusy = true);
    final uid = AuthService.currentUserId!;
    final db = Supabase.instance.client;
    try {
      if (_isSaved) {
        await db
            .from('saved_listings')
            .delete()
            .eq('user_id', uid)
            .eq('listing_id', widget.listingId);
        if (mounted) {
          setState(() => _isSaved = false);
          _toast('Removed from saved');
        }
      } else {
        await db.from('saved_listings').upsert({
          'user_id': uid,
          'listing_id': widget.listingId,
          'saved_at': DateTime.now().toIso8601String(),
        });
        if (mounted) {
          setState(() => _isSaved = true);
          _toast('Saved');
        }
      }
    } catch (_) {
      if (mounted) _toast('Could not update saved status');
    } finally {
      if (mounted) setState(() => _saveBusy = false);
    }
  }

  // ---- share ----------------------------------------------------------------

  void _share() {
    final l = _listing;
    if (l == null) return;
    final title = l['title'] as String? ?? '';
    final price = _fmtPrice(l);
    final text = '$title · $price on PaMarket Zimbabwe';
    Share.share(text);
  }

  // ---- report ---------------------------------------------------------------

  void _reportListing() {
    if (!AuthService.isSignedIn) {
      showAuthModal(context, 'Sign in to report');
      return;
    }
    final reasons = [
      'Scam or fraud',
      'Counterfeit or fake item',
      'Wrong category',
      'Prohibited item',
      'Offensive content',
      'Duplicate listing',
      'Other',
    ];
    String selected = reasons.first;
    final noteCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, localSet) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Report this listing',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                value: selected,
                decoration: InputDecoration(
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                items: reasons
                    .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                    .toList(),
                onChanged: (v) {
                  if (v != null) localSet(() => selected = v);
                },
              ),
              const SizedBox(height: 10),
              TextField(
                controller: noteCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Tell us more (optional)',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  contentPadding: const EdgeInsets.all(12),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(ctx);
                    try {
                      await Supabase.instance.client
                          .from('reports')
                          .insert({
                        'target_type': 'listing',
                        'target_id': widget.listingId,
                        'reason': selected +
                            (noteCtrl.text.trim().isNotEmpty
                                ? ' - ${noteCtrl.text.trim()}'
                                : ''),
                        'reporter_id': AuthService.currentUserId,
                        'status': 'open',
                      });
                    } catch (_) {}
                    if (mounted) _toast('Report submitted. Thank you.');
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryBlue,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text(
                    'Submit Report',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ---- contact actions ------------------------------------------------------

  Future<void> _callSeller() async {
    final phone = _sellerPhone();
    if (phone.isEmpty) {
      _toast('No phone number available');
      return;
    }
    final clean = phone.replaceAll(RegExp(r'\s+'), '');
    final uri = Uri.parse('tel:$clean');
    if (await canLaunchUrl(uri)) {
      launchUrl(uri);
    } else {
      await Clipboard.setData(ClipboardData(text: clean));
      if (mounted) _toast('Number copied: $clean');
    }
  }

  Future<void> _openWhatsApp() async {
    final l = _listing;
    if (l == null) return;
    final raw = _sellerPhone();
    if (raw.isEmpty) {
      _toast('No WhatsApp number available');
      return;
    }
    final phone = raw.replaceAll(RegExp(r'[^\d+]'), '').replaceFirst('+', '');
    final title = Uri.encodeComponent(
        'Hi! I saw your "${l['title'] ?? ''}" listing on PaMarket Zimbabwe. Is it still available?');
    final uri = Uri.parse('https://wa.me/$phone?text=$title');
    if (await canLaunchUrl(uri)) {
      launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      _toast('Could not open WhatsApp');
    }
  }

  Future<void> _openChat() async {
    if (!AuthService.isSignedIn) {
      showAuthModal(context, 'Sign in to message sellers');
      return;
    }
    final l = _listing;
    if (l == null) return;
    final sellerId = l['user_id'] as String?;
    if (sellerId == null) return;
    final uid = AuthService.currentUserId!;
    if (sellerId == uid) {
      _toast('You cannot message yourself');
      return;
    }
    try {
      final db = Supabase.instance.client;
      // Look for existing conversation
      final existing = await db
          .from('conversations')
          .select('id')
          .or('and(user1_id.eq.$uid,user2_id.eq.$sellerId),and(user1_id.eq.$sellerId,user2_id.eq.$uid)')
          .eq('listing_id', widget.listingId)
          .maybeSingle();

      String convId;
      if (existing != null) {
        convId = existing['id'] as String;
      } else {
        final created = await db
            .from('conversations')
            .insert({
              'user1_id': uid,
              'user2_id': sellerId,
              'listing_id': widget.listingId,
            })
            .select('id')
            .single();
        convId = created['id'] as String;
      }

      if (mounted) context.push('/chat/$convId');
    } catch (_) {
      if (mounted) _toast('Could not open chat');
    }
  }

  // ---- helpers --------------------------------------------------------------

  String _sellerPhone() {
    final l = _listing;
    if (l == null) return '';
    final profile = l['profiles'] as Map?;
    final phone = (profile?['phone'] as String?) ??
        (l['seller_phone'] as String?) ??
        '';
    return phone.trim();
  }

  String _fmtPrice(Map<String, dynamic> l) {
    final price = l['price'];
    final currency = (l['currency'] as String?) ?? 'USD';
    if (price == null) return 'Price on request';
    final num = (price is num) ? price : double.tryParse(price.toString());
    if (num == null) return 'Price on request';
    final symbol = currency == 'ZWG' ? 'ZWG' : '\$';
    return '$symbol${num % 1 == 0 ? num.toInt() : num.toStringAsFixed(2)}';
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return 'U';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(content: Text(msg), duration: const Duration(seconds: 2)),
      );
  }

  // ---- photo viewer (full-screen) ------------------------------------------

  void _openPhotoViewer(List<String> photos, int startIndex) {
    Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black,
        pageBuilder: (_, __, ___) =>
            _PhotoViewer(photos: photos, initialIndex: startIndex),
      ),
    );
  }

  // ---- build ----------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: _loading
          ? _buildLoading()
          : _error
              ? _buildError()
              : _buildContent(),
    );
  }

  Widget _buildLoading() {
    return const Center(
      child: CircularProgressIndicator(color: AppColors.primaryBlue),
    );
  }

  Widget _buildError() {
    return SafeArea(
      child: Column(
        children: [
          _buildTopBar(title: 'Listing'),
          const Expanded(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.error_outline,
                      size: 48, color: AppColors.textMuted),
                  SizedBox(height: 12),
                  Text(
                    'Could not load listing',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loadAll,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text(
                  'Retry',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    final l = _listing!;
    final photos = _photos(l);
    final status = (l['status'] as String?) ?? 'active';
    final isSold = status == 'sold';
    final profile = l['profiles'] as Map?;
    final sellerName = (profile?['full_name'] as String?) ??
        (profile?['name'] as String?) ??
        (l['seller_name'] as String?) ??
        'Seller';
    final sellerAvatar = (profile?['avatar_url'] as String?) ??
        (profile?['photo_url'] as String?);
    final sellerVerified = (profile?['verified'] as bool?) ?? false;
    final joinedAt = profile?['created_at'] as String?;
    final uid = AuthService.currentUserId;
    final sellerId = l['user_id'] as String? ?? '';
    final isMine = uid != null && uid == sellerId;
    final phone = _sellerPhone();
    final negotiable = l['negotiable'] as bool? ?? false;
    final currency = (l['currency'] as String?) ?? 'USD';
    final boosted = l['boosted'] as bool? ?? l['is_boosted'] as bool? ?? false;
    final city = (l['city'] as String?) ?? (l['suburb'] as String?) ?? '';
    final condition = l['condition'] as String?;
    final description = (l['description'] as String?) ?? '';
    final views = (l['views'] as int?) ?? 0;
    final createdAtStr = l['created_at'] as String?;
    final createdAt = createdAtStr != null
        ? DateTime.tryParse(createdAtStr) ?? DateTime.now()
        : DateTime.now();

    return Stack(
      children: [
        CustomScrollView(
          slivers: [
            // ---- Top bar -------------------------------------------------------
            SliverToBoxAdapter(
              child: SafeArea(
                bottom: false,
                child: _buildTopBar(title: l['title'] as String? ?? 'Listing'),
              ),
            ),

            // ---- Photo gallery -------------------------------------------------
            SliverToBoxAdapter(child: _buildPhotoGallery(photos)),

            // ---- Main content --------------------------------------------------
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Sold banner
                    if (isSold) _buildSoldBanner(),

                    // Price row
                    _buildPriceRow(l, negotiable, currency, boosted),

                    const SizedBox(height: 8),

                    // Title
                    Text(
                      l['title'] as String? ?? '',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                        height: 1.2,
                      ),
                    ),

                    const SizedBox(height: 8),

                    // Condition chip
                    if (condition != null && condition.isNotEmpty)
                      _buildConditionChip(condition),

                    const SizedBox(height: 8),

                    // Location + views + time
                    _buildMeta(city, views, createdAt),

                    const SizedBox(height: 12),

                    // Action row: save, share, report
                    _buildActionRow(),

                    const Divider(height: 28),

                    // Seller card
                    _buildSellerCard(
                      sellerId: sellerId,
                      sellerName: sellerName,
                      sellerAvatar: sellerAvatar,
                      sellerVerified: sellerVerified,
                      joinedAt: joinedAt,
                      phone: phone,
                    ),

                    const Divider(height: 28),

                    // Description
                    _buildDescription(description),

                    const Divider(height: 28),

                    // Contact buttons (non-owner) or delete (owner)
                    if (isMine)
                      _buildDeleteButton(l['id'] as String? ?? '')
                    else
                      _buildContactButtons(phone),

                    const SizedBox(height: 28),

                    // Similar listings
                    if (_similar.isNotEmpty) _buildSimilarSection(),

                    // Safety tips
                    _buildSafetyTips(),

                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ---- sub-builders ---------------------------------------------------------

  Widget _buildTopBar({required String title}) {
    return Container(
      height: 56,
      color: AppColors.card,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded,
                size: 20, color: AppColors.textPrimary),
            onPressed: () => context.pop(),
          ),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          if (_listing != null) ...
            [
              IconButton(
                icon: const Icon(Icons.share_outlined,
                    size: 20, color: AppColors.textPrimary),
                onPressed: _share,
                tooltip: 'Share',
              ),
              IconButton(
                icon: Icon(
                  _isSaved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  size: 22,
                  color: _isSaved ? AppColors.primaryBlue : AppColors.textMuted,
                ),
                onPressed: _toggleSave,
                tooltip: _isSaved ? 'Unsave' : 'Save',
              ),
            ]
          else
            const SizedBox(width: 48),
        ],
      ),
    );
  }

  Widget _buildPhotoGallery(List<String> photos) {
    if (photos.isEmpty) {
      return Container(
        height: 280,
        color: AppColors.lightBlue,
        child: const Center(
          child:
              Icon(Icons.image_outlined, size: 72, color: AppColors.border),
        ),
      );
    }

    return SizedBox(
      height: 300,
      child: Stack(
        children: [
          PageView.builder(
            controller: _pageCtrl,
            itemCount: photos.length,
            onPageChanged: (i) => setState(() => _photoIndex = i),
            itemBuilder: (_, i) => GestureDetector(
              onTap: () => _openPhotoViewer(photos, i),
              child: CachedNetworkImage(
                imageUrl: photos[i],
                fit: BoxFit.cover,
                width: double.infinity,
                placeholder: (_, __) => Container(color: AppColors.lightBlue),
                errorWidget: (_, __, ___) => Container(
                  color: AppColors.lightBlue,
                  child: const Center(
                    child: Icon(Icons.broken_image_outlined,
                        color: AppColors.textMuted),
                  ),
                ),
              ),
            ),
          ),
          // Dot indicator
          if (photos.length > 1)
            Positioned(
              bottom: 12,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(photos.length, (i) {
                  final active = i == _photoIndex;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: active ? 18 : 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: active ? Colors.white : Colors.white54,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  );
                }),
              ),
            ),
          // Count badge
          if (photos.length > 1)
            Positioned(
              top: 12,
              right: 12,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${_photoIndex + 1} / ${photos.length}',
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
    );
  }

  Widget _buildSoldBanner() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.35)),
      ),
      child: const Row(
        children: [
          Icon(Icons.info_outline, size: 18, color: AppColors.error),
          SizedBox(width: 8),
          Text(
            'This listing has been sold',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.error,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPriceRow(
    Map<String, dynamic> l,
    bool negotiable,
    String currency,
    bool boosted,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          _fmtPrice(l),
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: AppColors.primaryBlue,
          ),
        ),
        const SizedBox(width: 8),
        // Currency badge
        Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
          decoration: BoxDecoration(
            color: currency == 'ZWG'
                ? AppColors.orange.withValues(alpha: 0.15)
                : AppColors.lightBlue,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            currency,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: currency == 'ZWG'
                  ? AppColors.orange
                  : AppColors.primaryBlue,
            ),
          ),
        ),
        if (negotiable) ...
          [
            const SizedBox(width: 6),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'Negotiable',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.success,
                ),
              ),
            ),
          ],
        if (boosted) ...
          [
            const SizedBox(width: 6),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.orange.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.bolt_rounded,
                      size: 12, color: AppColors.orange),
                  SizedBox(width: 2),
                  Text(
                    'Promoted',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.orange,
                    ),
                  ),
                ],
              ),
            ),
          ],
      ],
    );
  }

  Widget _buildConditionChip(String condition) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.lightBlue,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        condition,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.primaryBlue,
        ),
      ),
    );
  }

  Widget _buildMeta(String city, int views, DateTime createdAt) {
    return Row(
      children: [
        if (city.isNotEmpty) ...
          [
            const Icon(Icons.location_on_outlined,
                size: 14, color: AppColors.textMuted),
            const SizedBox(width: 3),
            Text(
              city,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: AppColors.textMuted,
              ),
            ),
            const SizedBox(width: 8),
            const Text('·',
                style: TextStyle(
                    fontSize: 13, color: AppColors.textMuted)),
            const SizedBox(width: 8),
          ],
        Text(
          timeago.format(createdAt),
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            color: AppColors.textMuted,
          ),
        ),
        const SizedBox(width: 8),
        const Text('·',
            style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
        const SizedBox(width: 8),
        const Icon(Icons.remove_red_eye_outlined,
            size: 14, color: AppColors.textMuted),
        const SizedBox(width: 3),
        Text(
          '$views views',
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            color: AppColors.textMuted,
          ),
        ),
      ],
    );
  }

  Widget _buildActionRow() {
    return Row(
      children: [
        // Save/bookmark
        GestureDetector(
          onTap: _toggleSave,
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: _isSaved
                  ? AppColors.primaryBlue.withValues(alpha: 0.1)
                  : AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: _isSaved
                    ? AppColors.primaryBlue.withValues(alpha: 0.4)
                    : AppColors.border,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  _isSaved
                      ? Icons.favorite_rounded
                      : Icons.favorite_border_rounded,
                  size: 16,
                  color: _isSaved
                      ? AppColors.primaryBlue
                      : AppColors.textSecondary,
                ),
                const SizedBox(width: 5),
                Text(
                  _isSaved ? 'Saved' : 'Save',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _isSaved
                        ? AppColors.primaryBlue
                        : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Share
        GestureDetector(
          onTap: _share,
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: const Row(
              children: [
                Icon(Icons.share_outlined,
                    size: 16, color: AppColors.textSecondary),
                SizedBox(width: 5),
                Text(
                  'Share',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Report
        GestureDetector(
          onTap: _reportListing,
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: const Icon(Icons.flag_outlined,
                size: 16, color: AppColors.textMuted),
          ),
        ),
      ],
    );
  }

  Widget _buildSellerCard({
    required String sellerId,
    required String sellerName,
    required String? sellerAvatar,
    required bool sellerVerified,
    required String? joinedAt,
    required String phone,
  }) {
    final joined = joinedAt != null
        ? DateTime.tryParse(joinedAt)
        : null;
    final memberSince = joined != null
        ? '${_monthName(joined.month)} ${joined.year}'
        : '';

    return GestureDetector(
      onTap: () => context.push('/profile/$sellerId'),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 26,
              backgroundColor: AppColors.primaryBlue,
              backgroundImage: sellerAvatar != null && sellerAvatar.isNotEmpty
                  ? CachedNetworkImageProvider(sellerAvatar)
                  : null,
              child: sellerAvatar == null || sellerAvatar.isEmpty
                  ? Text(
                      _initials(sellerName),
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
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
                        sellerName,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      if (sellerVerified) ...
                        [
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.verified_rounded,
                            size: 16,
                            color: AppColors.primaryBlue,
                          ),
                        ],
                    ],
                  ),
                  if (phone.isNotEmpty)
                    Text(
                      phone,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    )
                  else
                    const Text(
                      'No phone listed',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        color: AppColors.textMuted,
                      ),
                    ),
                  if (memberSince.isNotEmpty)
                    Text(
                      'Member since $memberSince${sellerVerified ? ' · ID Verified' : ''}',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                    ),
                ],
              ),
            ),
            // View all ads chevron
            Column(
              children: [
                const Icon(Icons.chevron_right_rounded,
                    size: 22, color: AppColors.textMuted),
                const SizedBox(height: 2),
                Text(
                  'View all ads',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    color: AppColors.primaryBlue.withValues(alpha: 0.8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDescription(String text) {
    final lines = text.split('\n');
    final isLong = lines.length > 3 || text.length > 200;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Description',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        AnimatedCrossFade(
          duration: const Duration(milliseconds: 200),
          crossFadeState: (!isLong || _descExpanded)
              ? CrossFadeState.showSecond
              : CrossFadeState.showFirst,
          firstChild: Text(
            text,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.6,
            ),
          ),
          secondChild: Text(
            text.isEmpty ? 'No description provided.' : text,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.6,
            ),
          ),
        ),
        if (isLong)
          GestureDetector(
            onTap: () => setState(() => _descExpanded = !_descExpanded),
            child: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                _descExpanded ? 'Show less' : 'Read more',
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primaryBlue,
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildContactButtons(String phone) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Chat (primary)
        _ContactButton(
          icon: Icons.chat_bubble_outline_rounded,
          label: 'Message in App',
          bgColor: AppColors.primaryBlue,
          fgColor: Colors.white,
          onTap: _openChat,
        ),
        const SizedBox(height: 10),
        // WhatsApp
        _ContactButton(
          icon: Icons.chat_rounded,
          label: 'Chat on WhatsApp',
          bgColor: const Color(0xFF25D366),
          fgColor: Colors.white,
          onTap: _openWhatsApp,
        ),
        if (phone.isNotEmpty) ...
          [
            const SizedBox(height: 10),
            _ContactButton(
              icon: Icons.phone_outlined,
              label: 'Call $phone',
              bgColor: AppColors.card,
              fgColor: AppColors.textPrimary,
              borderColor: AppColors.border,
              onTap: _callSeller,
            ),
          ],
        const SizedBox(height: 10),
        _ContactButton(
          icon: Icons.flag_outlined,
          label: 'Report this Listing',
          bgColor: AppColors.card,
          fgColor: AppColors.textMuted,
          borderColor: AppColors.border,
          onTap: _reportListing,
        ),
      ],
    );
  }

  Widget _buildDeleteButton(String id) {
    return ElevatedButton(
      onPressed: () => _confirmDelete(id),
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFFFFE2E2),
        foregroundColor: AppColors.error,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(vertical: 14),
        minimumSize: const Size(double.infinity, 0),
      ),
      child: const Text(
        'Delete Listing',
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  void _confirmDelete(String id) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete this listing?',
          style: TextStyle(
            fontFamily: 'Inter',
            fontWeight: FontWeight.w700,
          ),
        ),
        content: const Text(
          'This cannot be undone.',
          style: TextStyle(fontFamily: 'Inter'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel',
                style: TextStyle(fontFamily: 'Inter')),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await Supabase.instance.client
                    .from('listings')
                    .delete()
                    .eq('id', id);
                if (mounted) {
                  _toast('Listing deleted');
                  context.pop();
                }
              } catch (_) {
                if (mounted) _toast('Could not delete listing');
              }
            },
            child: const Text(
              'Delete',
              style: TextStyle(
                fontFamily: 'Inter',
                fontWeight: FontWeight.w700,
                color: AppColors.error,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSimilarSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Similar Listings',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 230,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _similar.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (ctx, i) {
              final raw = _similar[i];
              final listing = Listing.fromMap(raw);
              return SizedBox(
                width: 155,
                child: ListingCard(listing: listing, compact: true),
              );
            },
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildSafetyTips() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.lightBlue,
        borderRadius: BorderRadius.circular(12),
        border:
            Border.all(color: AppColors.primaryBlue.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.shield_outlined,
                  size: 18, color: AppColors.primaryBlue),
              SizedBox(width: 7),
              Text(
                'Safety Tips',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryBlue,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ..._safetyTips.map(
            (tip) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('• ',
                      style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary)),
                  Expanded(
                    child: Text(
                      tip,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
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

  // ---- utilities ------------------------------------------------------------

  List<String> _photos(Map<String, dynamic> l) {
    final raw = l['photos'];
    if (raw == null) return [];
    if (raw is List) return raw.map((e) => e.toString()).toList();
    return [];
  }

  String _monthName(int m) {
    const names = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return m >= 1 && m <= 12 ? names[m] : '';
  }

  static const List<String> _safetyTips = [
    'Meet in a safe, public place.',
    'Never pay in advance or send money digitally before seeing the item.',
    'Inspect the item before buying.',
    'If a deal seems too good to be true, be cautious.',
  ];
}

// ---------------------------------------------------------------------------
// Reusable contact button
// ---------------------------------------------------------------------------

class _ContactButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color bgColor;
  final Color fgColor;
  final Color? borderColor;
  final VoidCallback onTap;

  const _ContactButton({
    required this.icon,
    required this.label,
    required this.bgColor,
    required this.fgColor,
    required this.onTap,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          border: borderColor != null ? Border.all(color: borderColor!) : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: fgColor),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: fgColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Full-screen photo viewer
// ---------------------------------------------------------------------------

class _PhotoViewer extends StatefulWidget {
  final List<String> photos;
  final int initialIndex;

  const _PhotoViewer({required this.photos, required this.initialIndex});

  @override
  State<_PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<_PhotoViewer> {
  late int _idx;
  late PageController _ctrl;

  @override
  void initState() {
    super.initState();
    _idx = widget.initialIndex;
    _ctrl = PageController(initialPage: _idx);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            PageView.builder(
              controller: _ctrl,
              itemCount: widget.photos.length,
              onPageChanged: (i) => setState(() => _idx = i),
              itemBuilder: (_, i) => InteractiveViewer(
                child: Center(
                  child: CachedNetworkImage(
                    imageUrl: widget.photos[i],
                    fit: BoxFit.contain,
                    placeholder: (_, __) => const Center(
                      child: CircularProgressIndicator(
                          color: Colors.white54),
                    ),
                    errorWidget: (_, __, ___) => const Center(
                      child: Icon(Icons.broken_image_outlined,
                          color: Colors.white54),
                    ),
                  ),
                ),
              ),
            ),
            // Top bar: counter + close
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0xAA000000), Colors.transparent],
                  ),
                ),
                child: Row(
                  children: [
                    Text(
                      '${_idx + 1} / ${widget.photos.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: const BoxDecoration(
                          color: Color(0x77000000),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.close_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Dots indicator
            if (widget.photos.length > 1)
              Positioned(
                bottom: 20,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(widget.photos.length, (i) {
                    final active = i == _idx;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin:
                          const EdgeInsets.symmetric(horizontal: 3),
                      width: active ? 18 : 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: active
                            ? Colors.white
                            : Colors.white38,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    );
                  }),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
