import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';

import '../network/dio_client.dart';
import '../network/network_info.dart';
import '../storage/token_store.dart';
import '../../features/auth/data/auth_api.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../features/collections/data/collections_api.dart';
import '../../features/collections/data/collections_repository.dart';

/// Service locator. Composition happens once at startup in [configureDependencies].
final GetIt sl = GetIt.instance;

Future<void> configureDependencies() async {
  // Infrastructure.
  sl.registerLazySingleton<FlutterSecureStorage>(() => const FlutterSecureStorage());
  sl.registerLazySingleton<TokenStore>(() => TokenStore(sl<FlutterSecureStorage>()));
  sl.registerLazySingleton<Dio>(() => buildDio(sl<TokenStore>()));
  sl.registerLazySingleton<Connectivity>(() => Connectivity());
  sl.registerLazySingleton<NetworkInfo>(() => NetworkInfo(sl<Connectivity>()));

  // Auth feature.
  sl.registerLazySingleton<AuthApi>(() => AuthApi(sl<Dio>()));
  sl.registerLazySingleton<AuthRepository>(() => AuthRepository(sl<AuthApi>(), sl<TokenStore>()));

  // Collections feature.
  sl.registerLazySingleton<CollectionsApi>(() => CollectionsApi(sl<Dio>()));
  sl.registerLazySingleton<CollectionsRepository>(() => CollectionsRepository(sl<CollectionsApi>()));
}
