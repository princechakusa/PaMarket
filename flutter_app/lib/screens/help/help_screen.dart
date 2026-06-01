import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme/app_theme.dart';

class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Help & Legal')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SectionHeader('Help & Support'),
          _HelpTile(
            icon: Icons.verified_user_outlined,
            title: 'How to Get Verified',
            subtitle: 'Steps to earn your verified badge',
            onTap: () => context.push('/help/get-verified'),
          ),
          _HelpTile(
            icon: Icons.help_outline,
            title: 'FAQ',
            subtitle: 'Frequently asked questions',
            onTap: () => context.push('/help/faq'),
          ),

          const SizedBox(height: 8),
          _SectionHeader('Legal'),

          _HelpTile(
            icon: Icons.gavel_outlined,
            title: 'Terms of Service',
            subtitle: 'Our terms and conditions',
            onTap: () => context.push('/terms'),
          ),
          _HelpTile(
            icon: Icons.privacy_tip_outlined,
            title: 'Privacy Policy',
            subtitle: 'How we handle your data',
            onTap: () => context.push('/privacy'),
          ),
          _HelpTile(
            icon: Icons.people_outline,
            title: 'Community Guidelines',
            subtitle: 'Rules for a safe marketplace',
            onTap: () => context.push('/community-guidelines'),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
          letterSpacing: 1,
        ),
      ),
    );
  }
}

class _HelpTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _HelpTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.lightBlue,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.primaryBlue, size: 20),
        ),
        title: Text(title,
            style: const TextStyle(
                fontFamily: 'Inter',
                fontWeight: FontWeight.w600,
                fontSize: 15)),
        subtitle: Text(subtitle,
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                color: AppColors.textSecondary)),
        trailing: const Icon(Icons.arrow_forward_ios,
            size: 14, color: AppColors.textMuted),
        onTap: onTap,
      ),
    );
  }
}

// ── Static content screens ─────────────────────────────────────

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      _StaticPage(title: 'Terms of Service', content: _kTerms);
}

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      _StaticPage(title: 'Privacy Policy', content: _kPrivacy);
}

class CommunityGuidelinesScreen extends StatelessWidget {
  const CommunityGuidelinesScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      _StaticPage(title: 'Community Guidelines', content: _kGuidelines);
}

class GetVerifiedScreen extends StatelessWidget {
  const GetVerifiedScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      _StaticPage(title: 'How to Get Verified', content: _kGetVerified);
}

class _StaticPage extends StatelessWidget {
  final String title;
  final String content;

  const _StaticPage({required this.title, required this.content});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Text(
          content,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            color: AppColors.textSecondary,
            height: 1.7,
          ),
        ),
      ),
    );
  }
}

// ── Static content ─────────────────────────────────────────────

const _kTerms = '''
Terms of Service — PaMarket

Last updated: January 2025

Welcome to PaMarket. By using our platform you agree to these terms.

1. ACCEPTANCE
By accessing PaMarket you agree to be bound by these Terms of Service and all applicable laws.

2. USE OF THE PLATFORM
PaMarket is a marketplace connecting buyers and sellers in Zimbabwe. We do not verify the quality, safety or legality of items listed. You use the platform at your own risk.

3. USER ACCOUNTS
You must be 18 years or older to create an account. You are responsible for maintaining the confidentiality of your account credentials. You must not create accounts for fraudulent purposes.

4. LISTINGS
You are solely responsible for the accuracy of your listings. Prohibited items include stolen goods, illegal weapons, controlled substances, counterfeit items, and adult content. PaMarket reserves the right to remove any listing without notice.

5. PAYMENTS
PaMarket does not process payments between buyers and sellers. All transactions are conducted directly between parties. We are not responsible for any disputes arising from transactions.

6. VERIFICATION
Verified badges are awarded at PaMarket's discretion after review of submitted documents. Verification does not guarantee the identity or trustworthiness of a user.

7. LIMITATION OF LIABILITY
PaMarket is not liable for any direct, indirect, incidental or consequential damages arising from your use of the platform.

8. TERMINATION
We reserve the right to suspend or terminate accounts that violate these terms.

Contact us at support@pamarket.co.zw for any queries.
''';

