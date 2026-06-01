import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

class VerifyScreen extends StatefulWidget {
  const VerifyScreen({super.key});

  @override
  State<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends State<VerifyScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Get Verified'),
        bottom: TabBar(
          controller: _tabs,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: AppColors.orange,
          tabs: const [
            Tab(text: 'Individual'),
            Tab(text: 'Business'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _IndividualVerify(),
          _BusinessVerify(),
        ],
      ),
    );
  }
}

class _IndividualVerify extends StatefulWidget {
  const _IndividualVerify();

  @override
  State<_IndividualVerify> createState() => _IndividualVerifyState();
}

class _IndividualVerifyState extends State<_IndividualVerify> {
  File? _idPhoto;
  File? _selfie;
  bool _submitting = false;

  Future<void> _pick(bool isSelfie) async {
    final picker = ImagePicker();
    final xf = await picker.pickImage(
      source: isSelfie ? ImageSource.camera : ImageSource.gallery,
      imageQuality: 80,
    );
    if (xf != null) {
      setState(() {
        if (isSelfie) {
          _selfie = File(xf.path);
        } else {
          _idPhoto = File(xf.path);
        }
      });
    }
  }

  Future<void> _submit() async {
    if (_idPhoto == null || _selfie == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please upload both your ID and selfie.')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final uid = AuthService.currentUserId!;
      final client = Supabase.instance.client;

      // Upload ID
      final idName = 'individual/$uid/id.jpg';
      await client.storage
          .from('verification')
          .upload(idName, _idPhoto!, fileOptions: const FileOptions(upsert: true));

      // Upload selfie
      final selfieName = 'individual/$uid/selfie.jpg';
      await client.storage.from('verification').upload(selfieName, _selfie!,
          fileOptions: const FileOptions(upsert: true));

      // Mark pending
      await AuthService.updateProfile({'verification_pending': true});

      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => AlertDialog(
            title: const Text('Submitted!'),
            content: const Text(
                'Your verification documents have been submitted. We\'ll review them within 1–3 business days and notify you.'),
            actions: [
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.pop();
                },
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.lightBlue,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, color: AppColors.primaryBlue, size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Verification takes 1–3 business days. Your documents are stored securely.',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      color: AppColors.primaryBlue,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          _DocUploader(
            title: 'National ID / Passport',
            subtitle: 'Upload a clear photo of your ID document',
            file: _idPhoto,
            icon: Icons.badge_outlined,
            onTap: () => _pick(false),
          ),

          const SizedBox(height: 16),

          _DocUploader(
            title: 'Selfie with ID',
            subtitle: 'Take a selfie while holding your ID',
            file: _selfie,
            icon: Icons.face_outlined,
            onTap: () => _pick(true),
            useCamera: true,
          ),

          const SizedBox(height: 32),

          ElevatedButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2.5, color: Colors.white))
                : const Text('Submit for Verification'),
          ),
        ],
      ),
    );
  }
}

class _BusinessVerify extends StatefulWidget {
  const _BusinessVerify();

  @override
  State<_BusinessVerify> createState() => _BusinessVerifyState();
}

class _BusinessVerifyState extends State<_BusinessVerify> {
  final _nameCtrl = TextEditingController();
  File? _regDoc;
  File? _taxDoc;
  File? _premisesPhoto;
  File? _repPhoto;
  bool _submitting = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _pick(String field) async {
    final picker = ImagePicker();
    final xf = await picker.pickImage(
        source: ImageSource.gallery, imageQuality: 80);
    if (xf != null) {
      setState(() {
        final f = File(xf.path);
        switch (field) {
          case 'reg':
            _regDoc = f;
          case 'tax':
            _taxDoc = f;
          case 'premises':
            _premisesPhoto = f;
          case 'rep':
            _repPhoto = f;
        }
      });
    }
  }

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter your business name.')));
      return;
    }
    if (_regDoc == null || _taxDoc == null ||
        _premisesPhoto == null || _repPhoto == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please upload all required documents.')));
      return;
    }

    setState(() => _submitting = true);
    try {
      final uid = AuthService.currentUserId!;
      final client = Supabase.instance.client;
      final prefix = 'business/$uid';

      for (final entry in {
        '$prefix/registration.jpg': _regDoc!,
        '$prefix/tax.jpg': _taxDoc!,
        '$prefix/premises.jpg': _premisesPhoto!,
        '$prefix/representative.jpg': _repPhoto!,
      }.entries) {
        await client.storage.from('verification').upload(
            entry.key, entry.value,
            fileOptions: const FileOptions(upsert: true));
      }

      await AuthService.updateProfile({
        'verification_pending': true,
        'sector': 'business',
        'job_title': _nameCtrl.text.trim(),
      });

      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => AlertDialog(
            title: const Text('Submitted!'),
            content: const Text(
                'Your business verification documents have been submitted. We\'ll review within 3–5 business days.'),
            actions: [
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.pop();
                },
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _nameCtrl,
            decoration: const InputDecoration(
              labelText: 'Business / Company Name',
              prefixIcon: Icon(Icons.business_outlined),
            ),
          ),
          const SizedBox(height: 16),
          _DocUploader(
            title: 'Certificate of Incorporation',
            subtitle: 'Company registration or business registration',
            file: _regDoc,
            icon: Icons.description_outlined,
            onTap: () => _pick('reg'),
          ),
          const SizedBox(height: 12),
          _DocUploader(
            title: 'Tax Clearance Certificate',
            subtitle: 'Current ZIMRA tax clearance',
            file: _taxDoc,
            icon: Icons.receipt_long_outlined,
            onTap: () => _pick('tax'),
          ),
          const SizedBox(height: 12),
          _DocUploader(
            title: 'Business Premises Photo',
            subtitle: 'Photo of the exterior/interior of your business',
            file: _premisesPhoto,
            icon: Icons.storefront_outlined,
            onTap: () => _pick('premises'),
          ),
          const SizedBox(height: 12),
          _DocUploader(
            title: 'Authorised Representative with ID',
            subtitle: 'Photo of rep holding their national ID',
            file: _repPhoto,
            icon: Icons.person_outlined,
            onTap: () => _pick('rep'),
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2.5, color: Colors.white))
                : const Text('Submit for Business Verification'),
          ),
        ],
      ),
    );
  }
}

class _DocUploader extends StatelessWidget {
  final String title;
  final String subtitle;
  final File? file;
  final IconData icon;
  final VoidCallback onTap;
  final bool useCamera;

  const _DocUploader({
    required this.title,
    required this.subtitle,
    required this.file,
    required this.icon,
    required this.onTap,
    this.useCamera = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: file != null ? AppColors.lightBlue : AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: file != null ? AppColors.primaryBlue : AppColors.border,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: file != null
                    ? AppColors.primaryBlue.withValues(alpha: 0.1)
                    : AppColors.background,
                borderRadius: BorderRadius.circular(10),
              ),
              child: file != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.file(file!, fit: BoxFit.cover),
                    )
                  : Icon(icon, color: AppColors.textSecondary, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    file != null ? 'Uploaded ✓' : subtitle,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: file != null
                          ? AppColors.success
                          : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              file != null ? Icons.check_circle : Icons.upload_outlined,
              color: file != null ? AppColors.success : AppColors.textMuted,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
