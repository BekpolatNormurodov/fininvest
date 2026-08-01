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
    required this.createdAt,
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
  final String createdAt;

  double get remaining {
    final r = totalDebt - collectedAmount;
    return r > 0 ? r : 0;
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
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  @override
  List<Object?> get props => [id, status, totalDebt, collectedAmount, months];
}
