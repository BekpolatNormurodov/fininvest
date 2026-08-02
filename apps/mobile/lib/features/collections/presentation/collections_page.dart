import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'package:iconsax/iconsax.dart';

import '../../../core/widgets/state_views.dart';
import '../../auth/presentation/cubit/auth_cubit.dart';
import '../../chat/data/chat_repository.dart';
import '../../chat/presentation/chat_page.dart';
import 'cubit/collections_cubit.dart';
import '../data/models/collection_list_item.dart';
import 'widgets/collection_card.dart';

class CollectionsPage extends StatelessWidget {
  const CollectionsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final userId = context.select((AuthCubit c) => c.state.user?.id) ?? '';

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Undiruvlar'),
          actions: [
            IconButton(
              tooltip: 'Umumiy chat',
              icon: const Icon(Iconsax.messages_2),
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ChatPage(channel: ChatChannel.general('Umumiy chat'))),
              ),
            ),
          ],
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Umumiy (filial)'),
              Tab(text: 'Menga biriktirilgan'),
            ],
          ),
        ),
        body: BlocBuilder<CollectionsCubit, CollectionsState>(
          builder: (context, state) {
            if (state.status == CollectionsStatus.loading || state.status == CollectionsStatus.initial) {
              return const LoadingView();
            }
            if (state.status == CollectionsStatus.error) {
              return ErrorView(
                message: state.error ?? 'Xatolik',
                onRetry: () => context.read<CollectionsCubit>().load(),
              );
            }
            return TabBarView(
              children: [
                _CollectionList(items: state.items),
                _CollectionList(items: state.assignedTo(userId)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _CollectionList extends StatelessWidget {
  const _CollectionList({required this.items});

  final List<CollectionListItem> items;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () => context.read<CollectionsCubit>().load(),
      child: items.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                EmptyView(message: 'Undiruv yo‘q'),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                return CollectionCard(
                  item: item,
                  onTap: () => context.push('/collections/${item.id}'),
                );
              },
            ),
    );
  }
}
