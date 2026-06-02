import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

class VerifyScreen extends StatefulWidget {
  const VerifyScreen({super.key});

  @override
  State<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends State<VerifyScreen> {
  final _supabase = Supabase.instance.client;

  // Verification state loaded from Supabase
  bool _loading = true;
  bool _verified = false;
  bool _pending = false;

  // Uploaded files (local)
  File? _idPhoto;
  File? _selfie;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadVerificationStatus();
  }

  Future<void> _loadVerificationStatus() async {
    if (!AuthService.isSignedIn) {
      setState(() => _loading = false);
      return;
    }
    try {
      final data = await _supabase
          .from('profiles')
          .select('verified, verification_pending')
          .eq('id', AuthService.currentUserId!)
          .maybeSingle();

      if (mounted) {
        setState(() {
          _verified = data?['verified'] as bool? ?? false;
          _pending = data?['verification_pending'] as bool? ?? false;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickId() async {
    final picker = ImagePicker();
    final xf = await picker.pickImage(
        source: ImageSource.gallery, imageQuality: 82);
    if (xf != null && mounted) {
      setState(() => _idPhoto = File(xf.path));
    }
  }

  Future<void> _takeSelfie() async {
    final picker = ImagePicker();
    final xf = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 85);
    if (xf != null && mounted) {
      setState(() => _selfie = File(xf.path));
    }
  }

  Future<void> _submitForReview() async {
    if (_idPhoto == null || _selfie == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Complete both steps first')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final uid = AuthService.currentUserId!;

      // Upload ID document to Supabase Storage
      final idName = 'individual/$uid/id.jpg';
      await _supabase.storage.from('verification').upload(
            idName,
            _idPhoto!,
            fileOptions: const FileOptions(upsert: true),
          );

      // Upload selfie to Supabase Storage
      final selfieName = 'individual/$uid/selfie.jpg';
      await _supabase.storage.from('verification').upload(
            selfieName,
            _selfie!,
            fileOptions: const FileOptions(upsert: true),
          );

      // Save verification record for admin review
      await _supabase.from('verifications').upsert({
        'user_id': uid,
        'status': 'pending',
        'submitted_at': DateTime.now().toIso8601String(),
      }, onConflict: 'user_id');

      // Mark profile as pending
      await _supabase
          .from('profiles')
          .update({'verification_pending': true})
          .eq('id', uid);

      if (mounted) {
        setState(() {
          _pending = true;
          _submitting = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Documents submitted! Admin will review within 24 hours.'),
            backgroundColor: AppColors.success,
            duration: Duration(seconds: 5),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to submit: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _cancelPending() async {
    try {
      await _supabase
          .from('profiles')
          .update({'verification_pending': false})
          .eq('id', AuthService.currentUserId!);
      if (mounted) {
        setState(() => _pending = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Verification request cancelled')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Failed to cancel: $e'),
              backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_verified ? 'Identity Verified' : 'Verify Identity'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _verified
              ? _VerifiedView()
              : _pending
                  ? _PendingView(onCancel: _cancelPending)
                  : _UploadView(
                      idPhoto: _idPhoto,
                      selfie: _selfie,
                      submitting: _submitting,
                      onPickId: _pickId,
                      onTakeSelfie: _takeSelfie,
                      onSubmit: _submitForReview,
                    ),
    );
  }
}

// ── Verified State ────────────────────────────────────────────────────────────

class _VerifiedView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Badge preview
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.verified,
                      size: 28, color: AppColors.success),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'You are verified',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.success,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Buyers trust verified sellers more.',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Info box
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.lightBlue,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: AppColors.primaryBlue.withValues(alpha: 0.2)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.shield_outlined,
                    size: 18, color: AppColors.primaryBlue),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Blue badge active',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryBlue,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Your blue verified badge is now showing on all your listings and profile.',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: AppColors.primaryBlue,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Pending State ─────────────────────────────────────────────────────────────

class _PendingView extends StatelessWidget {
  final VoidCallback onCancel;
  const _PendingView({required this.onCancel});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Pending card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0x1FFBBF24),
              border: Border.all(color: const Color(0x66FBBF24)),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0x1FFBBF24),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(Icons.access_time_rounded,
                      size: 32, color: Color(0xFFFBBF24)),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Verification Pending',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFFBBF24),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Your ID and selfie have been submitted.\nAn admin will review your documents and approve your badge — usually within 24 hours.',
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

          // What happens next
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.lightBlue,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: AppColors.primaryBlue.withValues(alpha: 0.2)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.shield_outlined,
                    size: 18, color: AppColors.primaryBlue),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'What happens next?',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryBlue,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Once approved you will get a notification and your blue badge will appear on all your listings automatically.',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: AppColors.primaryBlue,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          OutlinedButton(
            onPressed: onCancel,
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: const BorderSide(color: AppColors.border),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text(
              'Cancel request',
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
    );
  }
}

// ── Upload / Unverified State ─────────────────────────────────────────────────

class _UploadView extends StatelessWidget {
  final File? idPhoto;
  final File? selfie;
  final bool submitting;
  final VoidCallback onPickId;
  final VoidCallback onTakeSelfie;
  final VoidCallback onSubmit;

  const _UploadView({
    required this.idPhoto,
    required this.selfie,
    required this.submitting,
    required this.onPickId,
    required this.onTakeSelfie,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Badge preview prompt
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.lightBlue,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.verified_outlined,
                      size: 28, color: AppColors.primaryBlue),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Get your Blue Verified Badge',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Verified sellers get 4x more enquiries',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Step 1 — Phone verified (always done)
          _VerifyStep(
            number: 1,
            done: true,
            title: 'Phone verified',
            subtitle: 'Your phone number has been confirmed',
          ),
          const SizedBox(height: 12),

          // Step 2 — Upload ID
          _VerifyStep(
            number: 2,
            done: idPhoto != null,
            title: 'Upload ID document',
            subtitle:
                "National ID, passport or driver's licence. Both sides if applicable.",
            actionLabel: idPhoto != null ? 'Replace ID' : 'Upload ID',
            actionIcon: Icons.upload_outlined,
            onAction: onPickId,
            preview: idPhoto != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.file(
                      idPhoto!,
                      width: double.infinity,
                      height: 140,
                      fit: BoxFit.cover,
                    ),
                  )
                : null,
          ),
          const SizedBox(height: 12),

          // Step 3 — Selfie
          _VerifyStep(
            number: 3,
            done: selfie != null,
            title: 'Face Selfie',
            subtitle:
                'Take a clear photo of your face. An admin will review it alongside your ID.',
            actionLabel: selfie != null ? 'Re-take Selfie' : 'Take Selfie',
            actionIcon: Icons.camera_alt_outlined,
            onAction: onTakeSelfie,
            preview: selfie != null
                ? Center(
                    child: ClipOval(
                      child: Image.file(
                        selfie!,
                        width: 100,
                        height: 100,
                        fit: BoxFit.cover,
                      ),
                    ),
                  )
                : null,
          ),
          const SizedBox(height: 20),

          // Submit button — only when both uploads done
          if (idPhoto != null && selfie != null) ...
            [
              ElevatedButton(
                onPressed: submitting ? null : onSubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text(
                        'Submit for Admin Review',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Reviewed by our team within 24 hours.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 16),
            ],

          // Security note
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.lightBlue,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: AppColors.primaryBlue.withValues(alpha: 0.2)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.lock_outline,
                    size: 18, color: AppColors.primaryBlue),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Your data is secure',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryBlue,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Your ID and selfie are sent securely and used solely for identity verification. Never sold or shared.',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: AppColors.primaryBlue,
                          height: 1.5,
                        ),
                      ),
                    ],
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
}

// ── Verify Step Widget ────────────────────────────────────────────────────────

class _VerifyStep extends StatelessWidget {
  final int number;
  final bool done;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final IconData? actionIcon;
  final VoidCallback? onAction;
  final Widget? preview;

  const _VerifyStep({
    required this.number,
    required this.done,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.actionIcon,
    this.onAction,
    this.preview,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: done ? AppColors.success.withValues(alpha: 0.4) : AppColors.border,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Step number / check
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: done
                  ? AppColors.success
                  : AppColors.lightBlue,
              shape: BoxShape.circle,
            ),
            child: done
                ? const Icon(Icons.check, size: 18, color: Colors.white)
                : Center(
                    child: Text(
                      '$number',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primaryBlue,
                      ),
                    ),
                  ),
          ),
          const SizedBox(width: 14),

          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
                if (onAction != null) ...
                  [
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: onAction,
                      icon: Icon(actionIcon ?? Icons.upload_outlined, size: 16),
                      label: Text(
                        actionLabel ?? '',
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primaryBlue,
                        side: const BorderSide(color: AppColors.primaryBlue),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 8),
                      ),
                    ),
                  ],
                if (preview != null) ...
                  [
                    const SizedBox(height: 10),
                    preview!,
                  ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
