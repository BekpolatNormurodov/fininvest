import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

/// Background location: while a shift is running, a foreground service pushes the collector's position
/// to `/work/ping` every 15 seconds — even when the app is backgrounded or closed. Runs in its own
/// isolate, so it reads the token + server URL from storage directly (no access to the app's DI).
const _pingInterval = Duration(seconds: 15);

@pragma('vm:entry-point')
void onStart(ServiceInstance service) {
  WidgetsFlutterBinding.ensureInitialized();
  service.on('stopService').listen((_) => service.stopSelf());

  Timer.periodic(_pingInterval, (_) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString('server_base_url')?.trim();
      final baseUrl = (saved != null && saved.isNotEmpty) ? saved : AppConfig.apiBaseUrl;

      const storage = FlutterSecureStorage();
      final token = await storage.read(key: 'fininvest_token');
      if (token == null || token.isEmpty) return;

      final pos = await Geolocator.getCurrentPosition();
      final dio = Dio(BaseOptions(baseUrl: baseUrl, headers: {'Authorization': 'Bearer $token'}));
      await dio.post('/work/ping', data: {'lat': pos.latitude, 'lng': pos.longitude});
    } catch (_) {
      /* best-effort — a failed ping just skips this tick */
    }
  });
}

@pragma('vm:entry-point')
Future<bool> onIosBackground(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  return true;
}

Future<void> configureBgLocation() async {
  await FlutterBackgroundService().configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onStart,
      autoStart: false,
      isForegroundMode: true,
      autoStartOnBoot: false,
      notificationChannelId: 'fininvest_location',
      initialNotificationTitle: 'FinInvest Undiruv',
      initialNotificationContent: 'Ish vaqtida joylashuv yuborilmoqda',
      foregroundServiceNotificationId: 888,
      foregroundServiceTypes: const [AndroidForegroundType.location],
    ),
    iosConfiguration: IosConfiguration(
      autoStart: false,
      onForeground: onStart,
      onBackground: onIosBackground,
    ),
  );
}

Future<void> startBgLocation() async {
  // The OS can refuse to start a location foreground service (Android 14
  // ForegroundServiceStartNotAllowed if the permission dialog just closed and the app has not fully
  // regained focus, missing background-location grant, etc.). That must NOT crash check-in — the app
  // still pings location in the foreground; the background service is best-effort.
  try {
    final service = FlutterBackgroundService();
    if (!await service.isRunning()) await service.startService();
  } catch (_) {
    /* background pings unavailable this shift — foreground still works */
  }
}

Future<void> stopBgLocation() async {
  try {
    final service = FlutterBackgroundService();
    if (await service.isRunning()) service.invoke('stopService');
  } catch (_) {
    /* nothing to stop */
  }
}
