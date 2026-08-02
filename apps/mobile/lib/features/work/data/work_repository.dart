import '../../../core/network/api_exception.dart';
import 'work_api.dart';

class WorkRepository {
  WorkRepository(this._api);

  final WorkApi _api;

  Future<WorkSession?> current() async {
    try {
      return await _api.current();
    } catch (e) {
      throw mapDioError(e);
    }
  }

  Future<WorkSession?> start({double? lat, double? lng}) async {
    try {
      return await _api.start(lat: lat, lng: lng);
    } catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> end({double? lat, double? lng}) async {
    try {
      await _api.end(lat: lat, lng: lng);
    } catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> ping({required double lat, required double lng}) async {
    try {
      await _api.ping(lat: lat, lng: lng);
    } catch (_) {
      /* pings are best-effort */
    }
  }
}
