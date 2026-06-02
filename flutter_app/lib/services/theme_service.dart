import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

final themeNotifier = ValueNotifier<ThemeMode>(ThemeMode.light);

ThemeMode themeFromString(String s) {
  if (s == 'dark') return ThemeMode.dark;
  if (s == 'system') return ThemeMode.system;
  return ThemeMode.light;
}

Future<void> initTheme() async {
  final prefs = await SharedPreferences.getInstance();
  final saved = prefs.getString('theme') ?? 'light';
  themeNotifier.value = themeFromString(saved);
}
