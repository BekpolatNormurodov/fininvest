import 'package:dio/dio.dart';

import 'models/app_notification.dart';

class NotificationsApi {
  NotificationsApi(this._dio);

  final Dio _dio;

  Future<List<AppNotification>> list() async {
    final response = await _dio.get<List<dynamic>>('/notifications');
    return (response.data ?? [])
        .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<int> unreadCount() async {
    final response = await _dio.get<Map<String, dynamic>>('/notifications/unread-count');
    return (response.data?['count'] as num?)?.toInt() ?? 0;
  }

  Future<void> markRead(String id) => _dio.post('/notifications/$id/read');

  Future<void> markAll() => _dio.post('/notifications/read-all');
}
