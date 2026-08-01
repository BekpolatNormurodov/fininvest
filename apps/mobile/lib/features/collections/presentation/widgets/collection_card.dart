import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';

import '../../../../app/theme.dart';
import '../../../../core/format.dart';
import '../../data/models/collection_list_item.dart';
import 'status_chip.dart';

class CollectionCard extends StatelessWidget {
  const CollectionCard({super.key, required this.item, required this.onTap});

  final CollectionListItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final outline = Theme.of(context).colorScheme.outline;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text(
                          item.borrowerName ?? '—',
                          style: TextStyle(color: outline, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  StatusChip(status: item.status),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  _Metric(label: 'Qarzdorlik', value: formatMoney(item.totalDebt), color: AppTheme.danger),
                  const SizedBox(width: 12),
                  _Metric(label: 'Qoldiq', value: formatMoney(item.remaining), color: AppTheme.warning),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Iconsax.buildings_2, size: 15, color: outline),
                  const SizedBox(width: 4),
                  Text(item.branchName ?? '—', style: TextStyle(color: outline, fontSize: 12)),
                  const Spacer(),
                  Icon(Iconsax.calendar_1, size: 15, color: outline),
                  const SizedBox(width: 4),
                  Text('${item.monthsCount} oy', style: TextStyle(color: outline, fontSize: 12)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 11, color: color)),
            const SizedBox(height: 2),
            Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      ),
    );
  }
}
