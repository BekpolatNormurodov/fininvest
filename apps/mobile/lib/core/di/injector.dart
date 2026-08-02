import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/server_config.dart';
import '../network/dio_client.dart';
import '../network/network_info.dart';
import '../storage/token_store.dart';
import '../../features/auth/data/auth_api.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../features/collections/data/collections_api.dart';
import '../../features/collections/data/collections_repository.dart';
import '../../features/notifications/data/notifications_api.dart';
import '../../features/notifications/data/notifications_repository.dart';
import '../../features/work/data/work_api.dart';
import '../../features/work/data/work_repository.dart';
import '../../features/face/data/face_embedder.dart';
import '../../features/face/data/face_matcher.dart';
import '../../features/face/data/face_store.dart';
import '../../features/face/data/face_capture_service.dart';
import '../../features/face/data/face_service.dart';
import '../../features/chat/data/chat_api.dart';
import '../../features/chat/data/chat_repository.dart';
import '../push/push_service.dart';

/// Service locator. Composition happens once at startup in [configureDependencies].
final GetIt sl = GetIt.instance;

Future<void> configureDependencies() async {
  // Preferences + runtime server config.
  final prefs = await SharedPreferences.getInstance();
  sl.registerSingleton<SharedPreferences>(prefs);
  sl.registerLazySingleton<ServerConfig>(() => ServerConfig(sl<SharedPreferences>()));

  // Infrastructure.
  sl.registerLazySingleton<FlutterSecureStorage>(() => const FlutterSecureStorage());
  sl.registerLazySingleton<TokenStore>(() => TokenStore(sl<FlutterSecureStorage>()));
  sl.registerLazySingleton<Dio>(() => buildDio(sl<TokenStore>(), sl<ServerConfig>().baseUrl));
  sl.registerLazySingleton<Connectivity>(() => Connectivity());
  sl.registerLazySingleton<NetworkInfo>(() => NetworkInfo(sl<Connectivity>()));

  // Auth feature.
  sl.registerLazySingleton<AuthApi>(() => AuthApi(sl<Dio>()));
  sl.registerLazySingleton<AuthRepository>(() => AuthRepository(sl<AuthApi>(), sl<TokenStore>()));

  // Collections feature.
  sl.registerLazySingleton<CollectionsApi>(() => CollectionsApi(sl<Dio>()));
  sl.registerLazySingleton<CollectionsRepository>(() => CollectionsRepository(sl<CollectionsApi>()));

  // Notifications feature.
  sl.registerLazySingleton<NotificationsApi>(() => NotificationsApi(sl<Dio>()));
  sl.registerLazySingleton<NotificationsRepository>(() => NotificationsRepository(sl<NotificationsApi>()));

  // Work shifts feature.
  sl.registerLazySingleton<WorkApi>(() => WorkApi(sl<Dio>()));
  sl.registerLazySingleton<WorkRepository>(() => WorkRepository(sl<WorkApi>()));

  // Face check-in feature (on-device; ported from the government worker app).
  sl.registerLazySingleton<FaceEmbedder>(() => FaceEmbedder());
  sl.registerLazySingleton<FaceMatcher>(() => FaceMatcher());
  sl.registerLazySingleton<FaceStore>(() => FaceStore(sl<FlutterSecureStorage>()));
  sl.registerLazySingleton<FaceCaptureService>(() => FaceCaptureService(sl<FaceEmbedder>()));
  sl.registerLazySingleton<FaceService>(() => FaceService(sl<FaceCaptureService>(), sl<FaceStore>(), sl<FaceMatcher>()));

  // Chat feature (reuses the web messages endpoints).
  sl.registerLazySingleton<ChatApi>(() => ChatApi(sl<Dio>()));
  sl.registerLazySingleton<ChatRepository>(() => ChatRepository(sl<ChatApi>()));

  // Push notifications (FCM).
  sl.registerLazySingleton<PushService>(() => PushService(sl<NotificationsApi>()));
}

/// Apply a new API base URL at runtime (from the login-screen server dialog).
void applyServerBaseUrl(String url) {
  sl<Dio>().options.baseUrl = url;
}
