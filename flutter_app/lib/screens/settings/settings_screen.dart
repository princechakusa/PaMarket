import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_modal.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _supabase = Supabase.instance.client;

  // Notification prefs
  bool _notifMessages = true;
  bool _notifListings = true;
  bool _notifApprovals = true;
  bool _notifPromotions = true;
  bool _notifFavorites = true;
  bool _notifPriceDrops = true;
  bool _notifSecurity = true;

  // Privacy prefs
  bool _profilePublic = true;
  bool _showPhone = false;
  bool _allowMessages = true;
  bool _showActivity = false;

  // Appearance
  String _theme = 'Light';

  bool _loading = true;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    if (AuthService.isSignedIn) {
      _loadSettings();
    } else {
      setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    try {
      final data = await _supabase
          .from('profiles')
          .select('notification_prefs, privacy_settings, theme')
          .eq('id', AuthService.currentUserId!)
          .maybeSingle();

      if (mounted && data != null) {
        final notif = (data['notification_prefs'] as Map<String, dynamic>?) ?? {};
        final priv = (data['privacy_settings'] as Map<String, dynamic>?) ?? {};
        final themeVal = data['theme'] as String? ?? 'Light';

        setState(() {
          _notifMessages = notif['messages'] as bool? ?? true;
          _notifListings = notif['listing_updates'] as bool? ?? true;
          _notifApprovals = notif['approval_status'] as bool? ?? true;
          _notifPromotions = notif['promotions'] as bool? ?? true;
          _notifFavorites = notif['saves_on_my_listings'] as bool? ?? true;
          _notifPriceDrops = notif['price_drop_alerts'] as bool? ?? true;
          _notifSecurity = notif['security_alerts'] as bool? ?? true;

          _profilePublic = priv['public_profile'] as bool? ?? true;
          _showPhone = priv['show_phone_in_listings'] as bool? ?? false;
          _allowMessages = priv['allow_direct_messages'] as bool? ?? true;
          _showActivity = priv['show_activity_status'] as bool? ?? false;

          _theme = themeVal;
          _loading = false;
        });
      } else if (mounted) {
        setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _scheduleNotifSave() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), _saveNotifPrefs);
  }

  void _schedulePrivacySave() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), _savePrivacyPrefs);
  }

  Future<void> _saveNotifPrefs() async {
    if (!AuthService.isSignedIn) return;
    try {
      await _supabase.from('profiles').update({
        'notification_prefs': {
          'messages': _notifMessages,
          'listing_updates': _notifListings,
          'approval_status': _notifApprovals,
          'promotions': _notifPromotions,
          'saves_on_my_listings': _notifFavorites,
          'price_drop_alerts': _notifPriceDrops,
          'security_alerts': _notifSecurity,
        },
      }).eq('id', AuthService.currentUserId!);
    } catch (_) {}
  }

  Future<void> _savePrivacyPrefs() async {
    if (!AuthService.isSignedIn) return;
    try {
      await _supabase.from('profiles').update({
        'privacy_settings': {
          'public_profile': _profilePublic,
          'show_phone_in_listings': _showPhone,
          'allow_direct_messages': _allowMessages,
          'show_activity_status': _showActivity,
        },
      }).eq('id', AuthService.currentUserId!);
    } catch (_) {}
  }

  Future<void> _saveTheme(String theme) async {
    if (!AuthService.isSignedIn) return;
    try {
      await _supabase
          .from('profiles')
          .update({'theme': theme})
          .eq('id', AuthService.currentUserId!);
    } catch (_) {}
  }

  Future<void> _signOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Sign Out',
          style: TextStyle(
              fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 18),
        ),
        content: const Text(
          'Are you sure you want to sign out?',
          style: TextStyle(
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
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await AuthService.signOut();
      if (mounted) context.go('/profile');
    }
  }

  void _showThemeDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Theme',
          style: TextStyle(
              fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 18),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final option in ['Light', 'Dark', 'System'])
              RadioListTile<String>(
                title: Row(
                  children: [
                    Icon(
                      option == 'Light'
                          ? Icons.light_mode_outlined
                          : option == 'Dark'
                              ? Icons.dark_mode_outlined
                              : Icons.settings_suggest_outlined,
                      size: 20,
                      color: AppColors.primaryBlue,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '${option} Mode',
                      style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 15,
                          fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                value: option,
                groupValue: _theme,
                activeColor: AppColors.primaryBlue,
                onChanged: (v) {
                  if (v != null) {
                    setState(() => _theme = v);
                    _saveTheme(v);
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Theme updated to $v')),
                    );
                  }
                },
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Settings')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.settings_outlined,
                    size: 72, color: AppColors.border),
                const SizedBox(height: 20),
                const Text(
                  'Sign in to access settings',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Manage your notifications, privacy, and account preferences.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 28),
                ElevatedButton(
                  onPressed: () =>
                      showAuthModal(context, 'Sign in to access settings'),
                  child: const Text('Sign In'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              children: [
                // ── Appearance ───────────────────────────────────────────
                _SectionLabel('Appearance'),
                _SettingsCard(children: [
                  _NavTile(
                    icon: Icons.palette_outlined,
                    title: 'Theme',
                    trailing: Text(
                      _theme,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    onTap: _showThemeDialog,
                  ),
                ]),
                const SizedBox(height: 20),

                // ── Notifications ────────────────────────────────────────
                _SectionLabel('Notifications'),
                _SettingsCard(children: [
                  _ToggleTile(
                    icon: Icons.chat_bubble_outline,
                    title: 'Messages',
                    subtitle: 'New messages from buyers or sellers',
                    value: _notifMessages,
                    onChanged: (v) {
                      setState(() => _notifMessages = v);
                      _scheduleNotifSave();
                    },
                  ),
                  _ToggleTile(
                    icon: Icons.list_alt_outlined,
                    title: 'Listing Updates',
                    subtitle: 'Changes to your listings',
                    value: _notifListings,
                    onChanged: (v) {
                      setState(() => _notifListings = v);
                      _scheduleNotifSave();
                    },
                  ),
                  _ToggleTile(
                    icon: Icons.check_circle_outline,
                    title: 'Approval Status',
                    subtitle: 'When your listings are approved or rejected',
                    value: _notifApprovals,
                    onChanged: (v) {
                      setState(() => _notifApprovals = v);
                      _scheduleNotifSave();
                    },
                  ),
                  _ToggleTile(
                    icon: Icons.star_outline,
                    title: 'Promotions',
                    subtitle: 'Special offers and featured opportunities',
                    value: _notifPromotions,
                    onChanged: (v) {
                      setState(() => _notifPromotions = v);
                      _scheduleNotifSave();
                    },
                  ),
                  _ToggleTile(
                    icon: Icons.favorite_outline,
                    title: 'Saves on My Listings',
                    subtitle: 'When someone saves your listing',
                    value: _notifFavorites,
                    onChanged: (v) {
                      setState(() => _notifFavorites = v);
                      _scheduleNotifSave();
                    },
                  ),
                  _ToggleTile(
                    icon: Icons.trending_down_outlined,
                    title: 'Price Drop Alerts',
                    subtitle: 'When saved items drop in price',
                    value: _notifPriceDrops,
                    onChanged: (v) {
                      setState(() => _notifPriceDrops = v);
                      _scheduleNotifSave();
                    },
                  ),
                  _ToggleTile(
                    icon: Icons.lock_outline,
                    title: 'Security Alerts',
                    subtitle: 'Login attempts and account changes',
                    value: _notifSecurity,
                    onChanged: (v) {
                      setState(() => _notifSecurity = v);
                      _scheduleNotifSave();
                    },
                  ),
                ]),
                const SizedBox(height: 20),

                // ── Account & Privacy ─────────────────────────────────────
                _SectionLabel('Account & Privacy'),
                _SettingsCard(children: [
                  _NavTile(
                    icon: Icons.person_outline,
                    title: 'Edit Profile',
                    onTap: () => context.push('/edit-profile'),
                  ),
                  _NavTile(
                    icon: Icons.lock_outline,
                    title: 'Change Password',
                    onTap: () => context.push('/settings/security'),
                  ),
                ]),
                const SizedBox(height: 20),

                // ── Privacy ───────────────────────────────────────────────
                _SectionLabel('Privacy'),
                _SettingsCard(children: [
                  _ToggleTile(
                    icon: Icons.visibility_outlined,
                    title: 'Public Profile',
                    subtitle: 'Others can view your profile',
                    value: _profilePublic,
                    onChanged: (v) {
                      setState(() => _profilePublic = v);
                      _schedulePrivacySave();
                    },
                  ),
                  _ToggleTile(
                    icon: Icons.phone_outlined,
                    title: 'Show Phone in Listings',
                    subtitle: 'Display your phone number on listings',
                    value: _showPhone,
                    onChanged: (v) {
                      setState(() => _showPhone = v);
                      _schedulePrivacySave();
                    },
                  ),
                  _ToggleTile(
                    icon: Icons.message_outlined,
                    title: 'Allow Direct Messages',
                    subtitle: 'Let other users send you messages',
                    value: _allowMessages,
                    onChanged: (v) {
                      setState(() => _allowMessages = v);
                      _schedulePrivacySave();
                    },
                  ),
                  _ToggleTile(
                    icon: Icons.access_time_outlined,
                    title: 'Show Activity Status',
                    subtitle: 'Let others see when you were last active',
                    value: _showActivity,
                    onChanged: (v) {
                      setState(() => _showActivity = v);
                      _schedulePrivacySave();
                    },
                  ),
                ]),
                const SizedBox(height: 20),

                // ── Actions ───────────────────────────────────────────────
                _SectionLabel('Actions'),
                _SettingsCard(children: [
                  _NavTile(
                    icon: Icons.block_outlined,
                    title: 'Blocked Users',
                    onTap: () => context.push('/settings/blocked-users'),
                  ),
                ]),
                const SizedBox(height: 20),

                // ── Help ──────────────────────────────────────────────────
                _SectionLabel('Help'),
                _SettingsCard(children: [
                  _NavTile(
                    icon: Icons.help_outline,
                    title: 'FAQ',
                    onTap: () => context.push('/help'),
                  ),
                  _NavTile(
                    icon: Icons.support_agent_outlined,
                    title: 'Contact Support',
                    onTap: () => context.push('/help'),
                  ),
                ]),
                const SizedBox(height: 20),

                // ── Legal ─────────────────────────────────────────────────
                _SectionLabel('Legal'),
                _SettingsCard(children: [
                  _NavTile(
                    icon: Icons.description_outlined,
                    title: 'Terms of Service',
                    onTap: () => context.push('/help'),
                  ),
                  _NavTile(
                    icon: Icons.privacy_tip_outlined,
                    title: 'Privacy Policy',
                    onTap: () => context.push('/help'),
                  ),
                ]),
                const SizedBox(height: 20),

                // ── Danger Zone ───────────────────────────────────────────
                _SectionLabel('Danger Zone'),
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                        color: AppColors.error.withValues(alpha: 0.3)),
                  ),
                  child: _NavTile(
                    icon: Icons.delete_forever_outlined,
                    iconColor: AppColors.error,
                    title: 'Delete Account',
                    titleColor: AppColors.error,
                    onTap: () => context.push('/settings/security'),
                  ),
                ),
                const SizedBox(height: 24),

                // ── Sign Out ──────────────────────────────────────────────
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _signOut,
                    icon: const Icon(Icons.logout,
                        color: AppColors.error, size: 20),
                    label: const Text(
                      'Sign Out',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.error,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side:
                          BorderSide(color: AppColors.error.withValues(alpha: 0.4)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
          letterSpacing: 1,
        ),
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  final List<Widget> children;
  const _SettingsCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          for (int i = 0; i < children.length; i++) ...[
            children[i],
            if (i < children.length - 1)
              const Divider(
                  height: 1, indent: 56, endIndent: 0, color: AppColors.border),
          ],
        ],
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  final IconData icon;
  final Color? iconColor;
  final String title;
  final Color? titleColor;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _NavTile({
    required this.icon,
    this.iconColor,
    required this.title,
    this.titleColor,
    this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = iconColor ?? AppColors.primaryBlue;
    return ListTile(
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 20, color: color),
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
      trailing: trailing ??
          const Icon(Icons.arrow_forward_ios,
              size: 14, color: AppColors.textMuted),
      onTap: onTap,
    );
  }
}

class _ToggleTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ToggleTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      secondary: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: AppColors.lightBlue,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 20, color: AppColors.primaryBlue),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 12,
          color: AppColors.textSecondary,
        ),
      ),
      value: value,
      onChanged: onChanged,
      activeColor: AppColors.primaryBlue,
    );
  }
}
