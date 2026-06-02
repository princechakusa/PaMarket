import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

class SecuritySettingsScreen extends StatefulWidget {
  const SecuritySettingsScreen({super.key});

  @override
  State<SecuritySettingsScreen> createState() =>
      _SecuritySettingsScreenState();
}

class _SecuritySettingsScreenState extends State<SecuritySettingsScreen> {
  final _supabase = Supabase.instance.client;

  // Change password
  final _newPassCtrl = TextEditingController();
  final _confPassCtrl = TextEditingController();
  bool _newPassObscure = true;
  bool _confPassObscure = true;
  String _passStrength = '';
  Color _passStrengthColor = Colors.transparent;
  String? _passError;
  bool _savingPass = false;

  // Delete account
  final _deleteConfirmCtrl = TextEditingController();
  bool _deletingAccount = false;

  @override
  void dispose() {
    _newPassCtrl.dispose();
    _confPassCtrl.dispose();
    _deleteConfirmCtrl.dispose();
    super.dispose();
  }

  String _computeStrength(String val) {
    if (val.isEmpty) return '';
    int score = 0;
    if (val.length >= 8) score++;
    if (RegExp(r'[A-Z]').hasMatch(val)) score++;
    if (RegExp(r'[a-z]').hasMatch(val)) score++;
    if (RegExp(r'[0-9]').hasMatch(val)) score++;
    if (RegExp(r'[^A-Za-z0-9]').hasMatch(val)) score++;
    switch (score) {
      case 1:
        return 'Very weak';
      case 2:
        return 'Weak';
      case 3:
        return 'Fair';
      case 4:
        return 'Strong';
      case 5:
        return 'Very strong';
      default:
        return '';
    }
  }

  Color _strengthColor(String label) {
    switch (label) {
      case 'Very weak':
        return const Color(0xFFEF4444);
      case 'Weak':
        return const Color(0xFFF59E0B);
      case 'Fair':
        return const Color(0xFFEAB308);
      case 'Strong':
        return const Color(0xFF22C55E);
      case 'Very strong':
        return const Color(0xFF16A34A);
      default:
        return Colors.transparent;
    }
  }

  Future<void> _updatePassword() async {
    final nw = _newPassCtrl.text.trim();
    final conf = _confPassCtrl.text.trim();

    setState(() => _passError = null);

    if (nw.isEmpty || conf.isEmpty) {
      setState(() => _passError = 'Please fill in both password fields');
      return;
    }
    if (nw.length < 8) {
      setState(() => _passError = 'Password must be at least 8 characters');
      return;
    }
    if (!RegExp(r'[A-Z]').hasMatch(nw)) {
      setState(
          () => _passError = 'Password must include at least one uppercase letter');
      return;
    }
    if (!RegExp(r'[a-z]').hasMatch(nw)) {
      setState(
          () => _passError = 'Password must include at least one lowercase letter');
      return;
    }
    if (!RegExp(r'[0-9]').hasMatch(nw)) {
      setState(
          () => _passError = 'Password must include at least one number');
      return;
    }
    if (!RegExp(r'[^A-Za-z0-9]').hasMatch(nw)) {
      setState(
          () => _passError = 'Password must include at least one symbol (e.g. !@#\$)');
      return;
    }
    if (nw != conf) {
      setState(() => _passError = 'Passwords do not match');
      return;
    }

    setState(() => _savingPass = true);
    try {
      await _supabase.auth.updateUser(UserAttributes(password: nw));
      if (mounted) {
        _newPassCtrl.clear();
        _confPassCtrl.clear();
        setState(() {
          _passStrength = '';
          _savingPass = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Password updated successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _passError = e.toString();
          _savingPass = false;
        });
      }
    }
  }

  Future<void> _deleteAccount() async {
    final val = _deleteConfirmCtrl.text.trim();
    if (val != 'DELETE') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Type DELETE to confirm')),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete Account',
          style: TextStyle(
              fontFamily: 'Inter',
              fontWeight: FontWeight.w700,
              fontSize: 18,
              color: AppColors.error),
        ),
        content: const Text(
          'This permanently deletes your account, listings and messages. Cannot be undone.',
          style: TextStyle(
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
            child: const Text('Permanently Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _deletingAccount = true);
    try {
      final uid = AuthService.currentUserId!;
      // Delete profile row (cascades to listings, messages in DB)
      await _supabase.from('profiles').delete().eq('id', uid);
      await AuthService.signOut();
      if (mounted) context.go('/profile');
    } catch (e) {
      if (mounted) {
        setState(() => _deletingAccount = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete account: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Security')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Info banner ──────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              border: Border.all(color: const Color(0xFFBFDBFE)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: Color(0xFF1E40AF),
                height: 1.5,
              ),
            ),
          ),
          const SizedBox(height: 20),

          // ── Change Password ──────────────────────────────────────────
          _sectionLabel('Change Password'),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // New password
                const Text(
                  'New Password',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _newPassCtrl,
                  obscureText: _newPassObscure,
                  onChanged: (v) {
                    final s = _computeStrength(v);
                    setState(() {
                      _passStrength = s;
                      _passStrengthColor = _strengthColor(s);
                    });
                  },
                  decoration: InputDecoration(
                    hintText: 'Enter new password',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _newPassObscure
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                        size: 20,
                      ),
                      onPressed: () =>
                          setState(() => _newPassObscure = !_newPassObscure),
                    ),
                  ),
                ),
                if (_passStrength.isNotEmpty) ...
                  [
                    const SizedBox(height: 6),
                    Text(
                      _passStrength,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: _passStrengthColor,
                      ),
                    ),
                  ],
                const SizedBox(height: 14),

