import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class SocialAuthButton extends StatelessWidget {
  final String label;
  final Widget icon;
  final VoidCallback onTap;
  final bool loading;

  const SocialAuthButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
    this.loading = false,
  });

  factory SocialAuthButton.google({
    required VoidCallback onTap,
    bool loading = false,
  }) =>
      SocialAuthButton(
        label: 'Continue with Google',
        onTap: onTap,
        loading: loading,
        icon: Image.asset('assets/images/google_logo.png',
            width: 20, height: 20,
            errorBuilder: (_, __, ___) =>
                const Icon(Icons.g_mobiledata, size: 22, color: Colors.red)),
      );

  factory SocialAuthButton.apple({
    required VoidCallback onTap,
    bool loading = false,
  }) =>
      SocialAuthButton(
        label: 'Continue with Apple',
        onTap: onTap,
        loading: loading,
        icon: const Icon(Icons.apple, size: 22, color: Colors.black),
      );

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: loading ? null : onTap,
      style: OutlinedButton.styleFrom(
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
        side: const BorderSide(color: AppColors.border),
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
      ),
      child: loading
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(
                  strokeWidth: 2.5, color: AppColors.primaryBlue),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                icon,
                const SizedBox(width: 10),
                Text(label),
              ],
            ),
    );
  }
}
