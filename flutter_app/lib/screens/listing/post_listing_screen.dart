/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * Post Listing Screen — Flutter rewrite matching master post.js
 */

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_modal.dart';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

class _Category {
  final String id;
  final String name;
  final IconData icon;
  const _Category(this.id, this.name, this.icon);
}

const List<_Category> _kCategories = [
  _Category('vehicles',    'Vehicles',    Icons.local_shipping),
  _Category('property',    'Property',    Icons.home_outlined),
  _Category('electronics', 'Electronics', Icons.devices),
  _Category('fashion',     'Fashion',     Icons.checkroom),
  _Category('furniture',   'Furniture',   Icons.chair),
  _Category('services',    'Services',    Icons.build),
  _Category('jobs',        'Jobs',        Icons.work),
  _Category('agriculture', 'Agriculture', Icons.agriculture),
  _Category('pets',        'Pets',        Icons.pets),
  _Category('kids',        'Kids',        Icons.child_care),
  _Category('rooms',       'Rooms',       Icons.bed),
  _Category('other',       'Other',       Icons.category),
];

const List<String> _kCities = [
  'Harare',
  'Bulawayo',
  'Mutare',
  'Gweru',
  'Kwekwe',
  'Kadoma',
  'Masvingo',
  'Chinhoyi',
  'Marondera',
  'Hwange',
  'Victoria Falls',
];

const List<String> _kConditions = ['New', 'Like New', 'Used', 'Refurbished'];

const int _kMaxPhotos = 10;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class PostListingScreen extends StatefulWidget {
  const PostListingScreen({super.key});

  @override
  State<PostListingScreen> createState() => _PostListingScreenState();
}

class _PostListingScreenState extends State<PostListingScreen> {
  // Step index: 0 = category/title/desc, 1 = price/location, 2 = photos, 3 = preview
  int _step = 0;

  // Step 0
  String? _category;
  final _titleCtrl = TextEditingController();
  final _descCtrl  = TextEditingController();
  String? _titleError;
  String? _descError;
  String? _catError;

  // Step 1
  final _priceCtrl  = TextEditingController();
  String _currency  = 'USD';
  String _city      = _kCities.first;
  final _phoneCtrl  = TextEditingController();
  bool   _negotiable = false;
  String? _conditionSel;
  String? _priceError;
  String? _cityError;

  // Step 2
  final List<XFile> _photos = [];
  bool _pickingPhoto = false;
  String? _photosError;

  // Submission
  bool _submitting = false;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _priceCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  void _clearStepErrors() {
    _catError    = null;
    _titleError  = null;
    _descError   = null;
    _priceError  = null;
    _cityError   = null;
    _photosError = null;
  }

  bool _validateStep0() {
    bool ok = true;
    if (_category == null) {
      _catError = 'Pick a category';
      ok = false;
    } else {
      _catError = null;
    }
    if (_titleCtrl.text.trim().length < 5) {
      _titleError = 'Title needs at least 5 characters';
      ok = false;
    } else {
      _titleError = null;
    }
    if (_descCtrl.text.trim().length < 10) {
      _descError = 'Description needs at least 10 characters';
      ok = false;
    } else {
      _descError = null;
    }
    return ok;
  }

  bool _validateStep1() {
    bool ok = true;
    if (!_negotiable) {
      final price = double.tryParse(_priceCtrl.text.trim());
      if (price == null || price < 0) {
        _priceError = 'Enter a valid price';
        ok = false;
      } else {
        _priceError = null;
      }
    } else {
      _priceError = null;
    }
    return ok;
  }

  bool _validateStep2() {
    if (_photos.isEmpty) {
      _photosError = 'Add at least one photo';
      return false;
    }
    _photosError = null;
    return true;
  }