const _kPrivacy = '''
Privacy Policy — PaMarket

Last updated: January 2025

PaMarket ("we", "us") is committed to protecting your privacy.

1. INFORMATION WE COLLECT
- Account information: name, email, phone number
- Profile information: city, bio, profile photo
- Listing data: photos, descriptions, prices
- Verification documents: ID photos, selfies, business documents
- Usage data: browsing activity, search queries
- Device information: device type, IP address

2. HOW WE USE YOUR INFORMATION
- To provide and improve our services
- To verify user identities
- To show relevant listings
- To facilitate communication between users
- To send notifications about listing activity
- To investigate reports and enforce our policies

3. PHOTOGRAPHY DISCLOSURE
For business verification, we collect photographs of company premises, documents and authorised representatives. These photos are stored securely and used only for verification purposes.

4. DATA SHARING
We do not sell your personal data. We may share data with:
- Service providers who help operate PaMarket
- Law enforcement when required by law
- Other users only as necessary (e.g., seller phone number shown on listing)

5. DATA RETENTION
We retain your data for as long as your account is active or as needed to provide services.

6. YOUR RIGHTS
You may request access to, correction of, or deletion of your personal data by contacting support@pamarket.co.zw.

7. SECURITY
We use industry-standard security measures including encryption in transit and at rest.

8. CONTACT
Email: support@pamarket.co.zw
''';

const _kGuidelines = '''
Community Guidelines — PaMarket

PaMarket is Zimbabwe's trusted marketplace. To keep it safe and fair, all users must follow these guidelines.

WHAT IS ALLOWED
✓ Genuine listings for real items and services
✓ Honest descriptions and accurate photos
✓ Respectful communication with other users
✓ Reporting suspicious or inappropriate content

WHAT IS NOT ALLOWED
✗ Stolen or illegally obtained goods
✗ Fake or counterfeit items
✗ Misleading or fraudulent listings
✗ Harassment, threats or hate speech
✗ Spam or duplicate listings
✗ Adult or explicit content
✗ Pyramid schemes or multi-level marketing
✗ Listings for prohibited or controlled substances

REPORTING
Use the report button on any listing or profile to flag violations. Our team reviews all reports within 48 hours.

CONSEQUENCES
Violations may result in listing removal, temporary suspension, or permanent ban depending on severity.

BUYING & SELLING SAFELY
• Meet in public places for in-person transactions
• Never pay in advance without verifying the seller
• Use the in-app messaging to keep communication on record
• Look for the verified badge for added trust

Questions? Contact support@pamarket.co.zw
''';

const _kGetVerified = '''
How to Get Verified on PaMarket

A verified badge shows buyers and sellers that your identity has been confirmed by PaMarket.

INDIVIDUAL VERIFICATION
1. Go to your Profile
2. Tap "Get Verified"
3. Upload a clear photo of your national ID, passport or driver's licence
4. Take a selfie holding your ID
5. Submit and wait 1–3 business days for review

If approved, you will receive a blue verified badge on your profile and listings.

BUSINESS VERIFICATION
Businesses and companies can get a blue verified business badge.

Requirements:
• Certificate of Incorporation or Business Registration
• Company tax clearance certificate
• Photo of business premises (exterior and interior)
• Photo of authorised company representative with ID

Steps:
1. Go to Profile → Business Verification
2. Upload all required documents
3. Our team will contact you within 3–5 business days
4. Once approved, your business gets a verified badge

BENEFITS OF BEING VERIFIED
• Higher trust from buyers and sellers
• Verified badge shown on all your listings
• Priority in search results
• Access to premium listing features (coming soon)

TIPS
• Ensure all photos are clear and legible
• Documents must be current and valid
• Photos taken in good lighting perform better

Questions? Email verify@pamarket.co.zw
''';
