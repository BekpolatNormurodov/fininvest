import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax/iconsax.dart';

import '../core/di/injector.dart';
import '../core/i18n/locale_cubit.dart';
import '../core/network/network_info.dart';
import '../features/auth/presentation/profile_page.dart';
import '../features/collections/presentation/collections_page.dart';
import '../features/collections/presentation/stats_page.dart';
import '../features/collections/presentation/cubit/collections_cubit.dart';
import '../features/notifications/presentation/notifications_page.dart';
import '../features/notifications/presentation/cubit/notifications_cubit.dart';

/// The signed-in home: bottom-nav across undiruv list, statistics, notifications and profile, with
/// an offline banner driven by the network checker.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LocaleCubit>().state;
    return MultiBlocProvider(
      providers: [
        BlocProvider<CollectionsCubit>(create: (_) => CollectionsCubit(sl())..load()),
        BlocProvider<NotificationsCubit>(create: (_) => NotificationsCubit(sl())..load()),
      ],
      child: Scaffold(
        body: Column(
          children: [
            const _OfflineBanner(),
            Expanded(
              child: IndexedStack(
                index: _index,
                children: const [
                  CollectionsPage(),
                  StatsPage(),
                  NotificationsPage(),
                  ProfilePage(),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: BlocBuilder<NotificationsCubit, NotificationsState>(
          builder: (context, notif) {
            return NavigationBar(
              selectedIndex: _index,
              onDestinationSelected: (i) => setState(() => _index = i),
              destinations: [
                NavigationDestination(icon: const Icon(Iconsax.money_recive), label: lang.tr('nav.collections')),
                NavigationDestination(icon: const Icon(Iconsax.chart_2), label: lang.tr('nav.stats')),
                NavigationDestination(
                  icon: Badge(
                    isLabelVisible: notif.unread > 0,
                    label: Text('${notif.unread}'),
                    child: const Icon(Iconsax.notification),
                  ),
                  label: lang.tr('nav.notifications'),
                ),
                NavigationDestination(icon: const Icon(Iconsax.user), label: lang.tr('nav.profile')),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// A thin red bar shown while there is no connection.
class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<bool>(
      stream: sl<NetworkInfo>().onStatusChange,
      builder: (context, snapshot) {
        final online = snapshot.data ?? true;
        if (online) return const SizedBox.shrink();
        return Material(
          color: Theme.of(context).colorScheme.error,
          child: SafeArea(
            bottom: false,
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Iconsax.wifi_square, size: 16, color: Colors.white),
                  SizedBox(width: 6),
                  Text('Internet aloqasi yo‘q', style: TextStyle(color: Colors.white, fontSize: 13)),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
