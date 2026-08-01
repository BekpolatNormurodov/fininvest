import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/token_store.dart';

/// Builds the shared [Dio] instance: base URL from config, JSON defaults, and an interceptor that
/// attaches the stored bearer token to every request (mirroring the web api-client).
Dio buildDio(TokenStore tokenStore) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      contentType: Headers.jsonContentType,
      responseType: ResponseType.json,
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await tokenStore.read();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ),
  );

  return dio;
}
