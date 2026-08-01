/// Money as the rest of the product shows it: thousands separated by a thin space, «so‘m» suffix.
String formatMoney(num? value) {
  final rounded = (value ?? 0).round();
  final digits = rounded.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(digits[i]);
  }
  final sign = rounded < 0 ? '-' : '';
  return '$sign$buffer so‘m';
}

const _monthsUz = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

/// «Mart 2026» for a 1..12 month + year.
String formatMonth(int month, int year) {
  final name = (month >= 1 && month <= 12) ? _monthsUz[month - 1] : '$month';
  return '$name $year';
}

/// «15.03.2026» from an ISO string; returns «—» when absent/invalid.
String formatDate(String? iso) {
  if (iso == null || iso.isEmpty) return '—';
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return '—';
  final d = parsed.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(d.day)}.${two(d.month)}.${d.year}';
}
