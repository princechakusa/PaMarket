import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../theme/app_theme.dart';

class ThemeSettingsScreen extends StatefulWidget {
  const ThemeSettingsScreen({super.key});

  @override
  State<ThemeSettingsScreen> createState() => _ThemeSettingsScreenState();
}

class _ThemeSettingsScreenState extends State<ThemeSettingsScreen> {
  String _selectedTheme = 'light';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadTheme();
  }

  Future<void> _loadTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('theme') ?? 'light';
    if (mounted) {
      setState(() {
        _selectedTheme = saved;
        _loading = false;
      });
    }
  }

  Future<void> _setTheme(String theme) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('theme', theme);
    if (mounted) {
      setState(() => _selectedTheme = theme);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Theme')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      _ThemeOption(
                        icon: Icons.light_mode_outlined,
                        title: 'Light Mode',
                        subtitle: 'Always use light theme',
                        value: 'light',
                        groupValue: _selectedTheme,
                        onChanged: _setTheme,
                      ),
                      const Divider(
                          height: 1, indent: 56, color: AppColors.border),
                      _ThemeOption(
                        icon: Icons.dark_mode_outlined,
                        title: 'Dark Mode',
                        subtitle: 'Always use dark theme',
                        value: 'dark',
                        groupValue: _selectedTheme,
                        onChanged: _setTheme,
                      ),
                      const Divider(
                          height: 1, indent: 56, color: AppColors.border),
                      _ThemeOption(
                        icon: Icons.settings_brightness_outlined,
                        title: 'System Default',
                        subtitle: 'Follow device theme setting',
                        value: 'system',
                        groupValue: _selectedTheme,
                        onChanged: _setTheme,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.orangeLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: AppColors.orange.withValues(alpha: 0.3)),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline,
                          color: AppColors.orange, size: 18),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Dark mode is under development. Selecting Dark or System Default will be saved but the app will remain in light mode until the update is released.',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 13,
                            color: AppColors.textPrimary,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

class _ThemeOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String? note;
  final String value;
  final String groupValue;
  final ValueChanged<String> onChanged;

  const _ThemeOption({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.note,
    required this.value,
    required this.groupValue,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final selected = value == groupValue;
    return ListTile(
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primaryBlue.withValues(alpha: 0.1)
              : AppColors.lightBlue,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(
          icon,
          size: 20,
          color: selected ? AppColors.primaryBlue : AppColors.textMuted,
        ),
      ),
      title: Text(
        title,
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: selected ? AppColors.primaryBlue : AppColors.textPrimary,
        ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            subtitle,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          if (note != null && value != 'light')
            Text(
              note!,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                color: AppColors.orange,
                fontWeight: FontWeight.w500,
              ),
            ),
        ],
      ),
      trailing: Radio<String>(
        value: value,
        groupValue: groupValue,
        onChanged: (v) {
          if (v != null) onChanged(v);
        },
        activeColor: AppColors.primaryBlue,
      ),
      onTap: () => onChanged(value),
    );
  }
}
