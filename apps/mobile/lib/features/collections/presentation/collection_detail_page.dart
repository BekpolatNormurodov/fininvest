import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';

import '../../../core/di/injector.dart';
import '../../../core/format.dart';
import '../../../core/widgets/state_views.dart';
import '../data/collections_repository.dart';
import '../data/models/collection_detail.dart';
import 'widgets/status_chip.dart';

class CollectionDetailPage extends StatefulWidget {
  const CollectionDetailPage({super.key, required this.id});

  final String id;

  @override
  State<CollectionDetailPage> createState() => _CollectionDetailPageState();
}

class _CollectionDetailPageState extends State<CollectionDetailPage> {
  late Future<CollectionDetail> _future;

  @override
  void initState() {
    super.initState();
    _future = sl<CollectionsRepository>().detail(widget.id);
  }

  void _reload() => setState(() => _future = sl<CollectionsRepository>().detail(widget.id));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Undiruv')),
      body: FutureBuilder<CollectionDetail>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingView();
          }
          if (snapshot.hasError) {
            return ErrorView(message: '${snapshot.error}', onRetry: _reload);
          }
          final data = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _Header(data: data),
                const SizedBox(height: 16),
                _AmountsCard(data: data),
                const SizedBox(height: 16),
                _MonthsCard(months: data.months),
                if (data.note != null && data.note!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  _NoteCard(note: data.note!),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.data});

  final CollectionDetail data;

  @override
  Widget build(BuildContext context) {
    final outline = Theme.of(context).colorScheme.outline;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(data.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                ),
                StatusChip(status: data.status),
              ],
            ),
            const SizedBox(height: 6),
            Text(data.borrowerName ?? '—', style: TextStyle(color: outline)),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Iconsax.buildings_2, size: 16, color: outline),
                const SizedBox(width: 4),
                Text(data.branchName ?? '—', style: TextStyle(color: outline, fontSize: 13)),
                const SizedBox(width: 16),
                Icon(Iconsax.user, size: 16, color: outline),
                const SizedBox(width: 4),
                Text(data.collectorName ?? 'Biriktirilmagan', style: TextStyle(color: outline, fontSize: 13)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AmountsCard extends StatelessWidget {
  const _AmountsCard({required this.data});

  final CollectionDetail data;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _row(context, 'Jami qarzdorlik', formatMoney(data.totalDebt), bold: true),
            const Divider(height: 20),
            _row(context, 'Penya', formatMoney(data.penalty)),
            _row(context, 'Shtraf', formatMoney(data.fine)),
            const Divider(height: 20),
            _row(context, 'Undirilgan', formatMoney(data.collectedAmount)),
            _row(context, 'Qoldiq', formatMoney(data.remaining), bold: true),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Theme.of(context).colorScheme.outline)),
          Text(
            value,
            style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w600, fontSize: bold ? 16 : 14),
          ),
        ],
      ),
    );
  }
}

class _MonthsCard extends StatelessWidget {
  const _MonthsCard({required this.months});

  final List<CollectionMonth> months;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('To‘lanmagan oylar', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (months.isEmpty)
              Text('—', style: TextStyle(color: Theme.of(context).colorScheme.outline))
            else
              ...months.map(
                (m) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(formatMonth(m.month, m.year)),
                      Text(formatMoney(m.amount), style: const TextStyle(fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NoteCard extends StatelessWidget {
  const _NoteCard({required this.note});

  final String note;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Izoh', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(note),
          ],
        ),
      ),
    );
  }
}
