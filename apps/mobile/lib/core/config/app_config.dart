/// Compile-time configuration.
///
/// The API origin is injected with `--dart-define=API_URL=...`. The default targets a locally
/// running backend from the Android emulator (`10.0.2.2` is the host machine as seen from the
/// emulator); the backend serves its routes under the `/api` prefix.
class AppConfig {
  const AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:3000/api',
  );

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 20);
}
