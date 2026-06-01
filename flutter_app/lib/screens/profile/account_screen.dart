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
          final d = results[0] as Map<String, dynamic>?;
          if (d != null) _profile = Profile.fromMap(d);
          _listings = results[1] as List<Listing>;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  int get _activeAds => _listings.where((l) => l.status == 'active').length;

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn) {
      return const _LoggedOutView();
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
                  SliverToBoxAdapter(
                    child: _ProfileHeader(
                      profile: _profile,
                      activeAds: _activeAds,
                      onEdit: () => context.push('/edit-profile'),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: _SectionCard(
                      children: [
                        _Tile(
                          icon: Icons.favorite_outline,
                          iconColor: const Color(0xFFE91E63),
                          title: 'Saved & Favorites',
                          onTap: () => context.push('/saved'),
                        ),
                        _Tile(
                          icon: Icons.work_outline,
                          iconColor: const Color(0xFF3F51B5),
                          title: 'My Job Applications',
                          onTap: () => _soon(context, 'My Job Applications'),
                        ),
                        _Tile(
                          icon: Icons.description_outlined,
                          iconColor: const Color(0xFF009688),
                          title: 'My Job Profile / CV',
                          trailing: _OrangeBadge(),
                          onTap: () => _soon(context, 'My Job Profile / CV'),
                        ),
                        _Tile(
                          icon: Icons.campaign_outlined,
                          iconColor: const Color(0xFFFF9800),
                          title: 'Advertisements',
                          onTap: () => _soon(context, 'Advertisements'),
                        ),
                        _Tile(
                          icon: Icons.storefront_outlined,
                          iconColor: const Color(0xFF9C27B0),
                          title: 'My Advertisements',
                          onTap: () => context.push('/my-listings'),
                        ),
                      ],
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: _SectionCard(
                      children: [
                        _Tile(
                          icon: Icons.settings_outlined,
                          title: 'Settings',
                          onTap: () => context.push('/settings'),
                        ),
                        _Tile(
                          icon: Icons.security_outlined,
                          title: 'Security & Password',
                          onTap: () => context.push('/settings/security'),
                        ),
                        _Tile(
                          icon: Icons.help_outline,
                          title: 'Help & Support',
                          onTap: () => context.push('/help/faq'),
                        ),
                      ],
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: OutlinedButton(
                        onPressed: () => _confirmSignOut(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.error,
                          side: BorderSide(color: AppColors.error.withValues(alpha: 0.4)),
                          minimumSize: const Size(double.infinity, 50),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w600),
                        ),
                        child: const Text('Sign Out'),
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(child: _Footer()),
                  const SliverToBoxAdapter(child: SizedBox(height: 100)),
                ],
              ),
            ),
    );
  }

  void _soon(BuildContext context, String f) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$f coming soon')));
  }

  void _confirmSignOut(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign Out', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 18)),
        content: const Text('Are you sure you want to sign out?', style: TextStyle(fontFamily: 'Inter', color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await AuthService.signOut();
              if (context.mounted) context.go('/login');
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }
}

// ── Logged-Out View ──────────────────────────────────────────────────────────

class _LoggedOutView extends StatelessWidget {
  const _LoggedOutView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SizedBox(height: 20),
            Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.primaryBlue,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: RichText(
                  text: const TextSpan(children: [
                    TextSpan(text: 'Pa', style: TextStyle(fontFamily: 'Inter', fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white)),
                    TextSpan(text: 'Market', style: TextStyle(fontFamily: 'Inter', fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.orange)),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: 24),
            // Login card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  const Text('Login to continue', style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: AppColors.textSecondary)),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => context.push('/login'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryBlue,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 48),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 1),
                    ),
                    child: const Text('SIGN IN / SIGN UP'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // My Activity
            GestureDetector(
              onTap: () => context.push('/search'),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40, height: 40,
                      decoration: BoxDecoration(color: AppColors.lightBlue, borderRadius: BorderRadius.circular(10)),
                      child: const Icon(Icons.search, color: AppColors.primaryBlue, size: 22),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('My Activity', style: TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                          SizedBox(height: 2),
                          Text('View your recent searches and activities', style: TextStyle(fontFamily: 'Inter', fontSize: 12, color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios, size: 14, color: AppColors.textMuted),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text('More on PaMarket', style: TextStyle(fontFamily: 'Inter', fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  _MoreTile(icon: Icons.campaign_outlined, title: 'Advertisements', onTap: () => _soon(context, 'Advertisements')),
                  const _HDivider(),
                  _MoreTile(icon: Icons.favorite_outline, title: 'Favourites', onTap: () => context.push('/login')),
                  const _HDivider(),
                  _MoreTile(icon: Icons.search, title: 'Saved Searches', onTap: () => _soon(context, 'Saved Searches')),
                  const _HDivider(),
                  _MoreTile(icon: Icons.work_outline, title: 'Find Jobs', onTap: () => context.push('/category/jobs?name=Jobs')),
                  const _HDivider(),
                  _MoreTile(icon: Icons.notifications_outlined, title: 'Notification Center', onTap: () => context.push('/login')),
                  const _HDivider(),
                  _MoreTile(
                    icon: Icons.language,
                    title: 'Language',
                    trailing: const Text('English', style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: AppColors.textSecondary)),
                    onTap: () => _soon(context, 'Language'),
                  ),
                  const _HDivider(),
                  _MoreTile(icon: Icons.help_outline, title: 'Help & Support', onTap: () => context.push('/help/faq')),
                  const _HDivider(),
                  _MoreTile(icon: Icons.info_outline, title: 'About Us', onTap: () => _showAbout(context)),
                  const _HDivider(),
                  _MoreTile(icon: Icons.privacy_tip_outlined, title: 'Privacy Policy', onTap: () => _soon(context, 'Privacy Policy')),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const _Footer(),
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }

  void _soon(BuildContext context, String f) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$f coming soon')));
  }

  void _showAbout(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: RichText(
          text: const TextSpan(children: [
            TextSpan(text: 'Pa', style: TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.primaryBlue)),
            TextSpan(text: 'Market', style: TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.orange)),
          ]),
        ),
        content: const Text(
          "Zimbabwe's free marketplace for buying and selling.\n\nVersion 1.0.0\n\n© 2026 PaMarket. All rights reserved.\n\nMade with ♥ in Zimbabwe.",
          style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: AppColors.textSecondary, height: 1.6),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
      ),
    );
  }
}

// ── Profile Header (logged-in) ──────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  final Profile? profile;
  final int activeAds;
  final VoidCallback onEdit;

  const _ProfileHeader({required this.profile, required this.activeAds, required this.onEdit});

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
      padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 16, 20, 24),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Account', style: TextStyle(fontFamily: 'Inter', fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white)),
              IconButton(onPressed: onEdit, icon: const Icon(Icons.edit_outlined, color: Colors.white, size: 22)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2.5)),
                child: CircleAvatar(
                  radius: 36,
                  backgroundColor: AppColors.lightBlue,
                  backgroundImage: profile?.avatar != null ? CachedNetworkImageProvider(profile!.avatar!) : null,
                  child: profile?.avatar == null
                      ? Text(
                          profile?.name.isNotEmpty == true ? profile!.name[0].toUpperCase() : 'U',
                          style: const TextStyle(fontFamily: 'Inter', fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.primaryBlue),
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
                          child: Text(profile?.name ?? 'User',
                              style: const TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white),
                              overflow: TextOverflow.ellipsis),
                        ),
                        if (profile?.verified == true) ...
                        [
                          const SizedBox(width: 6),
                          const Icon(Icons.verified, color: AppColors.orange, size: 18),
                        ],
                      ],
                    ),
                    if (profile?.city != null) ...
                    [
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.location_on_outlined, size: 13, color: Colors.white60),
                          const SizedBox(width: 3),
                          Text(profile!.city!, style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: Colors.white70)),
                        ],
                      ),
                    ],
                    if (profile?.email != null) ...
                    [
                      const SizedBox(height: 2),
                      Text(profile!.email!, style: const TextStyle(fontFamily: 'Inter', fontSize: 12, color: Colors.white54), overflow: TextOverflow.ellipsis),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _StatItem(value: '$activeAds', label: 'Active Ads'),
              ],
            ),
          ),
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
    return Column(
      children: [
        Text(value, style: const TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontFamily: 'Inter', fontSize: 12, color: Colors.white60)),
      ],
    );
  }
}

