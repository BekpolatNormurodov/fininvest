import 'package:connectivity_plus/connectivity_plus.dart';

/// Thin wrapper over `connectivity_plus` — the app's single source of "is there a connection".
class NetworkInfo {
  NetworkInfo(this._connectivity);

  final Connectivity _connectivity;

  Future<bool> get isConnected async {
    final result = await _connectivity.checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }

  Stream<bool> get onStatusChange =>
      _connectivity.onConnectivityChanged.map((result) => !result.contains(ConnectivityResult.none));
}
