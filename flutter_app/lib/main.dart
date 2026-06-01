import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config/supabase_config.dart';
import 'services/auth_service.dart';
import 'theme/app_theme.dart';

import 'screens/splash_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/signup_screen.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/listing/listing_detail_screen.dart';
import 'screens/listing/post_listing_screen.dart';
import 'screens/listing/category_screen.dart';
import 'screens/chat/conversations_screen.dart';
import 'screens/chat/chat_screen.dart';
import 'screens/profile/account_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/profile/saved_screen.dart';
import 'screens/profile/my_listings_screen.dart';
import 'screens/profile/edit_profile_screen.dart';
import 'screens/search/search_screen.dart';
import 'screens/verify/verify_screen.dart';
import 'screens/admin/admin_screen.dart';
import 'screens/help/faq_screen.dart';
import 'screens/settings/settings_screen.dart';
import 'screens/settings/notification_settings_screen.dart';
import 'screens/settings/privacy_settings_screen.dart';
import 'screens/settings/theme_settings_screen.dart';
import 'screens/settings/security_settings_screen.dart';
import 'screens/settings/blocked_users_screen.dart';
import 'screens/notifications/notifications_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  await Supabase.initialize(
    url: SupabaseConfig.url,
    anonKey: SupabaseConfig.anonKey,
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );

  runApp(const PaMarketApp());
}

final _router = GoRouter(
  initialLocation: '/',
  redirect: (context, state) {
    final isAuth = AuthService.isSignedIn;
    final loc = state.matchedLocation;
    const protected = ['/post-listing', '/verify', '/admin'];
    if (protected.contains(loc) && !isAuth) return '/login';
    return null;
  },
  routes: [
    GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/signup', builder: (_, __) => const SignupScreen()),
    GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),

    // Shell with bottom nav
    ShellRoute(
      builder: (context, state, child) => _MainShell(child: child),
      routes: [
        GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
        GoRoute(path: '/messages', builder: (_, __) => const ConversationsScreen()),
        GoRoute(path: '/profile', builder: (_, __) => const AccountScreen()),
      ],
    ),

    // Standalone routes
    GoRoute(path: '/listing/:id', builder: (_, state) => ListingDetailScreen(listingId: state.pathParameters['id']!)),
    GoRoute(path: '/post-listing', builder: (_, __) => const PostListingScreen()),
    GoRoute(path: '/chat/:id', builder: (_, state) => ChatScreen(
      conversationId: state.pathParameters['id']!,
      otherUserName: state.uri.queryParameters['name'],
    )),
    GoRoute(path: '/profile/:id', builder: (_, state) => ProfileScreen(userId: state.pathParameters['id'])),
    GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
    GoRoute(path: '/verify', builder: (_, __) => const VerifyScreen()),
    GoRoute(path: '/admin', builder: (_, __) => const AdminScreen()),

    // Profile / account
    GoRoute(path: '/saved', builder: (_, __) => const SavedScreen()),
    GoRoute(path: '/my-listings', builder: (_, __) => const MyListingsScreen()),
    GoRoute(path: '/edit-profile', builder: (_, __) => const EditProfileScreen()),

    // Settings
    GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
    GoRoute(path: '/settings/notifications', builder: (_, __) => const NotificationSettingsScreen()),
    GoRoute(path: '/settings/privacy', builder: (_, __) => const PrivacySettingsScreen()),
    GoRoute(path: '/settings/theme', builder: (_, __) => const ThemeSettingsScreen()),
    GoRoute(path: '/settings/security', builder: (_, __) => const SecuritySettingsScreen()),
    GoRoute(path: '/settings/blocked-users', builder: (_, __) => const BlockedUsersScreen()),

    // Help / Legal
    GoRoute(path: '/help/faq', builder: (_, __) => const FaqScreen()),

    // Notifications
    GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),

    // Category browse
    GoRoute(
      path: '/category/:id',
      builder: (_, state) => CategoryScreen(
        categoryId: state.pathParameters['id']!,
        categoryName: state.uri.queryParameters['name'] ?? state.pathParameters['id']!,
      ),
    ),
  ],
);

class PaMarketApp extends StatelessWidget {
  const PaMarketApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'PaMarket',
      theme: AppTheme.light,
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }
}

// ── Bottom navigation shell ─────────────────────────────────────────────────

class _MainShell extends StatelessWidget {
  final Widget child;
  const _MainShell({required this.child});

  static const _tabs = ['/home', '/messages', '/profile'];

  int _indexFromLocation(String loc) {
    if (loc.startsWith('/home')) return 0;
    if (loc.startsWith('/messages')) return 1;
    if (loc.startsWith('/profile')) return 2;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final idx = _indexFromLocation(loc);

    return Scaffold(
      body: child,
      bottomNavigationBar: _BottomNavWithFab(
        selectedIndex: idx,
        onTap: (i) {
          switch (i) {
            case 0:
              context.go('/home');
            case 1: // Search
              context.push('/search');
            case 2: // Post — gated
              if (!AuthService.isSignedIn) {
                showAuthModal(context, 'Log in to post an ad');
              } else {
                context.push('/post-listing');
              }
            case 3: // Messages — gated
              if (!AuthService.isSignedIn) {
                showAuthModal(context, 'Sign in to view messages');
              } else {
                context.go('/messages');
              }
            case 4: // Account
              context.go('/profile');
          }
        },
      ),
    );
  }
}

