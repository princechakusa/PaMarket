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
import 'screens/chat/conversations_screen.dart';
import 'screens/chat/chat_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/search/search_screen.dart';
import 'screens/verify/verify_screen.dart';
import 'screens/admin/admin_screen.dart';
import 'screens/help/help_screen.dart';

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
        GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
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
    GoRoute(
      path: '/profile/:id',
      builder: (_, state) =>
          ProfileScreen(userId: state.pathParameters['id']),
    ),
    GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
    GoRoute(path: '/verify', builder: (_, __) => const VerifyScreen()),
    GoRoute(path: '/admin', builder: (_, __) => const AdminScreen()),

    // Help / Legal
    GoRoute(path: '/terms', builder: (_, __) => const TermsScreen()),
    GoRoute(path: '/privacy', builder: (_, __) => const PrivacyScreen()),
    GoRoute(
        path: '/community-guidelines',
        builder: (_, __) => const CommunityGuidelinesScreen()),
    GoRoute(
        path: '/help/get-verified',
        builder: (_, __) => const GetVerifiedScreen()),
    GoRoute(
        path: '/notifications',
        builder: (_, __) => const _NotificationsScreen()),
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

  static const _tabs = ['/home', '/messages', '/profile', '/help'];

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
      bottomNavigationBar: NavigationBar(
        selectedIndex: idx,
        backgroundColor: AppColors.card,
        indicatorColor: AppColors.lightBlue,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        onDestinationSelected: (i) {
          switch (i) {
            case 0:
              context.go('/home');
            case 1:
              context.go('/messages');
            case 2:
              AuthService.isSignedIn
                  ? context.go('/profile')
                  : context.push('/login');
            case 3:
              context.go('/help');
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: AppColors.primaryBlue),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_outlined),
            selectedIcon: Icon(Icons.chat, color: AppColors.primaryBlue),
            label: 'Messages',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: AppColors.primaryBlue),
            label: 'Profile',
          ),
          NavigationDestination(
            icon: Icon(Icons.help_outline),
            selectedIcon: Icon(Icons.help, color: AppColors.primaryBlue),
            label: 'Help',
          ),
        ],
      ),
    );
  }
}

class _NotificationsScreen extends StatelessWidget {
  const _NotificationsScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.notifications_none, size: 72, color: AppColors.border),
            SizedBox(height: 16),
            Text('No notifications yet',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 18,
                    fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
