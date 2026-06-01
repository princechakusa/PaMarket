import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../models/listing.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';

class SavedScreen extends StatefulWidget {
  const SavedScreen({super.key});

  @override
  State<SavedScreen> createState() => _SavedScreenState();
}

class _SavedScreenState extends State<SavedScreen> {
  final _supabase = Supabase.instance.client;
  List<Listing> _listings = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (AuthService.isSignedIn) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final uid = AuthService.currentUserId!;
      // Fetch saved listing IDs
      final saves = await _supabase
          .from('saves')
          .select('listing_id')
          .eq('user_id', uid);

      final ids = (saves as List)
          .map((s) => s['listing_id'] as String)
          .toList();

      if (ids.isEmpty) {
        if (mounted) setState(() => _loading = false);
        return;
      }

      // Fetch listing details for each saved ID
      final data = await _supabase
          .from('listings')
          .select('*, profiles(verified, avatar)')
          .inFilter('id', ids)
          .neq('status', 'deleted');

      if (mounted) {
        setState(() {
          _listings = (data as List).map((m) => Listing.fromMap(m)).toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load saved ads.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Saved Ads')),
        body: _SignInPrompt(
          message: 'Sign in to see your saved ads',
          onSignIn: () => context.push('/login'),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Saved Ads')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorState(error: _error!, onRetry: _load)
              : _listings.isEmpty
                  ? const _EmptyState()
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.primaryBlue,
                      child: GridView.builder(
                        padding:
                            const EdgeInsets.fromLTRB(16, 16, 16, 100),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 0.72,
                        ),
                        itemCount: _listings.length,
                        itemBuilder: (_, i) =>
                            ListingCard(listing: _listings[i]),
                      ),
                    ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.favorite_outline, size: 72, color: AppColors.border),
            const SizedBox(height: 16),
            const Text(
              'Nothing saved yet',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Tap ♡ on any listing to save it',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => context.go('/home'),
              icon: const Icon(Icons.search),
              label: const Text('Browse Listings'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignInPrompt extends StatelessWidget {
  final String message;
  final VoidCallback onSignIn;

  const _SignInPrompt({required this.message, required this.onSignIn});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.lock_outline, size: 64, color: AppColors.border),
            const SizedBox(height: 16),
            Text(
              message,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: onSignIn,
              child: const Text('Sign In'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;

  const _ErrorState({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 56, color: AppColors.error),
          const SizedBox(height: 12),
          Text(error,
              style: const TextStyle(
                  fontFamily: 'Inter', color: AppColors.textSecondary)),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: onRetry,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
