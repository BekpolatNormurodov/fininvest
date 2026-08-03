import 'package:equatable/equatable.dart';

double _toDouble(dynamic value) => value == null ? 0 : (value as num).toDouble();

class CollectionMonth extends Equatable {
  const CollectionMonth({required this.year, required this.month, required this.amount});

  final int year;
  final int month;
  final double amount;

  factory CollectionMonth.fromJson(Map<String, dynamic> json) {
    return CollectionMonth(
      year: (json['year'] as num).toInt(),
      month: (json['month'] as num).toInt(),
      amount: _toDouble(json['amount']),
    );
  }

  @override
  List<Object?> get props => [year, month, amount];
}

class VisitItem extends Equatable {
  const VisitItem({
    required this.id,
    required this.collectorName,
    required this.lat,
    required this.lng,
    required this.amount,
    required this.letterType,
    required this.comment,
    required this.mediaCount,
    required this.createdAt,
  });

  final String id;
  final String? collectorName;
  final double? lat;
  final double? lng;
  final double amount;
  final String letterType;
  final String? comment;
  final int mediaCount;
  final String createdAt;

  bool get hasLocation => lat != null && lng != null;

  factory VisitItem.fromJson(Map<String, dynamic> json) {
    final media = json['media'] as List<dynamic>? ?? [];
    return VisitItem(
      id: json['id'] as String,
      collectorName: json['collectorName'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      amount: _toDouble(json['amount']),
      letterType: json['letterType'] as String? ?? 'NONE',
      comment: json['comment'] as String?,
      mediaCount: media.length,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  @override
  List<Object?> get props => [id, amount, letterType];
}

/// Full undiruv detail (mirrors the shared `CollectionDto`).
class CollectionDetail extends Equatable {
  const CollectionDetail({
    required this.id,
    required this.caseId,
    required this.caseNumber,
    required this.contractNumber,
    required this.borrowerName,
    required this.branchName,
    required this.status,
    required this.months,
    required this.penalty,
    required this.fine,
    required this.totalDebt,
    required this.collectedAmount,
    required this.note,
    required this.collectorName,
    required this.visits,
    required this.createdAt,
    required this.dueDays,
    required this.deadlineAt,
  });

  final String id;
  final String caseId;
  final String caseNumber;
  final String? contractNumber;
  final String? borrowerName;
  final String? branchName;
  final String status;
  final List<CollectionMonth> months;
  final double penalty;
  final double fine;
  final double totalDebt;
  final double collectedAmount;
  final String? note;
  final String? collectorName;
  final List<VisitItem> visits;
  final String createdAt;
  final int dueDays;
  final String? deadlineAt;

  double get remaining {
    final r = totalDebt - collectedAmount;
    return r > 0 ? r : 0;
  }

  /// Whole days left until the deadline (negative = overdue). null when there is no deadline.
  int? get daysLeft {
    if (deadlineAt == null) return null;
    final dl = DateTime.tryParse(deadlineAt!);
    if (dl == null) return null;
    return (dl.difference(DateTime.now()).inSeconds / 86400).ceil();
  }

  String get title => (contractNumber != null && contractNumber!.isNotEmpty) ? contractNumber! : caseNumber;

  factory CollectionDetail.fromJson(Map<String, dynamic> json) {
    final monthsJson = (json['months'] as List<dynamic>? ?? []);
    return CollectionDetail(
      id: json['id'] as String,
      caseId: json['caseId'] as String? ?? '',
      caseNumber: json['caseNumber'] as String? ?? '',
      contractNumber: json['contractNumber'] as String?,
      borrowerName: json['borrowerName'] as String?,
      branchName: json['branchName'] as String?,
      status: json['status'] as String? ?? 'NEW',
      months: monthsJson.map((m) => CollectionMonth.fromJson(m as Map<String, dynamic>)).toList(),
      penalty: _toDouble(json['penalty']),
      fine: _toDouble(json['fine']),
      totalDebt: _toDouble(json['totalDebt']),
      collectedAmount: _toDouble(json['collectedAmount']),
      note: json['note'] as String?,
      collectorName: (json['collector'] as Map<String, dynamic>?)?['fullName'] as String?,
      visits: (json['visits'] as List<dynamic>? ?? [])
          .map((v) => VisitItem.fromJson(v as Map<String, dynamic>))
          .toList(),
      createdAt: json['createdAt'] as String? ?? '',
      dueDays: (json['dueDays'] as num?)?.toInt() ?? 4,
      deadlineAt: json['deadlineAt'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, status, totalDebt, collectedAmount, months];
}
