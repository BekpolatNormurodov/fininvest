import '../../../core/network/api_exception.dart';
import '../../../core/storage/token_store.dart';
import 'auth_api.dart';
import 'models/auth_user.dart';

/// Coordinates the auth API with the token store and turns transport errors into [ApiException].
class AuthRepository {
  AuthRepository(this._api, this._tokenStore);

  final AuthApi _api;
  final TokenStore _tokenStore;

  Future<AuthUser> login(String login, String password) async {
    try {
      final result = await _api.login(login, password);
      await _tokenStore.write(result.token);
      return result.user;
    } catch (error) {
      throw mapDioError(error);
    }
  }

  /// Resolves the stored session on launch: no token → null; an invalid/expired token is cleared and
  /// reported as null; a live token returns the fresh profile.
  Future<AuthUser?> currentUser() async {
    final token = await _tokenStore.read();
    if (token == null || token.isEmpty) return null;
    try {
      return await _api.me();
    } catch (error) {
      final mapped = mapDioError(error);
      if (mapped.isUnauthorized) {
        await _tokenStore.clear();
        return null;
      }
      rethrow;
    }
  }

  Future<void> logout() => _tokenStore.clear();
}
