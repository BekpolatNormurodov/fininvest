import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax/iconsax.dart';

import '../core/di/injector.dart';
import '../core/network/network_info.dart';
import '../features/auth/presentation/profile_page.dart';
import '../features/collections/presentation/collections_page.dart';
import '../features/collections/presentation/cubit/collections_cubit.dart';

/// The signed-in home: bottom-nav between the undiruv list and the profile, with an offline banner
/// driven by the network checker.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<CollectionsCubit>(
      create: (_) => CollectionsCubit(sl())..load(),
      child: Scaffold(
        body: Column(
          children: [
            const _OfflineBanner(),
            Expanded(
              child: IndexedStack(
                index: _index,
                children: const [
                  CollectionsPage(),
                  ProfilePage(),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: const [
            NavigationDestination(icon: Icon(Iconsax.money_recive), label: 'Undiruvlar'),
            NavigationDestination(icon: Icon(Iconsax.user), label: 'Profil'),
          ],
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
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
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
