import 'package:equatable/equatable.dart';

double _toDouble(dynamic v) => v == null ? 0 : (v as num).toDouble();

class StatsSlice extends Equatable {
  const StatsSlice({required this.key, required this.label, required this.count, required this.totalDebt, required this.collected});

  final String key;
  final String label;
  final int count;
  final double totalDebt;
  final double collected;

  factory StatsSlice.fromJson(Map<String, dynamic> json) => StatsSlice(
        key: json['key'] as String? ?? '',
        label: json['label'] as String? ?? '',
        count: (json['count'] as num?)?.toInt() ?? 0,
        totalDebt: _toDouble(json['totalDebt']),
        collected: _toDouble(json['collected']),
      );

  @override
  List<Object?> get props => [key, count, totalDebt, collected];
}

/// Mirrors the shared `CollectionStats` — the sidebar rollup, reused on mobile.
class CollectionStats extends Equatable {
  const CollectionStats({
    required this.count,
    required this.activeCount,
    required this.closedCount,
    required this.totalDebt,
    required this.totalCollected,
    required this.remaining,
    required this.collectedPct,
    required this.byStatus,
    required this.byCollector,
  });

  final int count;
  final int activeCount;
  final int closedCount;
  final double totalDebt;
  final double totalCollected;
  final double remaining;
  final int collectedPct;
  final List<StatsSlice> byStatus;
  final List<StatsSlice> byCollector;

  static List<StatsSlice> _slices(dynamic raw) =>
      (raw as List<dynamic>? ?? []).map((e) => StatsSlice.fromJson(e as Map<String, dynamic>)).toList();

  factory CollectionStats.fromJson(Map<String, dynamic> json) => CollectionStats(
        count: (json['count'] as num?)?.toInt() ?? 0,
        activeCount: (json['activeCount'] as num?)?.toInt() ?? 0,
        closedCount: (json['closedCount'] as num?)?.toInt() ?? 0,
        totalDebt: _toDouble(json['totalDebt']),
        totalCollected: _toDouble(json['totalCollected']),
        remaining: _toDouble(json['remaining']),
        collectedPct: (json['collectedPct'] as num?)?.toInt() ?? 0,
        byStatus: _slices(json['byStatus']),
        byCollector: _slices(json['byCollector']),
      );

  @override
  List<Object?> get props => [count, totalDebt, totalCollected, remaining];
}
