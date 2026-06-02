import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../models/listing.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_modal.dart';

class MyListingsScreen extends StatefulWidget {
  const MyListingsScreen({super.key});

  @override
  State<MyListingsScreen> createState() => _MyListingsScreenState();
}

class _MyListingsScreenState extends State<MyListingsScreen>
    with SingleTickerProviderStateMixin {
  final _supabase = Supabase.instance.client;

  List<Listing> _allListings = [];
  bool _loading = true;
  String? _error;

  late final TabController _tabController;

  static const _tabs = ['Active', 'Pending', 'Sold'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    if (AuthService.isSignedIn) _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final uid = AuthService.currentUserId!;
      final data = await _supabase
          .from('listings')
          .select()
          .eq('user_id', uid)
          .order('created_at', ascending: false);

      if (mounted) {
        setState(() {
          _allListings = (data as List)
              .map((m) => Listing.fromMap(m as Map<String, dynamic>))
              .where((l) => l.status != 'deleted')
              .toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load listings.';
          _loading = false;
        });
      }
    }
  }

  List<Listing> _filtered(String tab) {
    switch (tab) {
      case 'Active':
        return _allListings.where((l) => l.status == 'active').toList();
      case 'Pending':
        return _allListings.where((l) => l.status == 'pending').toList();
      case 'Sold':
        return _allListings.where((l) => l.status == 'sold').toList();
      default:
        return _allListings;
    }
  }

  bool _isExpiringSoon(Listing l) {
    final age = DateTime.now().difference(l.createdAt).inDays;
    return age >= 25 && age < 30;
  }

  bool _isExpired(Listing l) {
    return DateTime.now().difference(l.createdAt).inDays >= 30;
  }

  Future<void> _markAsSold(Listing listing) async {
    try {
      await _supabase
          .from('listings')
          .update({'status': 'sold'}).eq('id', listing.id);
      if (mounted) {
        setState(() {
          final idx = _allListings.indexWhere((l) => l.id == listing.id);
          if (idx != -1) {
            _allListings[idx] = Listing(
              id: listing.id,
              sellerId: listing.sellerId,
              sellerName: listing.sellerName,
              sellerPhone: listing.sellerPhone,
              title: listing.title,
              description: listing.description,
              price: listing.price,
              currency: listing.currency,
              category: listing.category,
              province: listing.province,
              city: listing.city,
              suburb: listing.suburb,
              photos: listing.photos,
              status: 'sold',
              condition: listing.condition,
              views: listing.views,
              createdAt: listing.createdAt,
              updatedAt: DateTime.now(),
              sellerVerified: listing.sellerVerified,
              sellerAvatar: listing.sellerAvatar,
            );
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Listing marked as sold'),
            backgroundColor: AppColors.textPrimary,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to update listing'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _deleteListing(Listing listing) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete Listing',
          style: TextStyle(
              fontFamily: 'Inter',
              fontWeight: FontWeight.w700,
              fontSize: 18),
        ),
        content: Text(
          'Are you sure you want to delete "${listing.title}"? This cannot be undone.',
          style: const TextStyle(
              fontFamily: 'Inter',
              color: AppColors.textSecondary,
              height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _supabase
          .from('listings')
          .update({'status': 'deleted'}).eq('id', listing.id);
      if (mounted) {
        setState(
            () => _allListings.removeWhere((l) => l.id == listing.id));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Listing deleted'),
            backgroundColor: AppColors.textPrimary,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to delete listing'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _showMenu(BuildContext context, Listing listing) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              margin: const EdgeInsets.symmetric(vertical: 10),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 4),
              child: Text(
                listing.title,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const Divider(color: AppColors.border, height: 1),
            _MenuItem(
              icon: Icons.visibility_outlined,
              label: 'View Listing',
              onTap: () {
                Navigator.pop(context);
                context.push('/listing/${listing.id}');
              },
            ),
            _MenuItem(
              icon: Icons.edit_outlined,
              label: 'Edit',
              onTap: () {
                Navigator.pop(context);
                context.push('/edit-listing/${listing.id}');
              },
            ),
            if (listing.status == 'active')
              _MenuItem(
                icon: Icons.check_circle_outline,
                label: 'Mark as Sold',
                color: AppColors.success,
                onTap: () {
                  Navigator.pop(context);
                  _markAsSold(listing);
                },
              ),
            _MenuItem(
              icon: Icons.rocket_launch_outlined,
              label: 'Boost Listing',
              color: AppColors.orange,
              onTap: () {
                Navigator.pop(context);
                context.push('/boost/${listing.id}');
              },
            ),
            _MenuItem(
              icon: Icons.delete_outline,
              label: 'Delete',
              color: AppColors.error,
              onTap: () {
                Navigator.pop(context);
                _deleteListing(listing);
              },
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
          title: const Text('My Listings'),
          backgroundColor: AppColors.primaryBlue,
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(40),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.storefront_outlined,
                    size: 72, color: AppColors.border),
                const SizedBox(height: 16),
                const Text(
                  'Sign in to manage your listings',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Post ads and manage them all in one place.',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    color: AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => showAuthModal(
                      context, 'Login to manage your listings'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryBlue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 32, vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(
                    'Sign In',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final activeCount =
        _allListings.where((l) => l.status == 'active').length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'My Listings${activeCount > 0 ? ' ($activeCount active)' : ''}',
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        backgroundColor: AppColors.primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: AppColors.orange,
          indicatorWeight: 3,
          labelStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w700),
          unselectedLabelStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w500),
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                  color: AppColors.primaryBlue))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 56, color: AppColors.error),
                      const SizedBox(height: 12),
                      Text(_error!,
                          style: const TextStyle(
                              fontFamily: 'Inter',
                              color: AppColors.textSecondary)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                          onPressed: _load,
                          child: const Text('Retry')),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: _tabs.map((tab) {
                    final items = _filtered(tab);
                    if (items.isEmpty) {
                      return _buildEmptyState(context);
                    }
                    return RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.primaryBlue,
                      child: ListView.builder(
                        padding:
                            const EdgeInsets.fromLTRB(16, 16, 16, 100),
                        itemCount: items.length,
                        itemBuilder: (_, i) => _ListingRow(
                          listing: items[i],
                          isExpired: _isExpired(items[i]),
                          isExpiringSoon: _isExpiringSoon(items[i]),
                          onMenu: () =>
                              _showMenu(context, items[i]),
                          onView: () => context
                              .push('/listing/${items[i].id}'),
                        ),
                      ),
                    );
                  }).toList(),
                ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.storefront_outlined,
                size: 72, color: AppColors.border),
            const SizedBox(height: 16),
            const Text(
              'No listings yet',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Post your first ad!',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => context.push('/post'),
              icon: const Icon(Icons.add),
              label: const Text(
                'Post an Ad',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 15,
                    fontWeight: FontWeight.w600),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryBlue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                    horizontal: 28, vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ListingRow extends StatelessWidget {
  final Listing listing;
  final bool isExpired;
  final bool isExpiringSoon;
  final VoidCallback onMenu;
  final VoidCallback onView;

  const _ListingRow({
    required this.listing,
    required this.isExpired,
    required this.isExpiringSoon,
    required this.onMenu,
    required this.onView,
  });

  Color get _statusColor {
    if (isExpired) return AppColors.error;
    switch (listing.status) {
      case 'active':
        return AppColors.success;
      case 'pending':
        return AppColors.orange;
      case 'sold':
        return AppColors.textMuted;
      default:
        return AppColors.textMuted;
    }
  }

  String get _statusLabel {
    if (isExpired) return 'Expired';
    switch (listing.status) {
      case 'active':
        return 'Active';
      case 'pending':
        return 'Pending';
      case 'sold':
        return 'Sold';
      case 'banned':
        return 'Banned';
      default:
        return listing.status;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onView,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Thumbnail
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 76,
                  height: 76,
                  child: listing.photos.isNotEmpty
                      ? Image.network(
                          listing.photos.first,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            color: AppColors.lightBlue,
                            child: const Icon(Icons.image_outlined,
                                color: AppColors.textMuted),
                          ),
                        )
                      : Container(
                          color: AppColors.lightBlue,
                          child: const Icon(Icons.storefront_outlined,
                              color: AppColors.textMuted, size: 32),
                        ),
                ),
              ),
              const SizedBox(width: 12),

              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title row
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            listing.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        // 3-dot menu
                        GestureDetector(
                          onTap: onMenu,
                          child: const Padding(
                            padding: EdgeInsets.only(left: 8),
                            child: Icon(Icons.more_vert,
                                size: 20,
                                color: AppColors.textSecondary),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),

                    // Price
                    Text(
                      listing.formattedPrice,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryBlue,
                      ),
                    ),
                    const SizedBox(height: 6),

                    // Status + expiry warning row
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: _statusColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            _statusLabel,
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: _statusColor,
                            ),
                          ),
                        ),
                        if (isExpiringSoon && !isExpired) ...[  
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'Expiring soon',
                              style: TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFB45309),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 6),

                    // Meta row: views + date
                    Row(
                      children: [
                        const Icon(Icons.remove_red_eye_outlined,
                            size: 12, color: AppColors.textMuted),
                        const SizedBox(width: 3),
                        Text(
                          '${listing.views} views',
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 11,
                            color: AppColors.textMuted,
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Icon(Icons.access_time,
                            size: 12, color: AppColors.textMuted),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(
                            timeago.format(listing.createdAt),
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 11,
                              color: AppColors.textMuted,
                            ),
                            overflow: TextOverflow.ellipsis,
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
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;

  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = AppColors.textPrimary,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding:
            const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 16),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 15,
                fontWeight: FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
