import 'package:shared_preferences/shared_preferences.dart';

import 'app_config.dart';

/// The API origin, overridable at runtime so an installed APK can be pointed at any backend
/// (e.g. the office LAN IP) without a rebuild. Falls back to the compile-time default.
class ServerConfig {
  ServerConfig(this._prefs);

  final SharedPreferences _prefs;
  static const _key = 'server_base_url';

  String get baseUrl {
    final saved = _prefs.getString(_key)?.trim();
    return (saved != null && saved.isNotEmpty) ? saved : AppConfig.apiBaseUrl;
  }

  bool get isCustom {
    final saved = _prefs.getString(_key)?.trim();
    return saved != null && saved.isNotEmpty;
  }

  Future<void> setBaseUrl(String url) => _prefs.setString(_key, url.trim());

  Future<void> reset() => _prefs.remove(_key);
}
