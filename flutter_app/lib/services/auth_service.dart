import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService {
  static final _client = Supabase.instance.client;

  static User? get currentUser => _client.auth.currentUser;
  static bool get isSignedIn => currentUser != null;
  static String? get currentUserId => currentUser?.id;

  static Stream<AuthState> get authStateStream =>
      _client.auth.onAuthStateChange;

  // ── Email/Password ─────────────────────────────────────────

  static Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String name,
    String? phone,
  }) async {
    final res = await _client.auth.signUp(
      email: email,
      password: password,
      data: {'full_name': name, 'phone': phone},
    );
    if (res.user != null) {
      await _client.from('profiles').upsert({
        'id': res.user!.id,
        'name': name,
        'email': email,
        'phone': phone,
      });
    }
    return res;
  }

  static Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) =>
      _client.auth.signInWithPassword(email: email, password: password);

  static Future<void> sendPasswordReset(String email) =>
      _client.auth.resetPasswordForEmail(email);

  // ── Google ─────────────────────────────────────────────────

  static Future<AuthResponse?> signInWithGoogle() async {
    const webClientId =
        ''; // Set your Google OAuth client ID in supabase_config

    final googleSignIn = GoogleSignIn(serverClientId: webClientId);
    final account = await googleSignIn.signIn();
    if (account == null) return null;

    final auth = await account.authentication;
    final idToken = auth.idToken;
    final accessToken = auth.accessToken;

    if (idToken == null) throw Exception('No ID token from Google');

    final res = await _client.auth.signInWithIdToken(
      provider: OAuthProvider.google,
      idToken: idToken,
      accessToken: accessToken,
    );

    if (res.user != null) {
      await _client.from('profiles').upsert({
        'id': res.user!.id,
        'name': account.displayName ?? 'User',
        'email': account.email,
        'avatar': account.photoUrl,
      }, onConflict: 'id');
    }

    return res;
  }

  // ── Apple ──────────────────────────────────────────────────

  static Future<AuthResponse?> signInWithApple() async {
    final rawNonce = _client.auth.generateRawNonce();
    final nonce = sha256.convert(utf8.encode(rawNonce)).toString();

    final cred = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
      nonce: nonce,
    );

    final idToken = cred.identityToken;
    if (idToken == null) throw Exception('No identity token from Apple');

    final res = await _client.auth.signInWithIdToken(
      provider: OAuthProvider.apple,
      idToken: idToken,
      nonce: rawNonce,
    );

    if (res.user != null) {
      final name =
          [cred.givenName, cred.familyName].where((s) => s != null).join(' ');
      if (name.isNotEmpty) {
        await _client.from('profiles').upsert(
          {'id': res.user!.id, 'name': name, 'email': cred.email},
          onConflict: 'id',
        );
      }
    }

    return res;
  }

  // ── Sign out ───────────────────────────────────────────────

  static Future<void> signOut() async {
    await GoogleSignIn().signOut().catchError((_) => null);
    await _client.auth.signOut();
  }

  // ── Profile helpers ────────────────────────────────────────

  static Future<Map<String, dynamic>?> fetchProfile(String uid) async {
    final res = await _client
        .from('profiles')
        .select()
        .eq('id', uid)
        .maybeSingle();
    return res;
  }

  static Future<void> updateProfile(Map<String, dynamic> data) async {
    final uid = currentUserId;
    if (uid == null) return;
    await _client.from('profiles').update(data).eq('id', uid);
  }
}