// ── Section Card ──────────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final List<Widget> children;
  const _SectionCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            for (int i = 0; i < children.length; i++) ...
            [
              children[i],
              if (i < children.length - 1) const _HDivider(),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Tile ─────────────────────────────────────────────────────────────────────

class _Tile extends StatelessWidget {
  final IconData icon;
  final Color? iconColor;
  final String title;
  final Color? titleColor;
  final Widget? trailing;
  final VoidCallback onTap;

  const _Tile({
    required this.icon,
    this.iconColor,
    required this.title,
    this.titleColor,
    this.trailing,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = iconColor ?? AppColors.primaryBlue;
    return ListTile(
      leading: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 20, color: color),
      ),
      title: Text(title, style: TextStyle(
        fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w600,
        color: titleColor ?? AppColors.textPrimary,
      )),
      trailing: trailing ?? const Icon(Icons.arrow_forward_ios, size: 14, color: AppColors.textMuted),
      onTap: onTap,
    );
  }
}

// ── More Tile (logged-out list) ──────────────────────────────────────────────

class _MoreTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget? trailing;
  final VoidCallback onTap;

  const _MoreTile({required this.icon, required this.title, this.trailing, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, size: 22, color: AppColors.textSecondary),
      title: Text(title, style: const TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
      trailing: trailing != null
          ? Row(mainAxisSize: MainAxisSize.min, children: [trailing!, const SizedBox(width: 6), const Icon(Icons.arrow_forward_ios, size: 14, color: AppColors.textMuted)])
          : const Icon(Icons.arrow_forward_ios, size: 14, color: AppColors.textMuted),
      onTap: onTap,
    );
  }
}

// ── Orange Badge ──────────────────────────────────────────────────────────────

class _OrangeBadge extends StatelessWidget {
  const _OrangeBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 26, height: 26,
      decoration: const BoxDecoration(color: AppColors.orange, shape: BoxShape.circle),
      child: const Icon(Icons.check, color: Colors.white, size: 16),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _HDivider extends StatelessWidget {
  const _HDivider();

  @override
  Widget build(BuildContext context) =>
      const Divider(height: 1, indent: 56, endIndent: 0, color: AppColors.border);
}

class _Footer extends StatelessWidget {
  const _Footer();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
      child: Column(
        children: [
          const Text('© 2026 PaMarket · Made in Zimbabwe 🇿🇼',
              style: TextStyle(fontFamily: 'Inter', fontSize: 12, color: AppColors.textMuted), textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              GestureDetector(
                onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Terms coming soon'))),
                child: const Text('Terms', style: TextStyle(fontFamily: 'Inter', fontSize: 12, color: AppColors.textSecondary, decoration: TextDecoration.underline)),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Text('·', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
              ),
              GestureDetector(
                onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Privacy Policy coming soon'))),
                child: const Text('Privacy', style: TextStyle(fontFamily: 'Inter', fontSize: 12, color: AppColors.textSecondary, decoration: TextDecoration.underline)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
