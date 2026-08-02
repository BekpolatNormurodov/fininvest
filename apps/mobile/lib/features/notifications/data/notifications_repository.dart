import '../../../core/network/api_exception.dart';
import 'models/app_notification.dart';
import 'notifications_api.dart';

class NotificationsRepository {
  NotificationsRepository(this._api);

  final NotificationsApi _api;

  Future<List<AppNotification>> list() async {
    try {
      return await _api.list();
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _api.markRead(id);
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<void> markAll() async {
    try {
      await _api.markAll();
    } catch (error) {
      throw mapDioError(error);
    }
  }
}
