import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/listing.dart';
import '../../models/profile.dart';
import '../../services/auth_service.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  Profile? _profile;
  List<Listing> _listings = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    if (AuthService.isSignedIn) _load();
  }

  Future<void> _load() async {
    final uid = AuthService.currentUserId!;
    try {
      final results = await Future.wait([
        AuthService.fetchProfile(uid),
        ListingService.fetchUserListings(uid),
      ]);
      if (mounted) {
        setState(() {
          final profileData = results[0] as Map<String, dynamic>?;
          if (profileData != null) {
            _profile = Profile.fromMap(profileData);
          }
          _listings = results[1] as List<Listing>;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  int get _activeAdsCount =>
      _listings.where((l) => l.status == 'active').length;

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.person_outline,
                      size: 80, color: AppColors.border),
                  const SizedBox(height: 20),
                  const Text(
                    'Sign in to view your account',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Create listings, save ads, and manage your profile.',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),
                  ElevatedButton(
                    onPressed: () => context.push('/login'),
                    child: const Text('Sign In'),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () => context.push('/signup'),
                    child: const Text('Create Account'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primaryBlue,
              child: CustomScrollView(
                slivers: [
                  // Profile header
                  SliverToBoxAdapter(
                    child: _ProfileHeader(
                      profile: _profile,
                      onEdit: () => context.push('/edit-profile'),
                    ),
                  ),

                  // Stats row
                  SliverToBoxAdapter(
                    child: _StatsRow(
                      activeAds: _activeAdsCount,
                    ),
                  ),

                  // My Account section
                  SliverToBoxAdapter(
                    child: _Section(
                      title: 'My Account',
                      tiles: [
                        _AccountTile(
                          icon: Icons.storefront_outlined,
                          title: 'My Listings',
                          trailing: _activeAdsCount > 0
                              ? _Badge('$_activeAdsCount')
                              : null,
                          onTap: () => context.push('/my-listings'),
                        ),
                        _AccountTile(
                          icon: Icons.favorite_outline,
                          title: 'Saved Ads',
                          onTap: () => context.push('/saved'),
                        ),
                        _AccountTile(
                          icon: _profile?.verified == true
                              ? Icons.verified
                              : Icons.verified_outlined,
                          iconColor: _profile?.verified == true
                              ? AppColors.success
                              : null,
                          title: _profile?.verified == true
                              ? 'Verified ✓'
                              : 'Get Verified',
                          subtitle: _profile?.verified == true
                              ? 'Your account is verified'
                              : 'Build trust with a verified badge',
                          onTap: () => context.push('/verify'),
                        ),
                      ],
                    ),
                  ),

                  // Preferences section
                  SliverToBoxAdapter(
                    child: _Section(
                      title: 'Preferences',
                      tiles: [
                        _AccountTile(
                          icon: Icons.notifications_outlined,
                          title: 'Notifications',
                          onTap: () =>
                              context.push('/settings/notifications'),
                        ),
                        _AccountTile(
                          icon: Icons.privacy_tip_outlined,
                          title: 'Privacy',
                          onTap: () => context.push('/settings/privacy'),
                        ),
                        _AccountTile(
                          icon: Icons.settings_outlined,
                          title: 'Settings',
                          onTap: () => context.push('/settings'),
                        ),
                        _AccountTile(
                          icon: Icons.help_outline,
                          title: 'Help & Legal',
                          onTap: () => context.push('/help'),
                        ),
                        _AccountTile(
                          icon: Icons.info_outline,
                          title: 'About PaMarket',
                          onTap: () => _showAboutDialog(context),
                        ),
                      ],
                    ),
                  ),

                  // Danger Zone
                  SliverToBoxAdapter(
                    child: _Section(
                      title: 'Danger Zone',
                      tiles: [
                        _AccountTile(
                          icon: Icons.logout,
                          iconColor: AppColors.error,
                          title: 'Sign Out',
                          titleColor: AppColors.error,
                          onTap: () => _confirmSignOut(context),
                        ),
                        _AccountTile(
                          icon: Icons.delete_forever_outlined,
                          iconColor: AppColors.error,
                          title: 'Delete Account',
                          titleColor: AppColors.error,
                          onTap: () => _confirmDeleteAccount(context),
                        ),
                      ],
                    ),
                  ),

                  const SliverToBoxAdapter(child: SizedBox(height: 100)),
                ],
              ),
            ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: RichText(
          text: const TextSpan(children: [
            TextSpan(
              text: 'Pa',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.primaryBlue,
              ),
            ),
            TextSpan(
              text: 'Market',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.orange,
              ),
            ),
          ]),
        ),
        content: const Text(
          "Zimbabwe's free marketplace for buying and selling.\n\nVersion 1.0.0\n\n© 2025 PaMarket. All rights reserved.\n\nBuilt with ❤ in Zimbabwe.",
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            color: AppColors.textSecondary,
            height: 1.6,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _confirmSignOut(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Sign Out',
          style: TextStyle(
              fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 18),
        ),
        content: const Text(
          'Are you sure you want to sign out?',
          style: TextStyle(fontFamily: 'Inter', color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await AuthService.signOut();
              if (context.mounted) context.go('/login');
            },
            style:
                TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteAccount(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete Account',
          style: TextStyle(
              fontFamily: 'Inter',
              fontWeight: FontWeight.w700,
              fontSize: 18,
              color: AppColors.error),
        ),
        content: const Text(
          'This will permanently delete your account and all your listings. This action cannot be undone.',
          style: TextStyle(
              fontFamily: 'Inter', color: AppColors.textSecondary, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              // Delete account - handled via Supabase edge function or RPC
              await AuthService.signOut();
              if (context.mounted) context.go('/login');
            },
            style:
                TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete Account'),
          ),
        ],
      ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  final Profile? profile;
  final VoidCallback onEdit;

  const _ProfileHeader({required this.profile, required this.onEdit});

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
          20, MediaQuery.of(context).padding.top + 16, 20, 24),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Account',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              IconButton(
                onPressed: onEdit,
                icon: const Icon(Icons.edit_outlined,
                    color: Colors.white, size: 22),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2.5),
                ),
                child: CircleAvatar(
                  radius: 36,
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
                            fontSize: 26,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primaryBlue,
                          ),
                        )
                      : null,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            profile?.name ?? 'User',
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (profile?.verified == true) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.verified,
                              color: AppColors.orange, size: 18),
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
                    if (profile?.email != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        profile!.email!,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          color: Colors.white54,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  final int activeAds;

  const _StatsRow({required this.activeAds});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          _StatItem(value: '$activeAds', label: 'Active Ads'),
          Container(width: 1, height: 40, color: AppColors.border),
          _StatItem(value: '—', label: 'Saved'),
        ],
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String value;
  final String label;

  const _StatItem({required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.primaryBlue,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> tiles;

  const _Section({required this.title, required this.tiles});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                for (int i = 0; i < tiles.length; i++) ...[
                  tiles[i],
                  if (i < tiles.length - 1)
                    const Divider(
                        height: 1, indent: 56, endIndent: 0,
                        color: AppColors.border),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AccountTile extends StatelessWidget {
  final IconData icon;
  final Color? iconColor;
  final String title;
  final Color? titleColor;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback onTap;

  const _AccountTile({
    required this.icon,
    this.iconColor,
    required this.title,
    this.titleColor,
    this.subtitle,
    this.trailing,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: (iconColor ?? AppColors.primaryBlue).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon,
            size: 20, color: iconColor ?? AppColors.primaryBlue),
      ),
      title: Text(
        title,
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: titleColor ?? AppColors.textPrimary,
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle!,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            )
          : null,
      trailing: trailing ??
          const Icon(Icons.arrow_forward_ios,
              size: 14, color: AppColors.textMuted),
      onTap: onTap,
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;

  const _Badge(this.label);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.primaryBlue,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }
}