void showAuthModal(BuildContext context, String message) {
  showDialog(
    context: context,
    barrierColor: Colors.black54,
    builder: (ctx) => _AuthDialog(parentContext: context),
  );
}

class _AuthDialog extends StatefulWidget {
  final BuildContext parentContext;
  const _AuthDialog({required this.parentContext});

  @override
  State<_AuthDialog> createState() => _AuthDialogState();
}

class _AuthDialogState extends State<_AuthDialog> {
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Close button
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Icon(Icons.close, color: AppColors.textMuted, size: 22),
                ),
              ],
            ),
            // PaMarket logo
            RichText(
              text: const TextSpan(children: [
                TextSpan(text: 'Pa', style: TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.primaryBlue)),
                TextSpan(text: 'Market', style: TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.orange)),
              ]),
            ),
            const SizedBox(height: 20),
            // Lock icon with + badge
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 72, height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.lightBlue,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.lock_rounded, size: 40, color: AppColors.primaryBlue),
                ),
                Positioned(
                  right: -6, top: -6,
                  child: Container(
                    width: 28, height: 28,
                    decoration: const BoxDecoration(color: AppColors.orange, shape: BoxShape.circle),
                    child: const Icon(Icons.add, color: Colors.white, size: 18),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            // Continue with Google
            _loading
                ? const CircularProgressIndicator()
                : OutlinedButton(
                    onPressed: () async {
                      setState(() => _loading = true);
                      try {
                        final res = await AuthService.signInWithGoogle();
                        if (res != null && mounted) Navigator.pop(context);
                      } catch (_) {
                        if (mounted) {
                          Navigator.pop(context);
                          widget.parentContext.push('/login');
                        }
                      } finally {
                        if (mounted) setState(() => _loading = false);
                      }
                    },
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 50),
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _GoogleG(),
                        const SizedBox(width: 10),
                        const Text('Continue with Google', style: TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                      ],
                    ),
                  ),
            const SizedBox(height: 14),
            // or divider
            const Row(children: [
              Expanded(child: Divider(color: AppColors.border)),
              Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('or', style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: AppColors.textMuted))),
              Expanded(child: Divider(color: AppColors.border)),
            ]),
            const SizedBox(height: 14),
            // Login with email
            OutlinedButton(
              onPressed: () {
                Navigator.pop(context);
                widget.parentContext.push('/login');
              },
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                side: const BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.email_outlined, color: AppColors.primaryBlue, size: 22),
                  SizedBox(width: 10),
                  Text('Login with email', style: TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () {
                Navigator.pop(context);
                widget.parentContext.push('/signup');
              },
              child: RichText(
                textAlign: TextAlign.center,
                text: const TextSpan(
                  style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: AppColors.textSecondary),
                  children: [
                    TextSpan(text: "Don't have an account? "),
                    TextSpan(text: 'Create one', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.primaryBlue)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            RichText(
              textAlign: TextAlign.center,
              text: const TextSpan(
                style: TextStyle(fontFamily: 'Inter', fontSize: 11, color: AppColors.textMuted),
                children: [
                  TextSpan(text: 'By continuing you agree to our '),
                  TextSpan(text: 'Terms & Conditions', style: TextStyle(color: AppColors.primaryBlue)),
                  TextSpan(text: ' and '),
                  TextSpan(text: 'Privacy Policy', style: TextStyle(color: AppColors.primaryBlue)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GoogleG extends StatelessWidget {
  const _GoogleG();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22, height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.border),
      ),
      child: const Center(
        child: Text(
          'G',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: Color(0xFF4285F4),
          ),
        ),
      ),
    );
  }
}

// ── Bottom Nav ───────────────────────────────────────────────────────────────

class _BottomNavWithFab extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTap;

  const _BottomNavWithFab({required this.selectedIndex, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.card,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 60,
          child: Row(
            children: [
              _NavItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'HOME', index: 0, selected: selectedIndex == 0, onTap: onTap),
              _NavItem(icon: Icons.search, activeIcon: Icons.search, label: 'SEARCH', index: 1, selected: false, onTap: onTap),

              // Centre POST FAB
              Expanded(
                child: GestureDetector(
                  onTap: () => onTap(2),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 48, height: 48,
                        decoration: const BoxDecoration(
                          color: AppColors.orange,
                          shape: BoxShape.circle,
                          boxShadow: [BoxShadow(color: Color(0x33F5A623), blurRadius: 8, offset: Offset(0, 3))],
                        ),
                        child: const Icon(Icons.add, color: Colors.white, size: 26),
                      ),
                      const SizedBox(height: 2),
                      const Text('POST', style: TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.orange)),
                    ],
                  ),
                ),
              ),

              _NavItem(icon: Icons.chat_bubble_outline, activeIcon: Icons.chat_bubble, label: 'MESSAGES', index: 3, selected: selectedIndex == 1, onTap: onTap),
              _NavItem(icon: Icons.person_outline, activeIcon: Icons.person, label: 'ACCOUNT', index: 4, selected: selectedIndex == 2, onTap: onTap),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final int index;
  final bool selected;
  final ValueChanged<int> onTap;

  const _NavItem({required this.icon, required this.activeIcon, required this.label, required this.index, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: () => onTap(index),
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(selected ? activeIcon : icon, size: 22, color: selected ? AppColors.primaryBlue : AppColors.textMuted),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? AppColors.primaryBlue : AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}
