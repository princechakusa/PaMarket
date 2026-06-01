import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class FaqScreen extends StatelessWidget {
  const FaqScreen({super.key});

  static const _faqs = [
    _FaqItem(
      question: 'How do I post an ad?',
      answer:
          "Tap the orange + button at the bottom. Fill in category, photos, price, description and your location. It's free!",
    ),
    _FaqItem(
      question: 'Is PaMarket free?',
      answer:
          'Yes! Posting and browsing ads is completely free. We may introduce premium features in future.',
    ),
    _FaqItem(
      question: 'How do I contact a seller?',
      answer:
          "Open any listing and tap 'Chat with Seller' or 'WhatsApp' or 'Call'. You must be signed in to chat.",
    ),
    _FaqItem(
      question: 'How do I get verified?',
      answer:
          'Go to Profile → Get Verified. Upload your national ID and a selfie. Business verification requires company documents.',
    ),
    _FaqItem(
      question: 'How do I report a listing?',
      answer:
          'Open the listing and tap the flag/report icon. Select a reason and submit.',
    ),
    _FaqItem(
      question: 'How long do ads stay active?',
      answer:
          'Ads are active for 30 days. You can renew them from My Listings before they expire.',
    ),
    _FaqItem(
      question: 'Can I edit my listing?',
      answer:
          'Go to My Listings and tap View, then use the edit option. You can update photos, price and description.',
    ),
    _FaqItem(
      question: 'What cities does PaMarket cover?',
      answer:
          'PaMarket covers all of Zimbabwe including Harare, Bulawayo, Mutare, Gweru, Masvingo, and more.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('FAQ')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          const _HeaderBanner(),
          const SizedBox(height: 16),
          ..._faqs.map((faq) => _FaqTile(faq: faq)),
          const SizedBox(height: 24),
          _ContactCard(),
        ],
      ),
    );
  }
}

class _HeaderBanner extends StatelessWidget {
  const _HeaderBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.darkBlue, AppColors.primaryBlue],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.help_outline, color: Colors.white, size: 24),
              SizedBox(width: 10),
              Text(
                'Frequently Asked Questions',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          SizedBox(height: 8),
          Text(
            'Find answers to common questions about using PaMarket.',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: Colors.white70,
              height: 1.4,
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
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        childrenPadding:
            const EdgeInsets.fromLTRB(16, 0, 16, 16),
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

class _ContactCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.lightBlue,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: AppColors.primaryBlue.withValues(alpha: 0.2)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Still need help?',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.primaryBlue,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Contact our support team at support@pamarket.co.zw and we will get back to you within 24 hours.',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.5,
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
