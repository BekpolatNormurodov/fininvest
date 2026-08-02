import 'package:flutter/material.dart';

import 'app/app.dart';
import 'core/di/injector.dart';
import 'core/location/bg_location.dart';
import 'core/push/push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await configureDependencies();
  await sl<PushService>().init();
  await configureBgLocation();
  runApp(const FinInvestApp());
}
