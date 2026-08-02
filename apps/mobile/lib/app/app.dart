import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../core/di/injector.dart';
import '../core/i18n/locale_cubit.dart';
import '../core/i18n/strings.dart';
import '../core/push/push_service.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/auth/presentation/cubit/auth_cubit.dart';
import 'router.dart';
import 'theme.dart';

/// Root widget. Owns the [AuthCubit], [LocaleCubit] and the router for the app's lifetime.
class FinInvestApp extends StatefulWidget {
  const FinInvestApp({super.key});

  @override
  State<FinInvestApp> createState() => _FinInvestAppState();
}

class _FinInvestAppState extends State<FinInvestApp> {
  late final AuthCubit _authCubit;
  late final LocaleCubit _localeCubit;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _authCubit = AuthCubit(sl<AuthRepository>())..bootstrap();
    _localeCubit = LocaleCubit(sl());
    _router = buildRouter(_authCubit);
  }

  @override
  void dispose() {
    _authCubit.close();
    _localeCubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthCubit>.value(value: _authCubit),
        BlocProvider<LocaleCubit>.value(value: _localeCubit),
      ],
      child: BlocListener<AuthCubit, AuthState>(
        listenWhen: (prev, cur) => prev.status != cur.status && cur.status == AuthStatus.authenticated,
        listener: (_, _) => sl<PushService>().registerToken(),
        child: BlocBuilder<LocaleCubit, AppLang>(
        builder: (context, lang) {
          return MaterialApp.router(
            title: 'FinInvest Undiruv',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: ThemeMode.system,
            locale: Locale(lang == AppLang.ru ? 'ru' : 'uz'),
            routerConfig: _router,
          );
        },
        ),
      ),
    );
  }
}
