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
import 'screens/help/help_screen.dart';
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
    GoRoute(
        path: '/forgot-password',
        builder: (_, __) => const ForgotPasswordScreen()),

    // Shell with bottom nav
    ShellRoute(
      builder: (context, state, child) => _MainShell(child: child),
      routes: [
        GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
        GoRoute(
            path: '/messages',
            builder: (_, __) => const ConversationsScreen()),
        // /profile in the shell now shows AccountScreen (own account hub)
        GoRoute(path: '/profile', builder: (_, __) => const AccountScreen()),
        GoRoute(path: '/help', builder: (_, __) => const HelpScreen()),
      ],
    ),

    // Standalone routes
    GoRoute(
      path: '/listing/:id',
      builder: (_, state) =>
          ListingDetailScreen(listingId: state.pathParameters['id']!),
    ),
    GoRoute(
        path: '/post-listing', builder: (_, __) => const PostListingScreen()),
    GoRoute(
      path: '/chat/:id',
      builder: (_, state) => ChatScreen(
        conversationId: state.pathParameters['id']!,
        otherUserName: state.uri.queryParameters['name'],
      ),
    ),
    // View another user's public profile
    GoRoute(
      path: '/profile/:id',
      builder: (_, state) =>
          ProfileScreen(userId: state.pathParameters['id']),
    ),
    GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
    GoRoute(path: '/verify', builder: (_, __) => const VerifyScreen()),
    GoRoute(path: '/admin', builder: (_, __) => const AdminScreen()),

    // Profile / account screens
    GoRoute(path: '/saved', builder: (_, __) => const SavedScreen()),
    GoRoute(path: '/my-listings', builder: (_, __) => const MyListingsScreen()),
    GoRoute(
        path: '/edit-profile', builder: (_, __) => const EditProfileScreen()),

    // Settings
    GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
    GoRoute(
        path: '/settings/notifications',
        builder: (_, __) => const NotificationSettingsScreen()),
    GoRoute(
        path: '/settings/privacy',
        builder: (_, __) => const PrivacySettingsScreen()),
    GoRoute(
        path: '/settings/theme',
        builder: (_, __) => const ThemeSettingsScreen()),
    GoRoute(
        path: '/settings/security',
        builder: (_, __) => const SecuritySettingsScreen()),
    GoRoute(
        path: '/settings/blocked-users',
        builder: (_, __) => const BlockedUsersScreen()),

    // Help / Legal
    GoRoute(path: '/help/faq', builder: (_, __) => const FaqScreen()),
    GoRoute(path: '/terms', builder: (_, __) => const TermsScreen()),
    GoRoute(path: '/privacy', builder: (_, __) => const PrivacyScreen()),
    GoRoute(
        path: '/community-guidelines',
        builder: (_, __) => const CommunityGuidelinesScreen()),
    GoRoute(
        path: '/help/get-verified',
        builder: (_, __) => const GetVerifiedScreen()),

    // Notifications
    GoRoute(
        path: '/notifications',
        builder: (_, __) => const NotificationsScreen()),

    // Category browse
    GoRoute(
      path: '/category/:id',
      builder: (_, state) => CategoryScreen(
        categoryId: state.pathParameters['id']!,
        categoryName: state.uri.queryParameters['name'] ??
            state.pathParameters['id']!,
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

// ── Bottom navigation shell ─────────────────────────────────────

class _MainShell extends StatelessWidget {
  final Widget child;

  const _MainShell({required this.child});

  // Matches existing app: Home, Browse, [Post FAB], Messages, Account
  static const _tabs = ['/home', '/search', '/messages', '/profile'];

  int _indexFromLocation(String loc) {
    for (int i = 0; i < _tabs.length; i++) {
      if (loc.startsWith(_tabs[i])) return i;
    }
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
            case 1:
              context.go('/search');
            case 2: // Post — gated
              if (!AuthService.isSignedIn) {
                _showLoginRequired(context, 'Log in to post an ad');
              } else {
                context.push('/post-listing');
              }
            case 3: // Messages — gated
              if (!AuthService.isSignedIn) {
                _showLoginRequired(context, 'Sign in to view messages');
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

  void _showLoginRequired(BuildContext context, String message) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_outline,
                size: 48, color: AppColors.primaryBlue),
            const SizedBox(height: 14),
            Text(
              message,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                context.push('/login');
              },
              child: const Text('Sign In'),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: () {
                Navigator.pop(context);
                context.push('/signup');
              },
              child: const Text('Create Account'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _BottomNavWithFab extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTap;

  const _BottomNavWithFab({
    required this.selectedIndex,
    required this.onTap,
  });

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
              _NavItem(
                  icon: Icons.home_outlined,
                  activeIcon: Icons.home,
                  label: 'Home',
                  index: 0,
                  selected: selectedIndex == 0,
                  onTap: onTap),
              _NavItem(
                  icon: Icons.search,
                  activeIcon: Icons.search,
                  label: 'Browse',
                  index: 1,
                  selected: selectedIndex == 1,
                  onTap: onTap),

              // Centre POST FAB
              Expanded(
                child: GestureDetector(
                  onTap: () => onTap(2),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(
                          color: AppColors.orange,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Color(0x33F5A623),
                              blurRadius: 8,
                              offset: Offset(0, 3),
                            ),
                          ],
                        ),
                        child: const Icon(Icons.add,
                            color: Colors.white, size: 26),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Post',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppColors.orange,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              _NavItem(
                  icon: Icons.chat_outlined,
                  activeIcon: Icons.chat,
                  label: 'Messages',
                  index: 3,
                  selected: selectedIndex == 2,
                  onTap: onTap),
              _NavItem(
                  icon: Icons.person_outline,
                  activeIcon: Icons.person,
                  label: 'Account',
                  index: 4,
                  selected: selectedIndex == 3,
                  onTap: onTap),
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

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.index,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: () => onTap(index),
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              selected ? activeIcon : icon,
              size: 22,
              color: selected ? AppColors.primaryBlue : AppColors.textMuted,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 10,
                fontWeight:
                    selected ? FontWeight.w700 : FontWeight.w500,
                color:
                    selected ? AppColors.primaryBlue : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
