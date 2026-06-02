import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config/supabase_config.dart';
import 'services/auth_service.dart';
import 'theme/app_theme.dart';
import 'widgets/auth_modal.dart';

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
import 'screens/profile/advertise_screen.dart';
import 'screens/profile/my_activity_screen.dart';
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
import 'screens/jobs/jobs_screen.dart';
import 'screens/jobs/find_jobs_screen.dart';
import 'screens/jobs/job_detail_screen.dart';
import 'screens/jobs/job_seeker_profile_screen.dart';
import 'screens/jobs/applied_jobs_screen.dart';

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

    ShellRoute(
      builder: (context, state, child) => _MainShell(child: child),
      routes: [
        GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
        GoRoute(path: '/messages', builder: (_, __) => const ConversationsScreen()),
        GoRoute(path: '/profile', builder: (_, __) => const AccountScreen()),
      ],
    ),

    GoRoute(path: '/listing/:id', builder: (_, state) => ListingDetailScreen(listingId: state.pathParameters['id']!)),
    GoRoute(path: '/post-listing', builder: (_, __) => const PostListingScreen()),
    GoRoute(
      path: '/chat/:id',
      builder: (_, state) => ChatScreen(
        conversationId: state.pathParameters['id']!,
        otherUserName: state.uri.queryParameters['name'],
      ),
    ),
    GoRoute(path: '/profile/:id', builder: (_, state) => ProfileScreen(userId: state.pathParameters['id'])),
    GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
    GoRoute(path: '/verify', builder: (_, __) => const VerifyScreen()),
    GoRoute(path: '/admin', builder: (_, __) => const AdminScreen()),

    GoRoute(path: '/saved', builder: (_, __) => const SavedScreen()),
    GoRoute(path: '/my-listings', builder: (_, __) => const MyListingsScreen()),
    GoRoute(path: '/edit-profile', builder: (_, __) => const EditProfileScreen()),
    GoRoute(path: '/advertise', builder: (_, __) => const AdvertiseScreen()),
    GoRoute(path: '/my-activity', builder: (_, __) => const MyActivityScreen()),

    // ── Jobs section ──────────────────────────────────────────────────────
    GoRoute(path: '/jobs', builder: (_, __) => const JobsScreen()),
    GoRoute(
      path: '/find-jobs',
      builder: (_, state) => FindJobsScreen(
        initialQuery: state.uri.queryParameters['q'],
        initialCategory: state.uri.queryParameters['cat'],
      ),
    ),
    GoRoute(path: '/job/:id', builder: (_, state) => JobDetailScreen(jobId: state.pathParameters['id']!)),
    GoRoute(path: '/job-profile', builder: (_, __) => const JobSeekerProfileScreen()),
    GoRoute(path: '/applied-jobs', builder: (_, __) => const AppliedJobsScreen()),

    GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
    GoRoute(path: '/settings/notifications', builder: (_, __) => const NotificationSettingsScreen()),
    GoRoute(path: '/settings/privacy', builder: (_, __) => const PrivacySettingsScreen()),
    GoRoute(path: '/settings/theme', builder: (_, __) => const ThemeSettingsScreen()),
    GoRoute(path: '/settings/security', builder: (_, __) => const SecuritySettingsScreen()),
    GoRoute(path: '/settings/blocked-users', builder: (_, __) => const BlockedUsersScreen()),

    GoRoute(path: '/help/faq', builder: (_, __) => const FaqScreen()),
    GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),

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
            case 1:
              context.push('/search');
            case 2:
              if (!AuthService.isSignedIn) {
                showAuthModal(context, 'Log in to post an ad');
              } else {
                context.push('/post-listing');
              }
            case 3:
              if (!AuthService.isSignedIn) {
                showAuthModal(context, 'Sign in to view messages');
              } else {
                context.go('/messages');
              }
            case 4:
              context.go('/profile');
          }
        },
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
          height: 68,
          child: Row(
            children: [
              _NavItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'HOME', index: 0, selected: selectedIndex == 0, onTap: onTap),
              _NavItem(icon: Icons.search, activeIcon: Icons.search, label: 'SEARCH', index: 1, selected: false, onTap: onTap),
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
            Icon(selected ? activeIcon : icon, size: 22, color: selected ? AppColors.primaryBlue : AppColors.textMuted),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 10,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? AppColors.primaryBlue : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
