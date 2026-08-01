import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../core/di/injector.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/auth/presentation/cubit/auth_cubit.dart';
import 'router.dart';
import 'theme.dart';

/// Root widget. Owns the [AuthCubit] and the router for the app's lifetime, so neither is rebuilt.
class FinInvestApp extends StatefulWidget {
  const FinInvestApp({super.key});

  @override
  State<FinInvestApp> createState() => _FinInvestAppState();
}

class _FinInvestAppState extends State<FinInvestApp> {
  late final AuthCubit _authCubit;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _authCubit = AuthCubit(sl<AuthRepository>())..bootstrap();
    _router = buildRouter(_authCubit);
  }

  @override
  void dispose() {
    _authCubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AuthCubit>.value(
      value: _authCubit,
      child: MaterialApp.router(
        title: 'FinInvest Undiruv',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.system,
        routerConfig: _router,
      ),
    );
  }
}
