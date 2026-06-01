import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/listing.dart';
import '../../models/profile.dart';
import '../../services/auth_service.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';

class ProfileScreen extends StatefulWidget {
  final String? userId;

  const ProfileScreen({super.key, this.userId});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Profile? _profile;
  List<Listing> _listings = [];
  bool _loading = true;

  bool get _isOwnProfile =>
      widget.userId == null ||
      widget.userId == AuthService.currentUserId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = widget.userId ?? AuthService.currentUserId;
    if (uid == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final [profileData, listings] = await Future.wait([
        AuthService.fetchProfile(uid),
        ListingService.fetchUserListings(uid),
      ]);
      if (mounted) {
        setState(() {
          if (profileData != null) {
            _profile = Profile.fromMap(profileData as Map<String, dynamic>);
          }
          _listings = listings as List<Listing>;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn && _isOwnProfile) {
      return Scaffold(
        appBar: AppBar(title: const Text('Profile')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.person_outline,
                  size: 72, color: AppColors.border),
              const SizedBox(height: 16),
              const Text('Sign in to view your profile'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.push('/login'),
                child: const Text('Sign In'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              slivers: [
                // Header
                SliverAppBar(
                  expandedHeight: 200,
                  pinned: true,
                  backgroundColor: AppColors.primaryBlue,
                  actions: [
                    if (_isOwnProfile) ...[
                      IconButton(
                        icon: const Icon(Icons.edit_outlined),
                        onPressed: () => context.push('/edit-profile'),
                      ),
                      IconButton(
                        icon: const Icon(Icons.settings_outlined),
                        onPressed: () => context.push('/settings'),
                      ),
                    ],
                  ],
                  flexibleSpace: FlexibleSpaceBar(
                    background: _ProfileHeader(
                      profile: _profile,
                      isOwn: _isOwnProfile,
                    ),
                  ),
                ),

                // Listings
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                  sliver: _listings.isEmpty
                      ? SliverToBoxAdapter(
                          child: _EmptyListings(isOwn: _isOwnProfile))
                      : SliverGrid(
                          delegate: SliverChildBuilderDelegate(
                            (_, i) => ListingCard(listing: _listings[i]),
                            childCount: _listings.length,
                          ),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: 0.72,
                          ),
                        ),
                ),
              ],
            ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  final Profile? profile;
  final bool isOwn;

  const _ProfileHeader({required this.profile, required this.isOwn});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.darkBlue, AppColors.primaryBlue],
        ),
      ),
      padding: EdgeInsets.fromLTRB(
          20, MediaQuery.of(context).padding.top + 56, 20, 20),
      child: Row(
        children: [
          // Avatar
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2.5),
            ),
            child: CircleAvatar(
              radius: 38,
              backgroundColor: AppColors.lightBlue,
              backgroundImage: profile?.avatar != null
                  ? CachedNetworkImageProvider(profile!.avatar!)
                  : null,
              child: profile?.avatar == null
                  ? Text(
                      profile?.name.isNotEmpty == true
                          ? profile!.name[0].toUpperCase()
                          : 'U',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryBlue,
                      ),
                    )
                  : null,
            ),
          ),

          const SizedBox(width: 16),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        profile?.name ?? 'User',
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    if (profile?.verified == true) ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.verified,
                          color: AppColors.orange, size: 20),
                    ],
                  ],
                ),
                if (profile?.city != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined,
                          size: 13, color: Colors.white60),
                      const SizedBox(width: 3),
                      Text(
                        profile!.city!,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ],
                if (profile?.bio != null && profile!.bio!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    profile!.bio!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: Colors.white60,
                      height: 1.4,
                    ),
                  ),
                ],
                if (isOwn && profile?.verified == false) ...[
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () => context.push('/verify'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.orange.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: AppColors.orange.withValues(alpha: 0.5)),
                      ),
                      child: const Text(
                        'Get Verified →',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.orange,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyListings extends StatelessWidget {
  final bool isOwn;

  const _EmptyListings({required this.isOwn});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          const Icon(Icons.inventory_2_outlined,
              size: 56, color: AppColors.border),
          const SizedBox(height: 12),
          Text(
            isOwn ? "You haven't posted any listings yet" : 'No listings yet',
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
          ),
          if (isOwn) ...[
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => context.push('/post-listing'),
              child: const Text('Post Your First Ad'),
            ),
          ],
        ],
      ),
    );
  }
}
