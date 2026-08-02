import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../../features/notifications/data/notifications_api.dart';

/// Firebase Cloud Messaging: initialize, register the device token with the backend after login, and
/// surface foreground messages. Everything is best-effort — a device without Google Play services or
/// a missing config never crashes the app.
class PushService {
  PushService(this._notificationsApi);

  final NotificationsApi _notificationsApi;
  bool _ready = false;

  /// Called once at startup. Safe to call even if Firebase isn't configured.
  Future<void> init({VoidCallback? onForegroundMessage}) async {
    try {
      await Firebase.initializeApp();
      await FirebaseMessaging.instance.requestPermission();
      FirebaseMessaging.onMessage.listen((_) => onForegroundMessage?.call());
      FirebaseMessaging.instance.onTokenRefresh.listen(_send);
      _ready = true;
    } catch (_) {
      _ready = false;
    }
  }

  /// Register the current FCM token with the backend (after the user is authenticated).
  Future<void> registerToken() async {
    if (!_ready) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _send(token);
    } catch (_) {
      /* best-effort */
    }
  }

  Future<void> _send(String token) async {
    try {
      await _notificationsApi.registerDeviceToken(token, Platform.isIOS ? 'ios' : 'android');
    } catch (_) {
      /* best-effort */
    }
  }
}
