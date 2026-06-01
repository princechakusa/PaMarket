import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../config/supabase_config.dart';
import '../../services/listing_service.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

class PostListingScreen extends StatefulWidget {
  const PostListingScreen({super.key});

  @override
  State<PostListingScreen> createState() => _PostListingScreenState();
}

class _PostListingScreenState extends State<PostListingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _suburbCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  String _category = 'buy-sell';
  String _currency = 'USD';
  String _province = 'Harare';
  String? _condition;
  bool _negotiable = false;

  final List<File> _photos = [];
  bool _loading = false;

  static const _categories = [
    ('buy-sell', 'Buy & Sell'),
    ('jobs', 'Jobs'),
    ('rentals', 'Rentals'),
    ('cars', 'Cars'),
    ('services', 'Services'),
    ('agriculture', 'Agriculture'),
  ];

  static const _conditions = ['new', 'like-new', 'used', 'refurbished'];

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _priceCtrl.dispose();
    _cityCtrl.dispose();
    _suburbCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    if (_photos.length >= 8) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Maximum 8 photos allowed.')));
      return;
    }
    final picker = ImagePicker();
    final xf = await picker.pickImage(source: source, imageQuality: 80);
    if (xf != null) setState(() => _photos.add(File(xf.path)));
  }

  void _showPhotoOptions() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Take a photo'),
              onTap: () {
                Navigator.pop(context);
                _pickPhoto(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              onTap: () {
                Navigator.pop(context);
                _pickPhoto(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    try {
      final uid = AuthService.currentUserId!;
      final profile = await AuthService.fetchProfile(uid);
      final sellerName = profile?['name'] as String? ?? 'User';
      final sellerPhone =
          _phoneCtrl.text.trim().isNotEmpty ? _phoneCtrl.text.trim() : '';

      // Upload photos
      final photoUrls = <String>[];
      for (final file in _photos) {
        final url = await ListingService.uploadPhoto(file, uid);
        photoUrls.add(url);
      }

      await ListingService.createListing(
        title: _titleCtrl.text.trim(),
        description: _descCtrl.text.trim(),
        price: _negotiable
            ? 0
            : double.tryParse(_priceCtrl.text.trim()) ?? 0,
        currency: _currency,
        category: _category,
        province: _province,
        city: _cityCtrl.text.trim(),
        suburb: _suburbCtrl.text.trim(),
        condition: _condition,
        photoUrls: photoUrls,
        sellerName: sellerName,
        sellerPhone: sellerPhone,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Listing posted successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
        context.go('/home');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Post a Listing'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
        actions: [
          TextButton(
            onPressed: _loading ? null : _submit,
            child: _loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('Post',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    )),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Photos
              _sectionTitle('Photos'),
              const SizedBox(height: 10),
              _PhotoPicker(
                photos: _photos,
                onAdd: _showPhotoOptions,
                onRemove: (i) => setState(() => _photos.removeAt(i)),
              ),

              const SizedBox(height: 20),

              // Category
              _sectionTitle('Category'),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _categories.map((cat) {
                  final isSelected = _category == cat.$1;
                  return GestureDetector(
                    onTap: () => setState(() => _category = cat.$1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primaryBlue
                            : AppColors.card,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected
                              ? AppColors.primaryBlue
                              : AppColors.border,
                        ),
                      ),
                      child: Text(
                        cat.$2,
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: isSelected
                              ? Colors.white
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),

              const SizedBox(height: 20),

              // Title
              _sectionTitle('Title *'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _titleCtrl,
                maxLength: 100,
                decoration: const InputDecoration(
                    hintText: 'e.g. Samsung Galaxy S24 Ultra'),
                validator: (v) =>
                    v == null || v.trim().length < 3 ? 'Title is too short' : null,
              ),

              const SizedBox(height: 16),

              // Description
              _sectionTitle('Description *'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _descCtrl,
                maxLines: 5,
                maxLength: 1500,
                decoration: const InputDecoration(
                    hintText: 'Describe your item in detail...'),
                validator: (v) => v == null || v.trim().length < 10
                    ? 'Description is too short'
                    : null,
              ),

              const SizedBox(height: 16),

              // Price
              _sectionTitle('Price'),
              const SizedBox(height: 8),
              Row(
                children: [
                  // Currency toggle
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: ['USD', 'ZiG'].map((c) {
                        final sel = _currency == c;
                        return GestureDetector(
                          onTap: () => setState(() => _currency = c),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 14),
                            decoration: BoxDecoration(
                              color: sel
                                  ? AppColors.primaryBlue
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(11),
                            ),
                            child: Text(
                              c,
                              style: TextStyle(
                                fontFamily: 'Inter',
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                color: sel ? Colors.white : AppColors.textSecondary,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _priceCtrl,
                      keyboardType: TextInputType.number,
                      enabled: !_negotiable,
                      decoration: InputDecoration(
                        hintText: _negotiable ? 'Negotiable' : 'Enter price',
                        prefixText: _currency == 'USD' ? '\$ ' : 'ZiG ',
                      ),
                      validator: (v) {
                        if (_negotiable) return null;
                        if (v == null || v.trim().isEmpty) return 'Enter price';
                        if (double.tryParse(v) == null) {
                          return 'Enter a valid number';
                        }
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Checkbox(
                    value: _negotiable,
                    onChanged: (v) => setState(() => _negotiable = v ?? false),
                    activeColor: AppColors.primaryBlue,
                  ),
                  const Text('Price is negotiable',
                      style: TextStyle(fontFamily: 'Inter', fontSize: 14)),
                ],
              ),

              const SizedBox(height: 16),

              // Condition (not for jobs/services)
              if (!['jobs', 'services', 'rentals'].contains(_category)) ...[
                _sectionTitle('Condition'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: _conditions.map((c) {
                    final sel = _condition == c;
                    return ChoiceChip(
                      label: Text(c),
                      selected: sel,
                      onSelected: (v) =>
                          setState(() => _condition = v ? c : null),
                      selectedColor: AppColors.primaryBlue,
                      labelStyle: TextStyle(
                        fontFamily: 'Inter',
                        color: sel ? Colors.white : AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
              ],

              // Location
              _sectionTitle('Location *'),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _province,
                decoration: const InputDecoration(labelText: 'Province'),
                items: SupabaseConfig.provinces
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (v) => setState(() => _province = v ?? 'Harare'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _cityCtrl,
                decoration: const InputDecoration(
                    labelText: 'City / Town',
                    hintText: 'e.g. Borrowdale'),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'City is required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _suburbCtrl,
                decoration: const InputDecoration(
                    labelText: 'Suburb (optional)',
                    hintText: 'e.g. Borrowdale Brooke'),
              ),

              const SizedBox(height: 16),

              // Contact phone
              _sectionTitle('Contact Number'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                    labelText: 'Phone / WhatsApp',
                    hintText: '+263 77 123 4567'),
              ),

              const SizedBox(height: 32),

              ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.5, color: Colors.white))
                    : const Text('Post Listing'),
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionTitle(String text) => Text(
        text,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
      );
}

class _PhotoPicker extends StatelessWidget {
  final List<File> photos;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;

  const _PhotoPicker({
    required this.photos,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 100,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          // Add button
          GestureDetector(
            onTap: onAdd,
            child: Container(
              width: 100,
              height: 100,
              margin: const EdgeInsets.only(right: 10),
              decoration: BoxDecoration(
                color: AppColors.lightBlue,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: AppColors.primaryBlue.withValues(alpha: 0.3),
                    style: BorderStyle.solid),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.add_a_photo_outlined,
                      color: AppColors.primaryBlue, size: 28),
                  const SizedBox(height: 4),
                  Text(
                    '${photos.length}/8',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      color: AppColors.primaryBlue,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Thumbnails
          ...List.generate(photos.length, (i) {
            return Stack(
              children: [
                Container(
                  width: 100,
                  height: 100,
                  margin: const EdgeInsets.only(right: 10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    image: DecorationImage(
                      image: FileImage(photos[i]),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                Positioned(
                  top: 4,
                  right: 14,
                  child: GestureDetector(
                    onTap: () => onRemove(i),
                    child: Container(
                      width: 22,
                      height: 22,
                      decoration: const BoxDecoration(
                        color: Colors.black54,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close,
                          size: 14, color: Colors.white),
                    ),
                  ),
                ),
                if (i == 0)
                  Positioned(
                    bottom: 6,
                    left: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.orange,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'Cover',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
              ],
            );
          }),
        ],
      ),
    );
  }
}
