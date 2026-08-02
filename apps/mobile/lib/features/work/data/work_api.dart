import 'package:dio/dio.dart';

/// A work shift as the app needs it: is one open, and since when.
class WorkSession {
  const WorkSession({required this.id, required this.startedAt, required this.endedAt});

  final String id;
  final String startedAt;
  final String? endedAt;

  bool get active => endedAt == null;

  static WorkSession? fromJsonOrNull(dynamic json) {
    if (json is! Map<String, dynamic>) return null;
    return WorkSession(
      id: json['id'] as String,
      startedAt: json['startedAt'] as String? ?? '',
      endedAt: json['endedAt'] as String?,
    );
  }
}

class WorkApi {
  WorkApi(this._dio);

  final Dio _dio;

  Future<WorkSession?> current() async {
    final r = await _dio.get('/work/current');
    return WorkSession.fromJsonOrNull(r.data);
  }

  Future<WorkSession?> start({double? lat, double? lng}) async {
    final r = await _dio.post('/work/start', data: {'lat': lat, 'lng': lng});
    return WorkSession.fromJsonOrNull(r.data);
  }

  Future<void> end({double? lat, double? lng}) async {
    await _dio.post('/work/end', data: {'lat': lat, 'lng': lng});
  }

  Future<void> ping({required double lat, required double lng}) async {
    await _dio.post('/work/ping', data: {'lat': lat, 'lng': lng});
  }
}
