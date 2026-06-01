import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../models/listing.dart';
import '../../services/auth_service.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';

class MyListingsScreen extends StatefulWidget {
  const MyListingsScreen({super.key});

  @override
  State<MyListingsScreen> createState() => _MyListingsScreenState();
}

class _MyListingsScreenState extends State<MyListingsScreen> {
  final _supabase = Supabase.instance.client;
  List<Listing> _listings = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (AuthService.isSignedIn) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items =
          await ListingService.fetchUserListings(AuthService.currentUserId!);
      if (mounted) {
        setState(() {
          _listings = items;
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

  Future<void> _deleteListing(Listing listing) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete Listing',
          style: TextStyle(
              fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 18),
        ),
        content: Text(
          'Are you sure you want to delete "${listing.title}"? This cannot be undone.',
          style: const TextStyle(
              fontFamily: 'Inter', color: AppColors.textSecondary, height: 1.5),
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
        setState(() => _listings.removeWhere((l) => l.id == listing.id));
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

  bool _isExpired(Listing listing) {
    return DateTime.now().difference(listing.createdAt).inDays >= 30;
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('My Listings')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.storefront_outlined,
                    size: 72, color: AppColors.border),
                const SizedBox(height: 16),
                const Text(
                  'Sign in to view your listings',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () => context.push('/login'),
                  child: const Text('Sign In'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('My Listings')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
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
                          onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : _listings.isEmpty
                  ? _EmptyState()
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.primaryBlue,
                      child: ListView.builder(
                        padding:
                            const EdgeInsets.fromLTRB(16, 16, 16, 100),
                        itemCount: _listings.length,
                        itemBuilder: (_, i) => _ListingRow(
                          listing: _listings[i],
                          isExpired: _isExpired(_listings[i]),
                          onView: () =>
                              context.push('/listing/${_listings[i].id}'),
                          onDelete: () => _deleteListing(_listings[i]),
                        ),
                      ),
                    ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
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
              'Post your first ad and start selling!',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => context.push('/post-listing'),
              icon: const Icon(Icons.add),
              label: const Text('Post an Ad'),
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
  final VoidCallback onView;
  final VoidCallback onDelete;

  const _ListingRow({
    required this.listing,
    required this.isExpired,
    required this.onView,
    required this.onDelete,
  });

  Color get _statusColor {
    if (listing.status == 'active') return AppColors.success;
    if (listing.status == 'pending') return AppColors.warning;
    return AppColors.error;
  }

  String get _statusLabel {
    switch (listing.status) {
      case 'active':
        return 'Active';
      case 'pending':
        return 'Pending';
      case 'sold':
        return 'Sold';
      case 'expired':
        return 'Expired';
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
                  Row(
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
                      const SizedBox(width: 8),
                      if (isExpired)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.error.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'Expired',
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.error,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
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
                  Row(
                    children: [
                      // Status pill
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
                      const SizedBox(width: 8),
                      const Icon(Icons.remove_red_eye_outlined,
                          size: 12, color: AppColors.textMuted),
                      const SizedBox(width: 3),
                      Text(
                        '${listing.views}',
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.access_time,
                          size: 12, color: AppColors.textMuted),
                      const SizedBox(width: 3),
                      Text(
                        timeago.format(listing.createdAt),
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  // Action buttons
                  Row(
                    children: [
                      _ActionButton(
                        label: 'View',
                        icon: Icons.visibility_outlined,
                        color: AppColors.primaryBlue,
                        onTap: onView,
                      ),
                      const SizedBox(width: 8),
                      _ActionButton(
                        label: 'Delete',
                        icon: Icons.delete_outline,
                        color: AppColors.error,
                        onTap: onDelete,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
