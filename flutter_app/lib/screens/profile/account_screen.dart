import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/listing.dart';
import '../../models/profile.dart';
import '../../services/auth_service.dart';
import '../../services/listing_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_modal.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  Profile? _profile;
  List<Listing> _listings = [];
  int _savedCount = 0;
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
    if (!AuthService.isSignedIn) return const _GuestView();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primaryBlue,
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(child: _ProfileHeader(profile: _profile, onEdit: () => context.push('/edit-profile'))),

                  SliverToBoxAdapter(
                    child: Container(
                      color: AppColors.card,
                      child: Row(
                        children: [
                          _StatCell(value: '$_activeAds', label: 'Active Ads', onTap: () => context.push('/my-listings')),
                          Container(width: 1, height: 48, color: AppColors.border),
                          _StatCell(value: '$_savedCount', label: 'Saved', onTap: () => context.push('/saved')),
                          Container(width: 1, height: 48, color: AppColors.border),
                          _StatCell(value: '0', label: 'Messages', onTap: () => context.go('/messages')),
                        ],
                      ),
                    ),
                  ),

                  SliverToBoxAdapter(
                    child: _Card(margin: const EdgeInsets.fromLTRB(0, 12, 0, 0), children: [
                      _Row(icon: Icons.person_outline, label: 'My Profile', onTap: () {
                        final id = AuthService.currentUserId;
                        if (id != null) context.push('/profile/$id');
                      }),
                      _Row(icon: Icons.history, label: 'My Activity', onTap: () => context.push('/my-activity')),
                      _Row(icon: Icons.edit_outlined, label: 'Edit Profile', onTap: () => context.push('/edit-profile')),
                      _Row(
                        icon: Icons.storefront_outlined,
                        label: 'My Listings',
                        badge: _activeAds > 0 ? '$_activeAds' : null,
                        onTap: () => context.push('/my-listings'),
                      ),
                      _Row(
                        icon: Icons.favorite_outline,
                        label: 'Saved & Favorites',
                        badge: _savedCount > 0 ? '$_savedCount' : null,
                        onTap: () => context.push('/saved'),
                      ),
                      _Row(icon: Icons.work_outline, label: 'My Job Applications', onTap: () => context.push('/applied-jobs')),
                      _Row(
                        icon: Icons.description_outlined,
                        label: 'My Job Profile / CV',
                        badgeWidget: _profile?.verified == true ? const _CheckBadge() : null,
                        onTap: () => context.push('/job-profile'),
                      ),
                      _Row(icon: Icons.campaign_outlined, label: 'Advertisements', onTap: () => context.push('/advertise')),
                      _Row(icon: Icons.computer_outlined, label: 'My Advertisements', onTap: () => context.push('/my-listings')),
                    ]),
                  ),

                  SliverToBoxAdapter(
                    child: _Card(margin: const EdgeInsets.fromLTRB(0, 12, 0, 0), children: [
                      _Row(icon: Icons.settings_outlined, label: 'Settings', onTap: () => context.push('/settings')),
                      _Row(icon: Icons.security_outlined, label: 'Security & Password', onTap: () => context.push('/settings/security')),
                      _Row(icon: Icons.help_outline, label: 'Help & Support', onTap: () => context.push('/help/faq')),
                    ]),
                  ),

                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      child: TextButton(
                        onPressed: () => _confirmSignOut(context),
                        style: TextButton.styleFrom(
                          backgroundColor: const Color(0xFFFFF1F0),
                          foregroundColor: AppColors.error,
                          minimumSize: const Size(double.infinity, 52),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: const BorderSide(color: Color(0xFFFECACA), width: 1.5),
                          ),
                          textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w700),
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
              if (context.mounted) context.go('/home');
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }
}

// ── Guest (logged-out) view ─────────────────────────────────────────────────

