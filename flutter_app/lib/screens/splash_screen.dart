import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late AnimationController _logoController;
  late AnimationController _taglineController;
  late AnimationController _shadowController;
  late AnimationController _dotsController;

  late Animation<double> _logoScale;
  late Animation<double> _logoOpacity;
  late Animation<double> _taglineOpacity;
  late Animation<double> _shadowOpacity;
  late Animation<double> _dotsOpacity;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ));
    _setupAnimations();
    _startSequence();
  }

  void _setupAnimations() {
    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _taglineController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _shadowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _dotsController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _logoScale = Tween<double>(begin: 0.7, end: 1.0).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.easeOutBack),
    );
    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.easeIn),
    );
    _taglineOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _taglineController, curve: Curves.easeIn),
    );
    _shadowOpacity = Tween<double>(begin: 0.0, end: 0.18).animate(
      CurvedAnimation(parent: _shadowController, curve: Curves.easeIn),
    );
    _dotsOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _dotsController, curve: Curves.easeIn),
    );
  }

  Future<void> _startSequence() async {
    await Future.delayed(const Duration(milliseconds: 200));
    _logoController.forward();
    await Future.delayed(const Duration(milliseconds: 500));
    _taglineController.forward();
    await Future.delayed(const Duration(milliseconds: 300));
    _shadowController.forward();
    await Future.delayed(const Duration(milliseconds: 300));
    _dotsController.forward();

    // Always go to home — login is only required for gated actions
    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;
    context.go('/home');
  }

  @override
  void dispose() {
    _logoController.dispose();
    _taglineController.dispose();
    _shadowController.dispose();
    _dotsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.darkBlue,
              AppColors.primaryBlue,
              Color(0xFF1E4FC0),
            ],
            stops: [0.0, 0.55, 1.0],
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              // Background shadow words (tenga, tengesa, Qhatsha)
              AnimatedBuilder(
                animation: _shadowOpacity,
                builder: (_, __) => Opacity(
                  opacity: _shadowOpacity.value,
                  child: const _ShadowWords(),
                ),
              ),

              // Main content
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Logo wordmark
                    AnimatedBuilder(
                      animation: _logoController,
                      builder: (_, __) => Transform.scale(
                        scale: _logoScale.value,
                        child: Opacity(
                          opacity: _logoOpacity.value,
                          child: const _LogoWordmark(),
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Tagline
                    AnimatedBuilder(
                      animation: _taglineOpacity,
                      builder: (_, __) => Opacity(
                        opacity: _taglineOpacity.value,
                        child: const Text(
                          'Konke Endaweni Eyodwa',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: Colors.white70,
                            letterSpacing: 0.4,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 60),

                    // Three animated dots
                    AnimatedBuilder(
                      animation: _dotsOpacity,
                      builder: (_, __) => Opacity(
                        opacity: _dotsOpacity.value,
                        child: const _LoadingDots(),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LogoWordmark extends StatelessWidget {
  const _LogoWordmark();

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: const TextSpan(
        children: [
          TextSpan(
            text: 'Pa',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 52,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -1.5,
            ),
          ),
          TextSpan(
            text: 'Market',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 52,
              fontWeight: FontWeight.w800,
              color: AppColors.orange,
              letterSpacing: -1.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _ShadowWords extends StatelessWidget {
  const _ShadowWords();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: SizedBox.expand(
        child: Stack(
          children: [
            Positioned(
              top: 80,
              left: -20,
              child: _shadowWord('tenga', 72),
            ),
            Positioned(
              top: 200,
              right: -30,
              child: _shadowWord('tengesa', 64),
            ),
            Positioned(
              bottom: 160,
              left: 10,
              child: _shadowWord('Qhatsha', 68),
            ),
            Positioned(
              bottom: 80,
              right: 20,
              child: _shadowWord('renta', 56),
            ),
          ],
        ),
      ),
    );
  }

  Widget _shadowWord(String word, double size) => Text(
        word,
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: size,
          fontWeight: FontWeight.w800,
          color: Colors.white.withValues(alpha: 0.06),
          letterSpacing: -2,
        ),
      );
}

class _LoadingDots extends StatefulWidget {
  const _LoadingDots();

  @override
  State<_LoadingDots> createState() => _LoadingDotsState();
}

class _LoadingDotsState extends State<_LoadingDots>
    with TickerProviderStateMixin {
  final List<AnimationController> _controllers = [];

  @override
  void initState() {
    super.initState();
    for (int i = 0; i < 3; i++) {
      final c = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 500),
      );
      _controllers.add(c);
      Future.delayed(Duration(milliseconds: i * 160), () {
        if (mounted) c.repeat(reverse: true);
      });
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) { c.dispose(); }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (i) {
        return AnimatedBuilder(
          animation: _controllers[i],
          builder: (_, __) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 5),
            child: Transform.translate(
              offset: Offset(0, -6 * _controllers[i].value),
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: AppColors.orange
                      .withValues(alpha: 0.5 + 0.5 * _controllers[i].value),
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
        );
      }),
    );
  }
}
