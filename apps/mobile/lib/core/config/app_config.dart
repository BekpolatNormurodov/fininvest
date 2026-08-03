/// Compile-time configuration.
///
/// The API origin is injected with `--dart-define=API_URL=...`. The default targets the production
/// backend at `api.fininvest.uz`; the backend serves its routes under the `/api` prefix. Can be
/// overridden at runtime via the ⚙ server dialog (e.g. to a LAN IP for local testing).
class AppConfig {
  const AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://api.fininvest.uz/api',
  );

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 20);
}
