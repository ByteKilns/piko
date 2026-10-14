import 'package:flutter/material.dart' show ThemeMode;
import 'package:shared_preferences/shared_preferences.dart';

import 'bs_calendar.dart';

class SettingsService {
  static const _urlKey = 'piko_server_url';
  static const _dateFormatKey = 'piko_date_format';
  static const _themeModeKey = 'piko_theme_mode';
  static const defaultUrl = 'https://piko-kn.vercel.app';

  Future<String> readServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_urlKey) ?? defaultUrl;
  }

  Future<void> writeServerUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_urlKey, url);
  }

  // Stored on this phone only — the website's date format is a household-wide
  // setting, so changing it from one phone would change it for everyone.
  Future<AppDateFormat> readDateFormat() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_dateFormatKey) == AppDateFormat.english.name ? AppDateFormat.english : AppDateFormat.nepali;
  }

  Future<void> writeDateFormat(AppDateFormat format) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_dateFormatKey, format.name);
  }

  // Light until someone picks otherwise, as on the website.
  Future<ThemeMode> readThemeMode() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_themeModeKey);
    return ThemeMode.values.firstWhere((mode) => mode.name == stored, orElse: () => ThemeMode.light);
  }

  Future<void> writeThemeMode(ThemeMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeModeKey, mode.name);
  }
}
