import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the bearer token in the platform secure store. The backend issues a 7-day JWT, so a
/// stored token keeps the collector signed in for the week without re-entering the password.
class TokenStore {
  TokenStore(this._storage);

  final FlutterSecureStorage _storage;
  static const _key = 'fininvest_token';

  Future<String?> read() => _storage.read(key: _key);

  Future<void> write(String token) => _storage.write(key: _key, value: token);

  Future<void> clear() => _storage.delete(key: _key);
}
