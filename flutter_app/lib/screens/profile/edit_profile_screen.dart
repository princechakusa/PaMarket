import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_modal.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _whatsappCtrl = TextEditingController();

  String? _selectedCity;
  String? _currentAvatarUrl;
  File? _newAvatarFile;
  bool _loading = true;
  bool _saving = false;

  static const _cities = [
    'Harare',
    'Bulawayo',
    'Mutare',
    'Gweru',
    'Kwekwe',
    'Kadoma',
    'Masvingo',
    'Chinhoyi',
    'Bindura',
    'Marondera',
    'Hwange',
    'Victoria Falls',
    'Zvishavane',
    'Redcliff',
    'Chegutu',
    'Rusape',
    'Kariba',
    'Beitbridge',
    'Chipinge',
    'Chiredzi',
  ];

  @override
  void initState() {
    super.initState();
    _checkAuthAndLoad();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _usernameCtrl.dispose();
    _bioCtrl.dispose();
    _phoneCtrl.dispose();
    _whatsappCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkAuthAndLoad() async {
    if (!AuthService.isSignedIn) {
      if (mounted) {
        setState(() => _loading = false);
        showAuthModal(context, 'Sign in to edit your profile');
      }
      return;
    }
    await _loadProfile();
  }

  Future<void> _loadProfile() async {
    final uid = AuthService.currentUserId;
    if (uid == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final data = await AuthService.fetchProfile(uid);
      if (mounted && data != null) {
        _nameCtrl.text = data['name'] as String? ?? '';
        _usernameCtrl.text = data['username'] as String? ?? '';
        _bioCtrl.text = data['bio'] as String? ?? '';
        _phoneCtrl.text = data['phone'] as String? ?? '';
        _whatsappCtrl.text = data['whatsapp'] as String? ?? '';
        _currentAvatarUrl = data['avatar'] as String?;
        final city = data['city'] as String?;
        if (city != null && _cities.contains(city)) {
          _selectedCity = city;
        }
        setState(() => _loading = false);
      } else if (mounted) {
        setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickAvatar() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 800,
      maxHeight: 800,
      imageQuality: 82,
    );
    if (picked != null && mounted) {
      setState(() => _newAvatarFile = File(picked.path));
    }
  }

  Future<String?> _uploadAvatar(String uid) async {
    if (_newAvatarFile == null) return null;
    try {
      final ext = _newAvatarFile!.path.split('.').last.toLowerCase();
      final path = '$uid/avatar.$ext';
      final bytes = await _newAvatarFile!.readAsBytes();
      await Supabase.instance.client.storage
          .from('avatars')
          .uploadBinary(
            path,
            bytes,
            fileOptions: FileOptions(
              upsert: true,
              contentType: 'image/$ext',
            ),
          );
      return Supabase.instance.client.storage
          .from('avatars')
          .getPublicUrl(path);
    } catch (_) {
      return null;
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    final uid = AuthService.currentUserId;
    if (uid == null) {
      showAuthModal(context, 'Sign in to save your profile');
      return;
    }

    setState(() => _saving = true);
    try {
      String? avatarUrl;
      if (_newAvatarFile != null) {
        avatarUrl = await _uploadAvatar(uid);
      }

      final updates = <String, dynamic>{
        'name': _nameCtrl.text.trim(),
        'bio': _bioCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim().isEmpty
            ? null
            : _phoneCtrl.text.trim(),
        'city': _selectedCity,
        'whatsapp': _whatsappCtrl.text.trim().isEmpty
            ? null
            : _whatsappCtrl.text.trim(),
        'updated_at': DateTime.now().toIso8601String(),
      };

      final username = _usernameCtrl.text.trim();
      if (username.isNotEmpty) {
        updates['username'] = username;
      }

      if (avatarUrl != null) {
        updates['avatar'] = avatarUrl;
      }

      await Supabase.instance.client
          .from('profiles')
          .update(updates)
          .eq('id', uid);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated!'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _initials(String name) {
    if (name.isEmpty) return 'U';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn && !_loading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Edit Profile'),
          backgroundColor: AppColors.primaryBlue,
          foregroundColor: Colors.white,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_outline,
                  size: 64, color: AppColors.border),
              const SizedBox(height: 16),
              const Text(
                'Sign in to edit your profile',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.push('/login'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: Colors.white,
                ),
                child: const Text(
                  'Sign In',
                  style: TextStyle(fontFamily: 'Inter'),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Edit Profile',
          style: TextStyle(
            fontFamily: 'Inter',
            fontWeight: FontWeight.w700,
          ),
        ),
        backgroundColor: AppColors.primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primaryBlue))
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  // Avatar section
                  _buildAvatarSection(),
                  const SizedBox(height: 24),

                  // Display Name
                  _FieldLabel('Full Name', required: true),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _nameCtrl,
                    textCapitalization: TextCapitalization.words,
                    maxLength: 60,
                    decoration: _inputDecoration(
                      hint: 'Your full name',
                      icon: Icons.person_outline,
                    ),
                    validator: (v) {
                      if (v == null || v.trim().length < 2) {
                        return 'Please enter your full name (min 2 characters)';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Username
                  _FieldLabel('Username / Handle'),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _usernameCtrl,
                    maxLength: 30,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(
                          RegExp(r'[a-zA-Z0-9_.]')),
                    ],
                    decoration: _inputDecoration(
                      hint: '@yourhandle',
                      icon: Icons.alternate_email,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Bio
                  _FieldLabel('Bio'),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _bioCtrl,
                    maxLines: 4,
                    maxLength: 160,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: _inputDecoration(
                      hint: 'Tell buyers about yourself...',
                      icon: Icons.notes_outlined,
                    ).copyWith(
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Phone
                  _FieldLabel('Phone Number'),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    maxLength: 16,
                    decoration: _inputDecoration(
                      hint: '+263 77 123 4567',
                      icon: Icons.phone_outlined,
                    ),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return null;
                      final clean = v.trim();
                      final valid = RegExp(r'^\+?[0-9\s\-]{7,16}$')
                          .hasMatch(clean);
                      if (!valid) {
                        return 'Phone looks invalid. Use: +263 77 123 4567';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'International format, e.g. +263 77 123 4567',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      color: AppColors.textMuted,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // City
                  _FieldLabel('City'),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: _selectedCity,
                    decoration: _inputDecoration(
                      hint: 'Select your city',
                      icon: Icons.location_city_outlined,
                    ),
                    isExpanded: true,
                    items: [
                      const DropdownMenuItem<String>(
                        value: null,
                        child: Text(
                          'Select your city',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            color: AppColors.textMuted,
                          ),
                        ),
                      ),
                      ..._cities.map(
                        (c) => DropdownMenuItem(
                          value: c,
                          child: Text(
                            c,
                            style: const TextStyle(fontFamily: 'Inter'),
                          ),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() => _selectedCity = v),
                  ),
                  const SizedBox(height: 16),

                  // WhatsApp
                  _FieldLabel('WhatsApp Number'),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _whatsappCtrl,
                    keyboardType: TextInputType.phone,
                    maxLength: 16,
                    decoration: _inputDecoration(
                      hint: '+263 77 123 4567 (optional)',
                      icon: Icons.chat_outlined,
                    ),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return null;
                      final clean = v.trim();
                      final valid = RegExp(r'^\+?[0-9\s\-]{7,16}$')
                          .hasMatch(clean);
                      if (!valid) return 'Enter a valid WhatsApp number';
                      return null;
                    },
                  ),
                  const SizedBox(height: 28),

                  // Save button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _save,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryBlue,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor:
                            AppColors.primaryBlue.withValues(alpha: 0.6),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: _saving
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2.5,
                              ),
                            )
                          : const Text(
                              'Save Changes',
                              style: TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Cancel button
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => context.pop(),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textSecondary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side:
                            const BorderSide(color: AppColors.border),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _buildAvatarSection() {
    final name = _nameCtrl.text;
    final hasNewFile = _newAvatarFile != null;
    final hasRemoteAvatar =
        _currentAvatarUrl != null && _currentAvatarUrl!.isNotEmpty;

    return Column(
      children: [
        GestureDetector(
          onTap: _pickAvatar,
          child: Stack(
            children: [
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: AppColors.primaryBlue.withValues(alpha: 0.22),
                      width: 2.5),
                  color: AppColors.lightBlue,
                ),
                clipBehavior: Clip.hardEdge,
                child: hasNewFile
                    ? Image.file(
                        _newAvatarFile!,
                        fit: BoxFit.cover,
                        width: 88,
                        height: 88,
                      )
                    : hasRemoteAvatar
                        ? Image.network(
                            _currentAvatarUrl!,
                            fit: BoxFit.cover,
                            width: 88,
                            height: 88,
                            errorBuilder: (_, __, ___) => Center(
                              child: Text(
                                _initials(name),
                                style: const TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 30,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.primaryBlue,
                                ),
                              ),
                            ),
                          )
                        : Center(
                            child: Text(
                              _initials(name),
                              style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 30,
                                fontWeight: FontWeight.w800,
                                color: AppColors.primaryBlue,
                              ),
                            ),
                          ),
              ),
              // Camera overlay
              Positioned(
                bottom: 0,
                right: 0,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: const BoxDecoration(
                    color: AppColors.primaryBlue,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.camera_alt_outlined,
                    size: 15,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        GestureDetector(
          onTap: _pickAvatar,
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
            decoration: BoxDecoration(
              color: AppColors.lightBlue,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Text(
              'Change Photo',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.primaryBlue,
              ),
            ),
          ),
        ),
      ],
    );
  }

  InputDecoration _inputDecoration(
      {required String hint, required IconData icon}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(
        fontFamily: 'Inter',
        color: AppColors.textMuted,
      ),
      prefixIcon: Icon(icon, color: AppColors.textSecondary, size: 20),
      filled: true,
      fillColor: AppColors.card,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide:
            const BorderSide(color: AppColors.primaryBlue, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.error, width: 2),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String text;
  final bool required;

  const _FieldLabel(this.text, {this.required = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          text,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary,
          ),
        ),
        if (required)
          const Text(
            ' *',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.error,
            ),
          ),
      ],
    );
  }
}
