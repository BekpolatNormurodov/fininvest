import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:iconsax/iconsax.dart';
import 'package:latlong2/latlong.dart';

import '../../../app/theme.dart';
import '../../../core/di/injector.dart';
import '../../../core/format.dart';
import '../../../core/widgets/state_views.dart';
import '../../chat/data/chat_repository.dart';
import '../../chat/presentation/chat_page.dart';
import '../data/collections_repository.dart';
import '../data/models/collection_detail.dart';
import 'visit_form_page.dart';
import 'widgets/status_chip.dart';

const _letterLabels = {
  'NONE': 'Xatsiz',
  'WARNING': 'Ogohlantirish',
  'EXPLANATION': 'Tushuntirish',
  'OTHER': 'Boshqa',
};

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

  Future<void> _addVisit(CollectionDetail data) async {
    final added = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => VisitFormPage(collectionId: data.id, title: data.title)),
    );
    if (added == true) _reload();
  }

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
          final located = data.visits.where((v) => v.hasLocation).toList();
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
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
                if (located.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  _MapCard(visits: located),
                ],
                const SizedBox(height: 16),
                _VisitsCard(visits: data.visits),
              ],
            ),
          );
        },
      ),
      floatingActionButton: FutureBuilder<CollectionDetail>(
        future: _future,
        builder: (context, snapshot) {
          final data = snapshot.data;
          if (data == null) return const SizedBox.shrink();
          return FloatingActionButton.extended(
            onPressed: () => _addVisit(data),
            icon: const Icon(Iconsax.add),
            label: const Text('Tashrif'),
          );
        },
      ),
    );
  }
}

class _MapCard extends StatelessWidget {
  const _MapCard({required this.visits});

  final List<VisitItem> visits;

  @override
  Widget build(BuildContext context) {
    final first = visits.first;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: SizedBox(
        height: 200,
        child: FlutterMap(
          options: MapOptions(initialCenter: LatLng(first.lat!, first.lng!), initialZoom: 14),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'uz.fininvest.undiruv',
            ),
            MarkerLayer(
              markers: [
                for (final v in visits)
                  Marker(
                    point: LatLng(v.lat!, v.lng!),
                    width: 40,
                    height: 40,
                    child: const Icon(Iconsax.location5, color: AppTheme.danger, size: 32),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _VisitsCard extends StatelessWidget {
  const _VisitsCard({required this.visits});

  final List<VisitItem> visits;

  @override
  Widget build(BuildContext context) {
    final outline = Theme.of(context).colorScheme.outline;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Tashriflar (${visits.length})', style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (visits.isEmpty)
              Text('Hali tashrif yo‘q', style: TextStyle(color: outline))
            else
              ...visits.map(
                (v) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              v.amount > 0 ? formatMoney(v.amount) : (_letterLabels[v.letterType] ?? '—'),
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                          Text(formatDate(v.createdAt), style: TextStyle(fontSize: 12, color: outline)),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          if (v.letterType != 'NONE') ...[
                            Icon(Iconsax.document_text, size: 13, color: outline),
                            const SizedBox(width: 3),
                            Text(_letterLabels[v.letterType] ?? '', style: TextStyle(fontSize: 12, color: outline)),
                            const SizedBox(width: 10),
                          ],
                          if (v.hasLocation) ...[
                            Icon(Iconsax.location, size: 13, color: outline),
                            const SizedBox(width: 3),
                            Text('joylashuv', style: TextStyle(fontSize: 12, color: outline)),
                            const SizedBox(width: 10),
                          ],
                          if (v.mediaCount > 0) ...[
                            Icon(Iconsax.gallery, size: 13, color: outline),
                            const SizedBox(width: 3),
                            Text('${v.mediaCount}', style: TextStyle(fontSize: 12, color: outline)),
                          ],
                        ],
                      ),
                      if (v.comment != null && v.comment!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(v.comment!, style: TextStyle(fontSize: 13, color: outline)),
                        ),
                      const Divider(height: 14),
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
                IconButton(
                  tooltip: 'Ariza chati',
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Iconsax.messages_2, size: 20),
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => ChatPage(channel: ChatChannel.forCase(data.caseId, data.title))),
                  ),
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