                // Confirm password
                const Text(
                  'Confirm New Password',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _confPassCtrl,
                  obscureText: _confPassObscure,
                  onSubmitted: (_) => _updatePassword(),
                  decoration: InputDecoration(
                    hintText: 'Re-enter new password',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _confPassObscure
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                        size: 20,
                      ),
                      onPressed: () =>
                          setState(() => _confPassObscure = !_confPassObscure),
                    ),
                  ),
                ),

                if (_passError != null) ...
                  [
                    const SizedBox(height: 8),
                    Text(
                      _passError!,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.error,
                      ),
                    ),
                  ],
                const SizedBox(height: 16),

                ElevatedButton(
                  onPressed: _savingPass ? null : _updatePassword,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryBlue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _savingPass
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Text(
                          'Update Password',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── Account Security ─────────────────────────────────────────
          _sectionLabel('Account Security'),
          Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                ListTile(
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.lightBlue,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.security_outlined,
                        size: 20, color: AppColors.primaryBlue),
                  ),
                  title: const Text(
                    'Two-Factor Authentication',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary),
                  ),
                  subtitle: const Text(
                    'Add an extra layer of security',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: AppColors.textSecondary),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios,
                      size: 14, color: AppColors.textMuted),
                  onTap: () => _showInfoDialog(
                    context,
                    title: 'Two-Factor Authentication',
                    icon: Icons.security_outlined,
                    body: 'Two-factor authentication adds an extra layer of security to your account.\n\nWhen enabled, you\'ll need to enter a one-time code from your phone in addition to your password when signing in.\n\nThis feature will be available in a future update.',
                  ),
                ),
                const Divider(height: 1, indent: 56, color: AppColors.border),
                ListTile(
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.lightBlue,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.smartphone_outlined,
                        size: 20, color: AppColors.primaryBlue),
                  ),
                  title: const Text(
                    'Active Sessions',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary),
                  ),
                  subtitle: const Text(
                    'See where you are signed in',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: AppColors.textSecondary),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios,
                      size: 14, color: AppColors.textMuted),
                  onTap: () => _showInfoDialog(
                    context,
                    title: 'Active Sessions',
                    icon: Icons.smartphone_outlined,
                    body: 'Active Sessions lets you see all devices where your PaMarket account is currently signed in, and sign out from any device remotely.\n\nThis feature will be available in a future update.',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── Delete Account ───────────────────────────────────────────
          _sectionLabel('Danger Zone'),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Warning header
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border.all(
                        color: AppColors.error.withValues(alpha: 0.2)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      Text(
                        'Delete Account',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: AppColors.error,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'This permanently deletes your account, listings and messages. Cannot be undone.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // What will be deleted
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    children: [
                      _DeleteRow(label: 'Profile', value: 'Permanently removed'),
                      const Divider(height: 16, color: AppColors.border),
                      _DeleteRow(label: 'Listings', value: 'All deleted'),
                      const Divider(height: 16, color: AppColors.border),
                      _DeleteRow(label: 'Messages', value: 'All deleted'),
                      const Divider(height: 16, color: AppColors.border),
                      _DeleteRow(label: 'Wallet', value: 'Balance forfeited'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Confirm input
                const Text(
                  'Type DELETE to confirm',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _deleteConfirmCtrl,
                  decoration: InputDecoration(
                    hintText: 'Type DELETE',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                  ),
                ),
                const SizedBox(height: 16),

                ElevatedButton(
                  onPressed: _deletingAccount ? null : _deleteAccount,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.error,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _deletingAccount
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Text(
                          'Permanently Delete Account',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
                const SizedBox(height: 10),
                OutlinedButton(
                  onPressed: () => context.pop(),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(
                    'Cancel - Keep Account',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  void _showInfoDialog(BuildContext context, {required String title, required IconData icon, required String body}) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: AppColors.lightBlue, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 20, color: AppColors.primaryBlue),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(title, style: const TextStyle(fontFamily: 'Inter', fontSize: 16, fontWeight: FontWeight.w700))),
        ]),
        content: Text(body, style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: AppColors.textSecondary, height: 1.6)),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Got it'))],
      ),
    );
  }
}

Widget _sectionLabel(String text) {
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

class _DeleteRow extends StatelessWidget {
  final String label;
  final String value;
  const _DeleteRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: AppColors.textSecondary),
        ),
        Text(
          value,
          style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.error),
        ),
      ],
    );
  }
}
