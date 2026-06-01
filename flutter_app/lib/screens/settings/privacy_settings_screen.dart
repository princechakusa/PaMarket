import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

class PrivacySettingsScreen extends StatefulWidget {
  const PrivacySettingsScreen({super.key});

  @override
  State<PrivacySettingsScreen> createState() => _PrivacySettingsScreenState();
}

class _PrivacySettingsScreenState extends State<PrivacySettingsScreen> {
  final _supabase = Supabase.instance.client;
  bool _loading = true;
  Timer? _debounce;

  bool _publicProfile = true;
  bool _showPhoneInListings = false;
  bool _allowDirectMessages = true;
  bool _showActivityStatus = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    if (!AuthService.isSignedIn) {
      setState(() => _loading = false);
      return;
    }
    try {
      final data = await _supabase
          .from('profiles')
          .select('privacy_settings')
          .eq('id', AuthService.currentUserId!)
          .maybeSingle();

      if (mounted) {
        final settings =
            (data?['privacy_settings'] as Map<String, dynamic>?) ?? {};
        setState(() {
          _publicProfile = settings['public_profile'] as bool? ?? true;
          _showPhoneInListings =
              settings['show_phone_in_listings'] as bool? ?? false;
          _allowDirectMessages =
              settings['allow_direct_messages'] as bool? ?? true;
          _showActivityStatus =
              settings['show_activity_status'] as bool? ?? false;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onChange(String key, bool value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), _saveSettings);
  }

  Future<void> _saveSettings() async {
    if (!AuthService.isSignedIn) return;
    try {
      await _supabase.from('profiles').update({
        'privacy_settings': {
          'public_profile': _publicProfile,
          'show_phone_in_listings': _showPhoneInListings,
          'allow_direct_messages': _allowDirectMessages,
          'show_activity_status': _showActivityStatus,
        },
      }).eq('id', AuthService.currentUserId!);
    } catch (_) {
      // Silently fail
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy Settings')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                _PrivacyToggle(
                  title: 'Public Profile',
                  subtitle: 'Others can view your profile and listings',
                  value: _publicProfile,
                  onChanged: (v) {
                    setState(() => _publicProfile = v);
                    _onChange('public_profile', v);
                  },
                ),
                _PrivacyToggle(
                  title: 'Show Phone in Listings',
                  subtitle:
                      'Display your phone number on your listings',
                  value: _showPhoneInListings,
                  onChanged: (v) {
                    setState(() => _showPhoneInListings = v);
                    _onChange('show_phone_in_listings', v);
                  },
                ),
                _PrivacyToggle(
                  title: 'Allow Direct Messages',
                  subtitle: 'Let other users send you messages',
                  value: _allowDirectMessages,
                  onChanged: (v) {
                    setState(() => _allowDirectMessages = v);
                    _onChange('allow_direct_messages', v);
                  },
                ),
                _PrivacyToggle(
                  title: 'Show Activity Status',
                  subtitle: 'Let others see when you were last active',
                  value: _showActivityStatus,
                  onChanged: (v) {
                    setState(() => _showActivityStatus = v);
                    _onChange('show_activity_status', v);
                  },
                ),
                const SizedBox(height: 24),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.lightBlue,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppColors.primaryBlue.withValues(alpha: 0.2)),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline,
                            color: AppColors.primaryBlue, size: 18),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Your personal information is protected. Changes take effect immediately.',
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              color: AppColors.primaryBlue,
                              height: 1.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
    );
  }
}

class _PrivacyToggle extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _PrivacyToggle({
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
