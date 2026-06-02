import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';

void showAuthModal(BuildContext context, String message) {
  showDialog(
    context: context,
    barrierColor: Colors.black54,
    builder: (ctx) => _AuthDialog(parentContext: context),
  );
}

class _AuthDialog extends StatefulWidget {
  final BuildContext parentContext;
  const _AuthDialog({required this.parentContext});

  @override
  State<_AuthDialog> createState() => _AuthDialogState();
}

class _AuthDialogState extends State<_AuthDialog> {
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Icon(Icons.close, color: AppColors.textMuted, size: 22),
                ),
              ],
            ),
            RichText(
              text: const TextSpan(children: [
                TextSpan(text: 'Pa', style: TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.primaryBlue)),
                TextSpan(text: 'Market', style: TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.orange)),
              ]),
            ),
            const SizedBox(height: 20),
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.lightBlue,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.lock_rounded, size: 40, color: AppColors.primaryBlue),
                ),
                Positioned(
                  right: -6,
                  top: -6,
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: const BoxDecoration(color: AppColors.orange, shape: BoxShape.circle),
                    child: const Icon(Icons.add, color: Colors.white, size: 18),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _loading
                ? const CircularProgressIndicator()
                : OutlinedButton(
                    onPressed: () async {
                      setState(() => _loading = true);
                      try {
                        final res = await AuthService.signInWithGoogle();
                        if (res != null && mounted) Navigator.pop(context);
                      } catch (e) {
                        if (mounted) {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(widget.parentContext).showSnackBar(
                            SnackBar(
                              content: const Text('Google sign-in failed. Please use email/password instead.'),
                              backgroundColor: AppColors.error,
                              behavior: SnackBarBehavior.floating,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              action: SnackBarAction(
                                label: 'Login',
                                textColor: Colors.white,
                                onPressed: () => widget.parentContext.push('/login'),
                              ),
                            ),
                          );
                        }
                      } finally {
                        if (mounted) setState(() => _loading = false);
                      }
                    },
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 50),
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const _GoogleG(),
                        const SizedBox(width: 10),
                        const Text('Continue with Google',
                            style: TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                      ],
                    ),
                  ),
            const SizedBox(height: 14),
            const Row(children: [
              Expanded(child: Divider(color: AppColors.border)),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 12),
                child: Text('or', style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: AppColors.textMuted)),
              ),
              Expanded(child: Divider(color: AppColors.border)),
            ]),
            const SizedBox(height: 14),
            OutlinedButton(
              onPressed: () {
                Navigator.pop(context);
                widget.parentContext.push('/login');
              },
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                side: const BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.email_outlined, color: AppColors.primaryBlue, size: 22),
                  SizedBox(width: 10),
                  Text('Login with email',
                      style: TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () {
                Navigator.pop(context);
                widget.parentContext.push('/signup');
              },
              child: RichText(
                textAlign: TextAlign.center,
                text: const TextSpan(
                  style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: AppColors.textSecondary),
                  children: [
                    TextSpan(text: "Don't have an account? "),
                    TextSpan(text: 'Create one', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.primaryBlue)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            RichText(
              textAlign: TextAlign.center,
              text: const TextSpan(
                style: TextStyle(fontFamily: 'Inter', fontSize: 11, color: AppColors.textMuted),
                children: [
                  TextSpan(text: 'By continuing you agree to our '),
                  TextSpan(text: 'Terms & Conditions', style: TextStyle(color: AppColors.primaryBlue)),
                  TextSpan(text: ' and '),
                  TextSpan(text: 'Privacy Policy', style: TextStyle(color: AppColors.primaryBlue)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GoogleG extends StatelessWidget {
  const _GoogleG();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.border),
      ),
      child: const Center(
        child: Text(
          'G',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: Color(0xFF4285F4),
          ),
        ),
      ),
    );
  }
}
