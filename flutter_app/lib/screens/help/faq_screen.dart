import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/app_theme.dart';

class FaqScreen extends StatefulWidget {
  const FaqScreen({super.key});

  @override
  State<FaqScreen> createState() => _FaqScreenState();
}

class _FaqScreenState extends State<FaqScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  static const _faqs = [
    _FaqItem(
      question: 'How do I post an ad?',
      answer:
          'Tap the Post Ad button at the bottom of the screen. Follow the steps to add photos, title, description, price, and location. Your ad will be reviewed before going live.',
    ),
    _FaqItem(
      question: 'How much does it cost to post?',
      answer:
          'Posting an ad is completely free. Browsing, messaging, applying for jobs, and getting verified are all free too. No subscriptions, no hidden fees, no commission on sales.',
    ),
    _FaqItem(
      question: 'How long do listings stay active?',
      answer:
          'Listings remain active for 30 days. You can renew your listing anytime by tapping "Renew" on My Listings.',
    ),
    _FaqItem(
      question: 'How do I get verified?',
      answer:
          "Go to your Profile > Verify Identity. Upload a valid ID and we'll verify it within 24 hours. Verified sellers get a blue badge!",
    ),
    _FaqItem(
      question: 'Can I edit my listing?',
      answer:
          'Yes! Go to My Listings, tap the listing, then tap Edit. You can change photos, price, description, and other details.',
    ),
    _FaqItem(
      question: 'Is my information safe?',
      answer:
          'We use industry-standard encryption to protect your data. Your phone number and email are never shared without your permission.',
    ),
    _FaqItem(
      question: 'How do I report inappropriate content?',
      answer:
          'Tap the listing, scroll to the bottom, and tap "Report". Select the reason and submit. We review all reports within 24h.',
    ),
    _FaqItem(
      question: 'How do I block a user?',
      answer:
          "Tap their profile > Block User. They won't be able to see your listings or contact you. Manage blocked users in Settings.",
    ),
    _FaqItem(
      question: 'What payment methods do you accept?',
      answer:
          'We accept mobile money (EcoCash, OneMoney), bank transfers, and card payments. All payments are secure and verified.',
    ),
    _FaqItem(
      question: 'How do I delete my account?',
      answer:
          'Go to Settings > Security > Delete Account. Your account and all listings will be permanently removed after 30 days.',
    ),
  ];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<_FaqItem> get _filtered {
    if (_query.isEmpty) return _faqs;
    final lower = _query.toLowerCase();
    return _faqs
        .where((f) =>
            f.question.toLowerCase().contains(lower) ||
            f.answer.toLowerCase().contains(lower))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;

    return Scaffold(
      appBar: AppBar(title: const Text('FAQs')),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) => setState(() => _query = v),
              decoration: InputDecoration(
                hintText: 'Search questions...',
                hintStyle: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    color: AppColors.textMuted),
                prefixIcon: const Icon(Icons.search,
                    color: AppColors.textMuted, size: 20),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close,
                            color: AppColors.textMuted, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _query = '');
                        },
                      )
                    : null,
                filled: true,
                fillColor: AppColors.card,
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
                      const BorderSide(color: AppColors.primaryBlue, width: 1.5),
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
          ),

          // FAQ list
          Expanded(
            child: filtered.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.search_off,
                            size: 56, color: AppColors.border),
                        SizedBox(height: 12),
                        Text(
                          'No results found',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                    children: [
                      ...filtered.map((faq) => _FaqTile(faq: faq)),
                      const SizedBox(height: 24),
                      _ContactSupportCard(),
                      const SizedBox(height: 24),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _FaqTile extends StatelessWidget {
  final _FaqItem faq;
  const _FaqTile({required this.faq});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: ExpansionTile(
        tilePadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        iconColor: AppColors.primaryBlue,
        collapsedIconColor: AppColors.textMuted,
        title: Text(
          faq.question,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        children: [
          Text(
            faq.answer,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactSupportCard extends StatelessWidget {
  Future<void> _launch(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Quick Contact',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),

          // Email
          InkWell(
            onTap: () => _launch('mailto:chakusaprince@gmail.com'),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  const Icon(Icons.email_outlined,
                      color: AppColors.primaryBlue, size: 20),
                  const SizedBox(width: 10),
                  const Text(
                    'chakusaprince@gmail.com',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primaryBlue,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1, color: AppColors.border),

          // Phone
          InkWell(
            onTap: () => _launch('tel:+971589772645'),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  const Icon(Icons.phone_outlined,
                      color: AppColors.success, size: 20),
                  const SizedBox(width: 10),
                  const Text(
                    '+971 589 772 645',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.success,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1, color: AppColors.border),

          // WhatsApp
          InkWell(
            onTap: () => _launch('https://wa.me/971589772645'),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  const Icon(Icons.chat_outlined,
                      color: Color(0xFF25D366), size: 20),
                  const SizedBox(width: 10),
                  const Text(
                    'Chat on WhatsApp',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF25D366),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FaqItem {
  final String question;
  final String answer;
  const _FaqItem({required this.question, required this.answer});
}