class _GuestView extends StatelessWidget {
  const _GuestView();

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
                decoration: BoxDecoration(color: AppColors.primaryBlue, borderRadius: BorderRadius.circular(16)),
                child: RichText(
                  text: const TextSpan(children: [
                    TextSpan(text: 'Pa', style: TextStyle(fontFamily: 'Inter', fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white)),
                    TextSpan(text: 'Market', style: TextStyle(fontFamily: 'Inter', fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.orange, fontStyle: FontStyle.italic)),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  const Text('Login to continue',
                      style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: AppColors.textSecondary)),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => showAuthModal(context, 'Login to continue'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryBlue,
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
            GestureDetector(
              onTap: () => showAuthModal(context, 'Login to continue'),
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
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(color: AppColors.lightBlue, borderRadius: BorderRadius.circular(10)),
                      child: const Icon(Icons.history, color: AppColors.primaryBlue, size: 22),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('My Activity', style: TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w700)),
                        SizedBox(height: 2),
                        Text('View your recent searches and activities',
                            style: TextStyle(fontFamily: 'Inter', fontSize: 12, color: AppColors.textSecondary)),
                      ]),
                    ),
                    const Icon(Icons.arrow_forward_ios, size: 14, color: AppColors.textMuted),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text('More on PaMarket',
                style: TextStyle(fontFamily: 'Inter', fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            const SizedBox(height: 12),
            _Card(children: [
              _MoreRow(icon: Icons.campaign_outlined, label: 'Advertisements', onTap: () => showAuthModal(context, 'Login to manage advertisements')),
              _MoreRow(icon: Icons.favorite_outline, label: 'Favourites', onTap: () => showAuthModal(context, 'Login to continue')),
              _MoreRow(icon: Icons.search, label: 'Saved Searches', onTap: () => showAuthModal(context, 'Login to continue')),
              _MoreRow(icon: Icons.work_outline, label: 'Find Jobs', onTap: () => context.push('/jobs')),
              _MoreRow(icon: Icons.notifications_outlined, label: 'Notification Center', onTap: () => context.push('/notifications')),
              _MoreRow(
                icon: Icons.language,
                label: 'Language',
                valueText: 'English',
                onTap: () => ScaffoldMessenger.of(context)
                    .showSnackBar(const SnackBar(content: Text('Language coming soon'))),
              ),
              _MoreRow(icon: Icons.help_outline, label: 'Help & Support', onTap: () => context.push('/help/faq')),
              _MoreRow(icon: Icons.info_outline, label: 'About Us', onTap: () => _showAbout(context)),
              _MoreRow(
                icon: Icons.privacy_tip_outlined,
                label: 'Privacy Policy',
                onTap: () => _showLegalPage(context, 'Privacy Policy'),
              ),
              _MoreRow(
                icon: Icons.gavel_outlined,
                label: 'Terms of Service',
                onTap: () => _showLegalPage(context, 'Terms of Service'),
              ),
            ]),
            const SizedBox(height: 24),
            const _Footer(),
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
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
          "Zimbabwe's free marketplace.\n\nVersion 1.0.0\n\n© 2026 PaMarket. All rights reserved.\n\nMade with love in Zimbabwe.",
          style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: AppColors.textSecondary, height: 1.6),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
      ),
    );
  }

  void _showLegalPage(BuildContext context, String title) {
    final isTerms = title.contains('Terms');
    final content = isTerms
        ? 'By using PaMarket you agree to post only lawful content, not misrepresent items, and comply with Zimbabwe\'s Electronic Transactions Act. PaMarket reserves the right to remove listings or suspend accounts that violate these terms.\n\nAll transactions are between buyers and sellers. PaMarket does not guarantee product quality or delivery.\n\n© 2026 PaMarket. All rights reserved.'
        : 'PaMarket collects your email, phone number, and listing data to operate the marketplace. We do not sell your personal data.\n\nYour contact details are shared with other users only when you initiate a chat or post a listing.\n\nWe use Supabase to store data securely. You may request deletion of your account at any time by contacting support.\n\n© 2026 PaMarket. All rights reserved.';

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: const TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w700)),
        content: SingleChildScrollView(
          child: Text(content, style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: AppColors.textSecondary, height: 1.7)),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
      ),
    );
  }
}

// ── Profile Header ────────────────────────────────────────────────────────────

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
          colors: [Color(0xFF1A3A8F), Color(0xFF2952CC)],
        ),
      ),
      padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 16, 20, 24),
      child: Row(
        children: [
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 2.5),
            ),
            child: CircleAvatar(
              radius: 32,
              backgroundColor: Colors.white.withValues(alpha: 0.2),
              backgroundImage: profile?.avatar != null ? CachedNetworkImageProvider(profile!.avatar!) : null,
              child: profile?.avatar == null
                  ? Text(
                      profile?.name.isNotEmpty == true ? profile!.name[0].toUpperCase() : 'U',
                      style: const TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white),
                    )
                  : null,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Flexible(
                    child: Text(
                      profile?.name ?? 'User',
                      style: const TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (profile?.verified == true) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: const Color(0xFF22C55E), borderRadius: BorderRadius.circular(20)),
                      child: const Text('Verified', style: TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                  ],
                ]),
                if (profile?.email != null) ...[
                  const SizedBox(height: 3),
                  Text(profile!.email!, style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: Colors.white70), overflow: TextOverflow.ellipsis),
                ],
                if (profile?.city != null) ...[
                  const SizedBox(height: 2),
                  Text(profile!.city!, style: const TextStyle(fontFamily: 'Inter', fontSize: 12, color: Colors.white54)),
                ],
              ],
            ),
          ),
          IconButton(onPressed: onEdit, icon: const Icon(Icons.edit_outlined, color: Colors.white70, size: 20)),
        ],
      ),
    );
  }
}

