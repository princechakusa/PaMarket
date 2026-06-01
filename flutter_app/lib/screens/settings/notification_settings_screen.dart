import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

class NotificationSettingsScreen extends StatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  State<NotificationSettingsScreen> createState() =>
      _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState
    extends State<NotificationSettingsScreen> {
  final _supabase = Supabase.instance.client;
  bool _loading = true;
  Timer? _debounce;

  // Notification toggles
  bool _messages = true;
  bool _listingUpdates = true;
  bool _approvalStatus = true;
  bool _promotions = true;
  bool _savesOnMyListings = true;
  bool _priceDropAlerts = true;
  bool _securityAlerts = true;

  static const _defaults = {
    'messages': true,
    'listing_updates': true,
    'approval_status': true,
    'promotions': true,
    'saves_on_my_listings': true,
    'price_drop_alerts': true,
    'security_alerts': true,
  };

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadPrefs() async {
    if (!AuthService.isSignedIn) {
      setState(() => _loading = false);
      return;
    }
    try {
      final data = await _supabase
          .from('profiles')
          .select('notification_prefs')
          .eq('id', AuthService.currentUserId!)
          .maybeSingle();

      if (mounted) {
        final prefs = (data?['notification_prefs'] as Map<String, dynamic>?) ??
            _defaults;
        setState(() {
          _messages = prefs['messages'] as bool? ?? true;
          _listingUpdates = prefs['listing_updates'] as bool? ?? true;
          _approvalStatus = prefs['approval_status'] as bool? ?? true;
          _promotions = prefs['promotions'] as bool? ?? true;
          _savesOnMyListings =
              prefs['saves_on_my_listings'] as bool? ?? true;
          _priceDropAlerts = prefs['price_drop_alerts'] as bool? ?? true;
          _securityAlerts = prefs['security_alerts'] as bool? ?? true;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onToggle(String key, bool value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), () {
      _savePrefs();
    });
  }

  Future<void> _savePrefs() async {
    if (!AuthService.isSignedIn) return;
    try {
      await _supabase.from('profiles').update({
        'notification_prefs': {
          'messages': _messages,
          'listing_updates': _listingUpdates,
          'approval_status': _approvalStatus,
          'promotions': _promotions,
          'saves_on_my_listings': _savesOnMyListings,
          'price_drop_alerts': _priceDropAlerts,
          'security_alerts': _securityAlerts,
        },
      }).eq('id', AuthService.currentUserId!);
    } catch (_) {
      // Silently fail — user can retry
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notification Preferences')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                _SectionHeader('Messages & Activity'),
                _NotifToggle(
                  title: 'Messages',
                  subtitle: 'New messages from buyers or sellers',
                  value: _messages,
                  onChanged: (v) {
                    setState(() => _messages = v);
                    _onToggle('messages', v);
                  },
                ),
                _NotifToggle(
                  title: 'Listing Updates',
                  subtitle: 'Changes to your listings',
                  value: _listingUpdates,
                  onChanged: (v) {
                    setState(() => _listingUpdates = v);
                    _onToggle('listing_updates', v);
                  },
                ),
                _NotifToggle(
                  title: 'Approval Status',
                  subtitle: 'When your listings are approved or rejected',
                  value: _approvalStatus,
                  onChanged: (v) {
                    setState(() => _approvalStatus = v);
                    _onToggle('approval_status', v);
                  },
                ),
                _NotifToggle(
                  title: 'Saves on My Listings',
                  subtitle: 'When someone saves your listing',
                  value: _savesOnMyListings,
                  onChanged: (v) {
                    setState(() => _savesOnMyListings = v);
                    _onToggle('saves_on_my_listings', v);
                  },
                ),
                const SizedBox(height: 8),
                _SectionHeader('Deals & Promotions'),
                _NotifToggle(
                  title: 'Promotions',
                  subtitle: 'Special offers and featured opportunities',
                  value: _promotions,
                  onChanged: (v) {
                    setState(() => _promotions = v);
                    _onToggle('promotions', v);
                  },
                ),
                _NotifToggle(
                  title: 'Price Drop Alerts',
                  subtitle: 'When saved items drop in price',
                  value: _priceDropAlerts,
                  onChanged: (v) {
                    setState(() => _priceDropAlerts = v);
                    _onToggle('price_drop_alerts', v);
                  },
                ),
                const SizedBox(height: 8),
                _SectionHeader('Security'),
                _NotifToggle(
                  title: 'Security Alerts',
                  subtitle: 'Login attempts and account changes',
                  value: _securityAlerts,
                  onChanged: (v) {
                    setState(() => _securityAlerts = v);
                    _onToggle('security_alerts', v);
                  },
                ),
                const SizedBox(height: 40),
              ],
            ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      child: Text(
        title.toUpperCase(),
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

class _NotifToggle extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _NotifToggle({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
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
