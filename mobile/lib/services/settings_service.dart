import 'package:shared_preferences/shared_preferences.dart';

class SettingsService {
  static const _urlKey = 'piko_server_url';
  static const defaultUrl = 'https://piko-kn.vercel.app';

  Future<String> readServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_urlKey) ?? defaultUrl;
  }

  Future<void> writeServerUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_urlKey, url);
  }
}
