import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();

  String? _selectedCity;
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
  ];

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _bioCtrl.dispose();
    super.dispose();
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
        _phoneCtrl.text = data['phone'] as String? ?? '';
        _bioCtrl.text = data['bio'] as String? ?? '';
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

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await AuthService.updateProfile({
        'name': _nameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'city': _selectedCity,
        'bio': _bioCtrl.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated successfully'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to update profile. Please try again.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  // Full Name
                  _FieldLabel('Full Name'),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _nameCtrl,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      hintText: 'Enter your full name',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) {
                        return 'Please enter your name';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 18),

                  // Phone
                  _FieldLabel('Phone Number'),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      hintText: '+263 7X XXX XXXX',
                      prefixIcon: Icon(Icons.phone_outlined),
                    ),
                  ),
                  const SizedBox(height: 18),

                  // City
                  _FieldLabel('City'),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: _selectedCity,
                    decoration: InputDecoration(
                      hintText: 'Select your city',
                      prefixIcon: const Icon(Icons.location_city_outlined),
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
                        borderSide: const BorderSide(
                            color: AppColors.primaryBlue, width: 2),
                      ),
                      filled: true,
                      fillColor: AppColors.card,
                    ),
                    items: _cities
                        .map((c) => DropdownMenuItem(
                              value: c,
                              child: Text(c,
                                  style:
                                      const TextStyle(fontFamily: 'Inter')),
                            ))
                        .toList(),
                    onChanged: (v) => setState(() => _selectedCity = v),
                  ),
                  const SizedBox(height: 18),

                  // Bio
                  _FieldLabel('Bio'),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _bioCtrl,
                    maxLines: 4,
                    maxLength: 200,
                    decoration: const InputDecoration(
                      hintText: 'Tell people a bit about yourself...',
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Save button
                  ElevatedButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2.5,
                            ),
                          )
                        : const Text('Save Changes'),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String text;

  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppColors.textSecondary,
      ),
    );
  }
}
