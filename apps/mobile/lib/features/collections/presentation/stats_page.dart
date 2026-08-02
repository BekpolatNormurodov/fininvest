import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax/iconsax.dart';

import '../../../app/theme.dart';
import '../../../core/di/injector.dart';
import '../../../core/format.dart';
import '../../../core/i18n/locale_cubit.dart';
import '../../../core/widgets/state_views.dart';
import '../data/collections_repository.dart';
import '../data/models/collection_stats.dart';
import '../data/models/collection_status.dart';

class StatsPage extends StatefulWidget {
  const StatsPage({super.key});

  @override
  State<StatsPage> createState() => _StatsPageState();
}

class _StatsPageState extends State<StatsPage> {
  late Future<CollectionStats> _future;

  @override
  void initState() {
    super.initState();
    _future = sl<CollectionsRepository>().stats();
  }

  void _reload() => setState(() => _future = sl<CollectionsRepository>().stats());

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LocaleCubit>().state;
    return Scaffold(
      appBar: AppBar(title: Text(lang.tr('stats.title'))),
      body: FutureBuilder<CollectionStats>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const LoadingView();
          if (snapshot.hasError) return ErrorView(message: '${snapshot.error}', onRetry: _reload);
          final s = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    _Tile(label: lang.tr('field.debt'), value: formatMoney(s.totalDebt), color: AppTheme.danger, icon: Iconsax.money_send),
                    const SizedBox(width: 12),
                    _Tile(label: lang.tr('field.collected'), value: formatMoney(s.totalCollected), color: AppTheme.success, icon: Iconsax.money_recive),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _Tile(label: lang.tr('field.remaining'), value: formatMoney(s.remaining), color: AppTheme.warning, icon: Iconsax.wallet_minus),
                    const SizedBox(width: 12),
                    _Tile(label: lang.tr('stats.active'), value: '${s.activeCount}', color: AppTheme.brand, icon: Iconsax.task_square),
                  ],
                ),
                const SizedBox(height: 16),
                _ProgressCard(pct: s.collectedPct),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(lang.tr('stats.byStatus'), style: const TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 10),
                        if (s.byStatus.isEmpty)
                          Text('—', style: TextStyle(color: Theme.of(context).colorScheme.outline))
                        else
                          ...s.byStatus.map(
                            (slice) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 5),
                              child: Row(
                                children: [
                                  Container(
                                    width: 10, height: 10,
                                    decoration: BoxDecoration(color: CollectionStatusInfo.color(slice.key), shape: BoxShape.circle),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(child: Text(CollectionStatusInfo.label(slice.key))),
                                  Text('${slice.count} ta', style: TextStyle(color: Theme.of(context).colorScheme.outline)),
                                  const SizedBox(width: 10),
                                  Text(formatMoney(slice.totalDebt), style: const TextStyle(fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.label, required this.value, required this.color, required this.icon});

  final String label;
  final String value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, size: 18, color: color),
              ),
              const SizedBox(height: 12),
              Text(label, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.outline)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.pct});

  final int pct;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(context.watch<LocaleCubit>().state.tr('field.collected')),
                Text('$pct%', style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.success)),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: pct / 100,
                minHeight: 10,
                backgroundColor: AppTheme.success.withValues(alpha: 0.12),
                valueColor: const AlwaysStoppedAnimation(AppTheme.success),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
