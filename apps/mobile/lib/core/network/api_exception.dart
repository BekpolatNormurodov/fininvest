import 'package:dio/dio.dart';

/// A user-facing failure, already translated to Uzbek. The presentation layer shows `.message`.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// Maps any Dio error into an [ApiException] with a friendly message — distinguishing an unreachable
/// server from real HTTP errors so the user never sees "wrong password" when the backend is down.
ApiException mapDioError(Object error) {
  if (error is ApiException) return error;
  if (error is! DioException) {
    return ApiException('Noma’lum xatolik yuz berdi.');
  }

  final response = error.response;
  if (response == null) {
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return const ApiException('Server javob bermadi (timeout). Birozdan keyin urinib ko‘ring.');
    }
    return const ApiException('Serverga ulanib bo‘lmadi. Internet aloqasi yoki server ishlamayapti.');
  }

  final status = response.statusCode;
  if (status == 401) {
    return const ApiException('Avtorizatsiya muddati tugadi. Qaytadan kiring.', statusCode: 401);
  }
  if (status == 403) {
    return const ApiException('Ruxsat yo‘q.', statusCode: 403);
  }

  final data = response.data;
  if (data is Map && data['message'] != null) {
    final message = data['message'];
    final text = message is List ? message.join(', ') : message.toString();
    return ApiException(text, statusCode: status);
  }
  if (status != null && status >= 500) {
    return ApiException('Serverda xatolik yuz berdi. Birozdan keyin urinib ko‘ring.', statusCode: status);
  }
  return ApiException('So‘rovni bajarib bo‘lmadi.', statusCode: status);
}
