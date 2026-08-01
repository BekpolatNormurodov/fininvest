import 'package:flutter/material.dart';

import '../../../../app/theme.dart';

/// The backend `CollectionStatus` values, as sent over the wire, with their Uzbek labels and tones.
class CollectionStatusInfo {
  const CollectionStatusInfo._();

  static const Map<String, String> labels = {
    'NEW': 'Yangi',
    'ASSIGNED': 'Biriktirilgan',
    'IN_PROGRESS': 'Jarayonda',
    'CLOSED': 'Yopilgan',
  };

  static String label(String status) => labels[status] ?? status;

  static Color color(String status) {
    switch (status) {
      case 'ASSIGNED':
        return AppTheme.brand;
      case 'IN_PROGRESS':
        return AppTheme.warning;
      case 'CLOSED':
        return AppTheme.success;
      case 'NEW':
      default:
        return Colors.grey;
    }
  }
}
