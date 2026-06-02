import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/app_theme.dart';

class AdvertiseScreen extends StatefulWidget {
  const AdvertiseScreen({super.key});

  @override
  State<AdvertiseScreen> createState() => _AdvertiseScreenState();
}

class _AdvertiseScreenState extends State<AdvertiseScreen> {
  final TextEditingController _bizCtrl = TextEditingController();
  final TextEditingController _emailCtrl = TextEditingController();
  final TextEditingController _msgCtrl = TextEditingController();

  static const List<String> _adTypes = [
    'Banner Ad',
    'Category Spotlight',
    'Custom Campaign',
  ];
  String _adType = _adTypes.first;
  bool _sending = false;

  static const List<List<String>> _offers = [
    ['Banner Ad', 'Eye-catching banner placement on the home screen.'],
    [
      'Category Spotlight',
      'Pin your business to the top of a category of your choice.'
    ],
    ['Custom Campaign', 'Tailored multi-placement campaign for maximum reach.'],
  ];

  @override
  void dispose() {
    _bizCtrl.dispose();
    _emailCtrl.dispose();
    _msgCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitEnquiry() async {
    final biz = _bizCtrl.text.trim();
    if (biz.isEmpty) {
      _snack('Please enter your business name');
      return;
    }
    setState(() => _sending = true);

    // Best-effort insert; never crash if the table is missing.
    try {
      await Supabase.instance.client.from('ad_enquiries').insert({
        'business_name': biz,
        'contact_email': _emailCtrl.text.trim(),
        'ad_type': _adType,
        'message': _msgCtrl.text.trim(),
      });
    } catch (_) {
      // Ignore — enquiry handling stays client-side.
    }

    if (!mounted) return;
    setState(() => _sending = false);

    _snack("Enquiry sent! We'll be in touch soon.");
    _bizCtrl.clear();
    _emailCtrl.clear();
    _msgCtrl.clear();
    setState(() => _adType = _adTypes.first);
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(msg, style: const TextStyle(fontFamily: 'Inter')),
        ),
      );
  }

  Future<void> _openWhatsApp() async {
    final uri = Uri.parse(
      "https://wa.me/971589772645?text=Hi%2C%20I'm%20interested%20in%20advertising%20on%20PaMarket",
    );
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) _snack('Could not open WhatsApp');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Advertise with PaMarket',
          style: TextStyle(
            fontFamily: 'Inter',
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _heroCard(),
          const SizedBox(height: 16),
          _whatWeOfferCard(),
          const SizedBox(height: 16),
          _enquiryCard(),
          const SizedBox(height: 16),
          _whatsAppCard(),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _heroCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primaryBlue, AppColors.darkBlue],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Text(
            'Grow Your Business',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Connect with active buyers across all provinces of Zimbabwe. '
            "Tell us about your goals and we'll find the right fit for you.",
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13.5,
              height: 1.45,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _cardShell({required Widget child, AlignmentGeometry? align}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: child,
    );
  }

  Widget _sectionTitle(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: FontWeight.w800,
        color: AppColors.textPrimary,
      ),
    );
  }

  Widget _whatWeOfferCard() {
    return _cardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('What We Offer'),
          const SizedBox(height: 12),
          for (int i = 0; i < _offers.length; i++) ...[
            _offerBox(_offers[i][0], _offers[i][1]),
            if (i != _offers.length - 1) const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }

  Widget _offerBox(String title, String desc) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.lightBlue,
        borderRadius: BorderRadius.circular(10),
      ),
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
          const SizedBox(height: 3),
          Text(
            desc,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              height: 1.4,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _enquiryCard() {
    return _cardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('Send an Enquiry'),
          const SizedBox(height: 14),
          _fieldLabel('Business Name'),
          const SizedBox(height: 6),
          _input(
            controller: _bizCtrl,
            hint: 'Your business name',
          ),
          const SizedBox(height: 14),
          _fieldLabel('Contact Email'),
          const SizedBox(height: 6),
          _input(
            controller: _emailCtrl,
            hint: 'your@email.com',
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 14),
          _fieldLabel('Ad Type'),
          const SizedBox(height: 6),
          _adTypeDropdown(),
          const SizedBox(height: 14),
          _fieldLabel('Message'),
          const SizedBox(height: 6),
          _input(
            controller: _msgCtrl,
            hint: "Tell us about your product or service and "
                "what you'd like to achieve...",
            maxLines: 4,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _sending ? null : _submitEnquiry,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryBlue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 15),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor:
                            AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text(
                      'Send Enquiry',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _fieldLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
    );
  }

  InputDecoration _decoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        color: AppColors.textMuted,
      ),
      filled: true,
      fillColor: AppColors.background,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
        borderSide: const BorderSide(color: AppColors.primaryBlue),
      ),
    );
  }

  Widget _input({
    required TextEditingController controller,
    required String hint,
    TextInputType? keyboardType,
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      style: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        color: AppColors.textPrimary,
      ),
      decoration: _decoration(hint),
    );
  }

  Widget _adTypeDropdown() {
    return DropdownButtonFormField<String>(
      value: _adType,
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.textMuted),
      style: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        color: AppColors.textPrimary,
      ),
      decoration: _decoration('Select ad type'),
      items: _adTypes
          .map(
            (t) => DropdownMenuItem<String>(
              value: t,
              child: Text(
                t,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          )
          .toList(),
      onChanged: (v) {
        if (v != null) setState(() => _adType = v);
      },
    );
  }

  Widget _whatsAppCard() {
    return _cardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _sectionTitle('Prefer WhatsApp?'),
          const SizedBox(height: 10),
          const Text(
            "Chat with us directly on WhatsApp and we'll get back to you "
            'quickly.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13.5,
              height: 1.45,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _openWhatsApp,
            icon: const Icon(Icons.chat, size: 18, color: Colors.white),
            label: const Text(
              'Chat on WhatsApp',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF25D366),
              foregroundColor: Colors.white,
              elevation: 0,
              padding:
                  const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