// ── Stat Cell ─────────────────────────────────────────────────────────────────

class _StatCell extends StatelessWidget {
  final String value;
  final String label;
  final VoidCallback onTap;
  const _StatCell({required this.value, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          color: AppColors.card,
          child: Column(
            children: [
              Text(value, style: const TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.primaryBlue)),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontFamily: 'Inter', fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  final List<Widget> children;
  final EdgeInsets? margin;
  const _Card({required this.children, this.margin});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: AppColors.card,
        border: const Border(
          top: BorderSide(color: AppColors.border),
          bottom: BorderSide(color: AppColors.border),
        ),
      ),
      child: Column(
        children: [
          for (int i = 0; i < children.length; i++) ...[
            children[i],
            if (i < children.length - 1) const Divider(height: 1, indent: 56, color: AppColors.border),
          ],
        ],
      ),
    );
  }
}

// ── Menu Row (logged-in) ──────────────────────────────────────────────────────

class _Row extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? badge;
  final Widget? badgeWidget;
  final VoidCallback onTap;
  const _Row({required this.icon, required this.label, this.badge, this.badgeWidget, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.lightBlue,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: AppColors.primaryBlue),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(label, style: const TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            ),
            if (badge != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: AppColors.orange, borderRadius: BorderRadius.circular(10)),
                child: Text(badge!, style: const TextStyle(fontFamily: 'Inter', fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.primaryBlue)),
              ),
            if (badgeWidget != null) badgeWidget!,
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, size: 18, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

// ── More Row (guest list) ─────────────────────────────────────────────────────

class _MoreRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? valueText;
  final VoidCallback onTap;
  const _MoreRow({required this.icon, required this.label, this.valueText, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 22, color: AppColors.textSecondary),
            const SizedBox(width: 14),
            Expanded(
              child: Text(label, style: const TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
            ),
            if (valueText != null)
              Text(valueText!, style: const TextStyle(fontFamily: 'Inter', fontSize: 14, color: AppColors.textSecondary)),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, size: 18, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

// ── Small helpers ─────────────────────────────────────────────────────────────

class _CheckBadge extends StatelessWidget {
  const _CheckBadge();
  @override
  Widget build(BuildContext context) => Container(
        width: 24,
        height: 24,
        decoration: const BoxDecoration(color: AppColors.orange, shape: BoxShape.circle),
        child: const Icon(Icons.check, color: Colors.white, size: 14),
      );
}

class _Footer extends StatelessWidget {
  const _Footer();
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
      child: Column(
        children: [
          const Text('© 2026 PaMarket · Made in Zimbabwe',
              style: TextStyle(fontFamily: 'Inter', fontSize: 11, color: AppColors.textMuted), textAlign: TextAlign.center),
          const SizedBox(height: 4),
          const Text('All rights reserved', style: TextStyle(fontFamily: 'Inter', fontSize: 10, color: AppColors.textMuted)),
          const SizedBox(height: 4),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            GestureDetector(
              onTap: () => _showLegal(context, 'Terms of Service'),
              child: const Text('Terms', style: TextStyle(fontFamily: 'Inter', fontSize: 10, color: AppColors.textSecondary, decoration: TextDecoration.underline)),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 6),
              child: Text('·', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
            ),
            GestureDetector(
              onTap: () => _showLegal(context, 'Privacy Policy'),
              child: const Text('Privacy', style: TextStyle(fontFamily: 'Inter', fontSize: 10, color: AppColors.textSecondary, decoration: TextDecoration.underline)),
            ),
          ]),
        ],
      ),
    );
  }

  void _showLegal(BuildContext context, String title) {
    final isTerms = title.contains('Terms');
    final content = isTerms
        ? 'By using PaMarket you agree to post only lawful content, not misrepresent items, and comply with Zimbabwe\'s Electronic Transactions Act. PaMarket reserves the right to remove listings or suspend accounts that violate these terms.\n\nAll transactions are between buyers and sellers. PaMarket does not guarantee product quality or delivery.\n\n© 2026 PaMarket. All rights reserved.'
        : 'PaMarket collects your email, phone number, and listing data to operate the marketplace. We do not sell your personal data.\n\nYour contact details are shared with other users only when you initiate a chat or post a listing.\n\nWe use Supabase to store data securely. You may request deletion of your account at any time by contacting support.\n\n© 2026 PaMarket. All rights reserved.';
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: const TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w700)),
        content: SingleChildScrollView(
          child: Text(content, style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: AppColors.textSecondary, height: 1.7)),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
      ),
    );
  }
}
