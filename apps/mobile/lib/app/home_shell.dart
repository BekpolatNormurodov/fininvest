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
import '../features/work/presentation/work_cubit.dart';
import '../features/face/data/face_service.dart';
import '../features/face/presentation/face_capture_page.dart';
import '../app/theme.dart';

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
        BlocProvider<WorkCubit>(create: (_) => WorkCubit(sl())..load()),
      ],
      child: Scaffold(
        body: Column(
          children: [
            const _OfflineBanner(),
            const _WorkBanner(),
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

/// Shift check-in / check-out bar. Green while on shift (shows start time), brand otherwise.
class _WorkBanner extends StatelessWidget {
  const _WorkBanner();

  String _time(String iso) {
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '';
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(d.hour)}:${two(d.minute)}';
  }

  /// Starting a shift is gated by a face check when a template is enrolled; ending is not.
  Future<void> _onToggle(BuildContext context, bool active) async {
    final cubit = context.read<WorkCubit>();
    if (!active && await sl<FaceService>().isEnrolled()) {
      if (!context.mounted) return;
      final ok = await Navigator.push<bool>(
        context,
        MaterialPageRoute(builder: (_) => const FaceCapturePage(mode: FaceMode.verify)),
      );
      if (ok != true) {
        if (context.mounted) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(const SnackBar(content: Text('Yuz tasdiqlanmadi — ish boshlanmadi')));
        }
        return;
      }
    }
    await cubit.toggle();
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LocaleCubit>().state;
    return BlocBuilder<WorkCubit, WorkState>(
      builder: (context, state) {
        if (state.loading) return const SizedBox.shrink();
        final active = state.active;
        final color = active ? AppTheme.success : AppTheme.brand;
        return Material(
          color: color.withValues(alpha: 0.10),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Icon(active ? Iconsax.clock : Iconsax.play_circle, size: 18, color: color),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      active
                          ? '${lang.tr('work.onShift')} • ${_time(state.startedAt ?? '')} dan'
                          : lang.tr('work.off'),
                      style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ),
                  FilledButton(
                    onPressed: state.busy ? null : () => _onToggle(context, active),
                    style: FilledButton.styleFrom(
                      backgroundColor: color,
                      minimumSize: const Size(0, 34),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    child: state.busy
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(active ? lang.tr('work.end') : lang.tr('work.start')),
                  ),
                ],
              ),
            ),
          ),
        );
      },
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