  void _next() {
    setState(_clearStepErrors);
    if (_step == 0) {
      if (!_validateStep0()) { setState(() {}); return; }
    } else if (_step == 1) {
      if (!_validateStep1()) { setState(() {}); return; }
    } else if (_step == 2) {
      if (!_validateStep2()) { setState(() {}); return; }
    }
    if (_step < 3) setState(() => _step++);
  }

  void _prev() {
    if (_step > 0) setState(() => _step--);
  }

  // ---------------------------------------------------------------------------
  // Photos
  // ---------------------------------------------------------------------------

  Future<void> _pickPhotos() async {
    if (_pickingPhoto) return;
    final remaining = _kMaxPhotos - _photos.length;
    if (remaining <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 10 photos reached.')),
      );
      return;
    }
    setState(() => _pickingPhoto = true);
    try {
      final picker = ImagePicker();
      final picked = await picker.pickMultiImage(imageQuality: 78);
      if (picked.isEmpty) return;
      final valid = picked.take(remaining).toList();
      final skipped = picked.length - valid.length;
      setState(() {
        _photos.addAll(valid);
        _photosError = null;
      });
      if (skipped > 0 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$skipped photo(s) skipped — limit reached')),
        );
      }
    } finally {
      if (mounted) setState(() => _pickingPhoto = false);
    }
  }

  void _removePhoto(int index) {
    setState(() => _photos.removeAt(index));
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  Future<void> _submit() async {
    if (_submitting) return;

    // Re-validate everything
    setState(_clearStepErrors);
    final v0 = _validateStep0();
    final v1 = _validateStep1();
    final v2 = _validateStep2();
    if (!v0 || !v1 || !v2) {
      setState(() {});
      return;
    }

    setState(() => _submitting = true);
    try {
      final uid = AuthService.currentUserId!;
      final client = Supabase.instance.client;

      // Upload images
      final imageUrls = <String>[];
      for (var i = 0; i < _photos.length; i++) {
        final file   = _photos[i];
        final bytes  = await File(file.path).readAsBytes();
        final ext    = file.path.split('.').last.toLowerCase();
        final path   = 'listings/$uid/${DateTime.now().millisecondsSinceEpoch}_$i.$ext';
        await client.storage.from('listing-images').uploadBinary(
          path,
          bytes,
          fileOptions: FileOptions(contentType: 'image/$ext', upsert: false),
        );
        final url = client.storage.from('listing-images').getPublicUrl(path);
        imageUrls.add(url);
      }

      // Insert listing row
      final response = await client.from('listings').insert({
        'title':       _titleCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'price':       _negotiable ? 0 : (double.tryParse(_priceCtrl.text.trim()) ?? 0),
        'currency':    _currency,
        'category':    _category,
        'condition':   _conditionSel,
        'city':        _city,
        'phone':       _phoneCtrl.text.trim(),
        'negotiable':  _negotiable,
        'user_id':     uid,
        'images':      imageUrls,
        'status':      'active',
        'views':       0,
      }).select('id').single();

      final newId = response['id'] as String;

      if (mounted) {
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text(
              'Your ad is live!',
              style: TextStyle(
                fontFamily: 'Inter',
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            content: const Text(
              'Your listing has been posted successfully.',
              style: TextStyle(fontFamily: 'Inter', color: AppColors.textSecondary),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  _resetForm();
                },
                child: const Text('Post Another'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: () {
                  Navigator.of(ctx).pop();
                  context.go('/listing/$newId');
                },
                child: const Text('View Listing'),
              ),
            ],
          ),
        );
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
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _resetForm() {
    setState(() {
      _step        = 0;
      _category    = null;
      _conditionSel = null;
      _currency    = 'USD';
      _city        = _kCities.first;
      _negotiable  = false;
      _photos.clear();
      _titleCtrl.clear();
      _descCtrl.clear();
      _priceCtrl.clear();
      _phoneCtrl.clear();
      _clearStepErrors();
    });
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final isSignedIn = AuthService.isSignedIn;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Post a Free Ad',
          style: TextStyle(
            fontFamily: 'Inter',
            fontWeight: FontWeight.w700,
            fontSize: 18,
            color: Colors.white,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: isSignedIn ? _buildForm() : _buildAuthGate(),
    );
  }

  // ---------------------------------------------------------------------------
  // Auth gate
  // ---------------------------------------------------------------------------

  Widget _buildAuthGate() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.lightBlue,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.lock_outline,
                size: 40,
                color: AppColors.primaryBlue,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Login to post an ad',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            const Text(
              'Sign in to post listings and reach buyers across Zimbabwe.',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () => showAuthModal(context, 'Login to post a listing'),
                child: const Text(
                  'Sign In',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Multi-step form
  // ---------------------------------------------------------------------------

  Widget _buildForm() {
    return Column(
      children: [
        _buildHeader(),
        _buildProgressBar(),
        if (_submitting)
          const LinearProgressIndicator(
            backgroundColor: AppColors.lightBlue,
            color: AppColors.primaryBlue,
          ),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: _buildStepBody(),
          ),
        ),
        _buildBottomButtons(),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      color: AppColors.primaryBlue,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Reach buyers across Zimbabwe in minutes',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: Colors.white70,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressBar() {
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Row(
        children: List.generate(4, (i) {
          final isDone    = i < _step;
          final isCurrent = i == _step;
          return Expanded(
            child: Row(
              children: [
                Expanded(
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    height: 6,
                    decoration: BoxDecoration(
                      color: isDone
                          ? AppColors.primaryBlue
                          : isCurrent
                              ? AppColors.orange
                              : AppColors.border,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                if (i < 3) const SizedBox(width: 6),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _buildStepBody() {
    switch (_step) {
      case 0:
        return _buildStep0();
      case 1:
        return _buildStep1();
      case 2:
        return _buildStep2();
      case 3:
        return _buildStep3Preview();
      default:
        return const SizedBox.shrink();
    }
  }

  // ---- Step 0: Category + Title + Description --------------------------------

  Widget _buildStep0() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('Category'),
        const SizedBox(height: 10),
        if (_catError != null) _errorText(_catError!),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.1,
          children: _kCategories.map((cat) {
            final sel = _category == cat.id;
            return GestureDetector(
              onTap: () => setState(() {
                _category = cat.id;
                _catError = null;
              }),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                decoration: BoxDecoration(
                  color: sel ? AppColors.primaryBlue : AppColors.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: sel ? AppColors.primaryBlue : AppColors.border,
                    width: sel ? 2 : 1,
                  ),
                  boxShadow: sel
                      ? [
                          BoxShadow(
                            color: AppColors.primaryBlue.withValues(alpha: 0.2),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      cat.icon,
                      size: 26,
                      color: sel ? Colors.white : AppColors.primaryBlue,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      cat.name,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: sel ? Colors.white : AppColors.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),

        const SizedBox(height: 24),
        _sectionLabel('Title'),
        const SizedBox(height: 8),
        TextField(
          controller: _titleCtrl,
          maxLength: 80,
          decoration: InputDecoration(
            hintText: 'e.g. 3 Bedroom Flat in Avondale',
            errorText: _titleError,
            filled: true,
            fillColor: AppColors.card,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.primaryBlue, width: 2),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.error),
            ),
          ),
          onChanged: (_) {
            if (_titleError != null) setState(() => _titleError = null);
          },
        ),

        const SizedBox(height: 16),
        _sectionLabel('Description'),
        const SizedBox(height: 8),
        TextField(
          controller: _descCtrl,
          maxLines: 4,
          maxLength: 2000,
          decoration: InputDecoration(
            hintText: 'Describe what you\'re selling · condition, features, why you\'re selling...',
            errorText: _descError,
            filled: true,
            fillColor: AppColors.card,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.primaryBlue, width: 2),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.error),
            ),
          ),
          onChanged: (_) {
            if (_descError != null) setState(() => _descError = null);
          },
        ),
      ],
    );
  }

  // ---- Step 1: Price + Location + Condition + Phone -------------------------

  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('Price'),
        const SizedBox(height: 8),
        Row(
          children: [
            // Currency toggle
            Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: ['USD', 'ZWG'].map((c) {
                  final sel = _currency == c;
                  return GestureDetector(
                    onTap: () => setState(() => _currency = c),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                      decoration: BoxDecoration(
                        color: sel ? AppColors.primaryBlue : Colors.transparent,
                        borderRadius: BorderRadius.circular(9),
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
              child: TextField(
                controller: _priceCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                enabled: !_negotiable,
                decoration: InputDecoration(
                  hintText: _negotiable ? 'Negotiable' : '0',
                  prefixText: _currency == 'USD' ? r'$ ' : 'ZWG ',
                  errorText: _priceError,
                  filled: true,
                  fillColor: _negotiable ? AppColors.background : AppColors.card,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.primaryBlue, width: 2),
                  ),
                  errorBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.error),
                  ),
                ),
                onChanged: (_) {
                  if (_priceError != null) setState(() => _priceError = null);
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Switch(
              value: _negotiable,
              onChanged: (v) => setState(() {
                _negotiable = v;
                _priceError = null;
              }),
              activeColor: AppColors.primaryBlue,
            ),
            const SizedBox(width: 8),
            const Text(
              'Price is negotiable',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),

        const SizedBox(height: 20),
        _sectionLabel('Condition'),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _kConditions.map((c) {
            final sel = _conditionSel == c;
            return GestureDetector(
              onTap: () => setState(() => _conditionSel = sel ? null : c),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: sel ? AppColors.primaryBlue : AppColors.card,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: sel ? AppColors.primaryBlue : AppColors.border,
                  ),
                ),
                child: Text(
                  c,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: sel ? Colors.white : AppColors.textSecondary,
                  ),
                ),
              ),
            );
          }).toList(),
        ),

        const SizedBox(height: 20),
        _sectionLabel('City / Town'),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: AppColors.card,
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(10),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _city,
              isExpanded: true,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textPrimary,
              ),
              items: _kCities
                  .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                  .toList(),
              onChanged: (v) => setState(() => _city = v ?? _kCities.first),
            ),
          ),
        ),

        const SizedBox(height: 20),
        _sectionLabel('Phone Number'),
        const SizedBox(height: 8),
        TextField(
          controller: _phoneCtrl,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            hintText: '+263 77 123 4567',
            filled: true,
            fillColor: AppColors.card,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.primaryBlue, width: 2),
            ),
          ),
        ),
      ],
    );
  }

  // ---- Step 2: Photos --------------------------------------------------------

  Widget _buildStep2() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _sectionLabel('Photos'),
            const SizedBox(width: 6),
            Text(
              '(up to $_kMaxPhotos · first is the cover)',
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Upload zone
        GestureDetector(
          onTap: _pickingPhoto ? null : _pickPhotos,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 28),
            decoration: BoxDecoration(
              color: AppColors.lightBlue,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppColors.primaryBlue.withValues(alpha: 0.3),
                style: BorderStyle.solid,
                width: 1.5,
              ),
            ),
            child: Column(
              children: [
                Icon(
                  Icons.add_a_photo_outlined,
                  size: 32,
                  color: AppColors.primaryBlue.withValues(alpha: _pickingPhoto ? 0.4 : 1.0),
                ),
                const SizedBox(height: 8),
                Text(
                  _pickingPhoto ? 'Processing...' : 'Tap to add photos',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: AppColors.primaryBlue.withValues(alpha: _pickingPhoto ? 0.5 : 1.0),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'JPG, PNG · Max 10 photos',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),

        if (_photosError != null) ...[const SizedBox(height: 6), _errorText(_photosError!)],

        if (_photos.isNotEmpty) ...[const SizedBox(height: 16)],

        // Photo grid
        if (_photos.isNotEmpty)
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
            ),
            itemCount: _photos.length,
            itemBuilder: (ctx, i) => _PhotoThumb(
              xfile: _photos[i],
              isCover: i == 0,
              onRemove: () => _removePhoto(i),
            ),
          ),

        const SizedBox(height: 16),
        // Tip box
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.lightBlue,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.primaryBlue.withValues(alpha: 0.15)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.camera_alt_outlined,
                  size: 18, color: AppColors.primaryBlue),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Photos sell 3x faster',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: AppColors.primaryBlue,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Listings with 5+ clear photos in good lighting get 3x more enquiries.',
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
      ],
    );
  }

  // ---- Step 3: Preview -------------------------------------------------------

  Widget _buildStep3Preview() {
    final catName = _kCategories
        .firstWhere((c) => c.id == _category,
            orElse: () => const _Category('other', 'Other', Icons.category))
        .name;
    final priceText = _negotiable
        ? 'Negotiable'
        : '${_currency == "USD" ? "\$" : "ZWG "}'  
          '${_priceCtrl.text.trim().isEmpty ? "0" : _priceCtrl.text.trim()}';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Preview card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.visibility_outlined,
                      size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 5),
                  const Text(
                    'Ad Preview',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textMuted,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                _titleCtrl.text.trim().isEmpty
                    ? 'Untitled'
                    : _titleCtrl.text.trim(),
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                priceText,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primaryBlue,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.location_on_outlined,
                      size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 3),
                  Expanded(
                    child: Text(
                      '$_city  ·  $catName  ·  ${_photos.length} photo${_photos.length == 1 ? '' : 's'}',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Rules tip
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF8EE),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.orange.withValues(alpha: 0.3)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.article_outlined,
                  size: 18, color: AppColors.orange),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Listing Rules',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: AppColors.orange,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'By posting you confirm this item is legal, you own it, and the photos are real. Scam listings result in account suspension.',
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

        const SizedBox(height: 24),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Bottom navigation buttons
  // ---------------------------------------------------------------------------

  Widget _buildBottomButtons() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: const BoxDecoration(
        color: AppColors.card,
        border: Border(
          top: BorderSide(color: AppColors.border),
        ),
      ),
      child: Row(
        children: [
          if (_step > 0) ...[  
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              ),
              onPressed: _submitting ? null : _prev,
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.arrow_back, size: 16, color: AppColors.textSecondary),
                  SizedBox(width: 6),
                  Text(
                    'Back',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: _step == 3 ? AppColors.orange : AppColors.primaryBlue,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 0,
              ),
              onPressed: _submitting ? null : (_step == 3 ? _submit : _next),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _step == 3 ? 'Post Ad' : 'Continue',
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Icon(
                          _step == 3 ? Icons.check : Icons.arrow_forward,
                          size: 18,
                        ),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Shared widgets
  // ---------------------------------------------------------------------------

  Widget _sectionLabel(String text) => Text(
        text,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
      );

  Widget _errorText(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(
          text,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 12,
            color: AppColors.error,
            fontWeight: FontWeight.w500,
          ),
        ),
      );
}

// ---------------------------------------------------------------------------
// Photo thumbnail widget
// ---------------------------------------------------------------------------

class _PhotoThumb extends StatelessWidget {
  final XFile xfile;
  final bool isCover;
  final VoidCallback onRemove;

  const _PhotoThumb({
    required this.xfile,
    required this.isCover,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Image.file(
            File(xfile.path),
            fit: BoxFit.cover,
          ),
        ),
        // Remove button
        Positioned(
          top: 4,
          right: 4,
          child: GestureDetector(
            onTap: onRemove,
            child: Container(
              width: 24,
              height: 24,
              decoration: const BoxDecoration(
                color: Colors.black54,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.close, size: 14, color: Colors.white),
            ),
          ),
        ),
        // Cover badge
        if (isCover)
          Positioned(
            bottom: 4,
            left: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
  }
}
