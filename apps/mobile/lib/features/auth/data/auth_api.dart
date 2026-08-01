import 'package:dio/dio.dart';

import 'models/auth_user.dart';

/// Raw HTTP for authentication. Repositories map errors; this only speaks to the endpoints.
class AuthApi {
  AuthApi(this._dio);

  final Dio _dio;

  Future<({String token, AuthUser user})> login(String login, String password) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'login': login, 'password': password},
    );
    final data = response.data!;
    return (
      token: data['accessToken'] as String,
      user: AuthUser.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  Future<AuthUser> me() async {
    final response = await _dio.get<Map<String, dynamic>>('/auth/me');
    return AuthUser.fromJson(response.data!);
  }
}
