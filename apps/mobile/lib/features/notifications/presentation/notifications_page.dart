import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax/iconsax.dart';

import '../../../app/theme.dart';
import '../../../core/format.dart';
import '../../../core/i18n/locale_cubit.dart';
import '../../../core/widgets/state_views.dart';
import 'cubit/notifications_cubit.dart';

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LocaleCubit>().state;
    return Scaffold(
      appBar: AppBar(
        title: Text(lang.tr('nav.notifications')),
        actions: [
          IconButton(
            tooltip: lang.tr('notif.readAll'),
            icon: const Icon(Iconsax.tick_circle, size: 20),
            onPressed: () => context.read<NotificationsCubit>().markAll(),
          ),
        ],
      ),
      body: BlocBuilder<NotificationsCubit, NotificationsState>(
        builder: (context, state) {
          if (state.status == NotificationsStatus.loading || state.status == NotificationsStatus.initial) {
            return const LoadingView();
          }
          if (state.status == NotificationsStatus.error) {
            return ErrorView(message: state.error ?? 'Xatolik', onRetry: () => context.read<NotificationsCubit>().load());
          }
          return RefreshIndicator(
            onRefresh: () => context.read<NotificationsCubit>().load(),
            child: state.items.isEmpty
                ? ListView(children: [const SizedBox(height: 120), EmptyView(message: lang.tr('notif.empty'), icon: Iconsax.notification)])
                : ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: state.items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final n = state.items[index];
                      return Card(
                        child: ListTile(
                          onTap: () => context.read<NotificationsCubit>().markRead(n.id),
                          leading: CircleAvatar(
                            backgroundColor: (n.read ? Colors.grey : AppTheme.brand).withValues(alpha: 0.12),
                            child: Icon(Iconsax.notification, size: 18, color: n.read ? Colors.grey : AppTheme.brand),
                          ),
                          title: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w500 : FontWeight.w700)),
                          subtitle: n.body != null ? Text(n.body!) : null,
                          trailing: Text(
                            formatDate(n.createdAt),
                            style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.outline),
                          ),
                        ),
                      );
                    },
                  ),
          );
        },
      ),
    );
  }
}
