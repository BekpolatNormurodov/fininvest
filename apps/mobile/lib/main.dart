import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/app.dart';
import 'core/di/injector.dart';
import 'core/push/push_service.dart';

/// Persist the last uncaught error so the next launch can show it — the only way to see a crash
/// on a device we can't attach a debugger to. (Native crashes still bypass this; those need logcat.)
Future<void> recordError(Object error, StackTrace? stack) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('last_error', '$error\n\n$stack');
  } catch (_) {/* nothing else we can do */}
}

Future<void> main() async {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    // Show a readable red screen instead of the grey "something went wrong" on a build error,
    // and record every framework error.
    FlutterError.onError = (details) {
      recordError(details.exception, details.stack);
      FlutterError.presentError(details);
    };
    ErrorWidget.builder = (details) => Material(
          color: const Color(0xFF7F1D1D),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: SingleChildScrollView(
                child: Text(
                  'XATO:\n\n${details.exception}',
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ),
          ),
        );

    try {
      await configureDependencies();
    } catch (e, s) {
      recordError(e, s);
    }
    try {
      await sl<PushService>().init();
    } catch (e, s) {
      recordError(e, s);
    }
    // NOTE: the background-location foreground service is intentionally DISABLED for now to isolate
    // the "app closes after granting location" crash. Foreground pings still work while the app is
    // open. Re-enable once the crash is confirmed gone / the real cause is captured.
    // await configureBgLocation();

    runApp(const FinInvestApp());
  }, (error, stack) => recordError(error, stack));
}
