import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/presentation/cubit/auth_cubit.dart';
import '../features/auth/presentation/login_page.dart';
import '../features/auth/presentation/splash_page.dart';
import '../features/collections/presentation/collection_detail_page.dart';
import 'home_shell.dart';

/// Builds the app router. Redirects follow the auth status; the splash is shown only while the
/// stored session is being resolved.
GoRouter buildRouter(AuthCubit authCubit) {
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: _GoRouterRefreshStream(authCubit.stream),
    redirect: (context, state) {
      final status = authCubit.state.status;
      final location = state.matchedLocation;

      if (status == AuthStatus.unknown) {
        return location == '/splash' ? null : '/splash';
      }
      if (status == AuthStatus.unauthenticated) {
        return location == '/login' ? null : '/login';
      }
      // Authenticated: bounce away from the pre-auth screens.
      if (location == '/login' || location == '/splash') return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashPage()),
      GoRoute(path: '/login', builder: (_, _) => const LoginPage()),
      GoRoute(path: '/home', builder: (_, _) => const HomeShell()),
      GoRoute(
        path: '/collections/:id',
        builder: (_, state) => CollectionDetailPage(id: state.pathParameters['id']!),
      ),
    ],
  );
}

/// Bridges a [Stream] (the cubit's) to a [Listenable] so GoRouter re-evaluates redirects on change.
class _GoRouterRefreshStream extends ChangeNotifier {
  _GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
