import 'package:flutter/material.dart';

import '../../data/models/collection_status.dart';

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = CollectionStatusInfo.color(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        CollectionStatusInfo.label(status),
        style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
