import 'package:equatable/equatable.dart';

double _toDouble(dynamic value) => value == null ? 0 : (value as num).toDouble();

/// A row in the collector's undiruv list (mirrors the shared `CollectionListItem`).
class CollectionListItem extends Equatable {
  const CollectionListItem({
    required this.id,
    required this.caseNumber,
    required this.contractNumber,
    required this.borrowerName,
    required this.branchName,
    required this.status,
    required this.totalDebt,
    required this.collectedAmount,
    required this.monthsCount,
    required this.collectorId,
    required this.collectorName,
    required this.createdAt,
  });

  final String id;
  final String caseNumber;
  final String? contractNumber;
  final String? borrowerName;
  final String? branchName;
  final String status;
  final double totalDebt;
  final double collectedAmount;
  final int monthsCount;
  final String? collectorId;
  final String? collectorName;
  final String createdAt;

  double get remaining {
    final r = totalDebt - collectedAmount;
    return r > 0 ? r : 0;
  }

  String get title => (contractNumber != null && contractNumber!.isNotEmpty) ? contractNumber! : caseNumber;

  factory CollectionListItem.fromJson(Map<String, dynamic> json) {
    return CollectionListItem(
      id: json['id'] as String,
      caseNumber: json['caseNumber'] as String? ?? '',
      contractNumber: json['contractNumber'] as String?,
      borrowerName: json['borrowerName'] as String?,
      branchName: json['branchName'] as String?,
      status: json['status'] as String? ?? 'NEW',
      totalDebt: _toDouble(json['totalDebt']),
      collectedAmount: _toDouble(json['collectedAmount']),
      monthsCount: (json['monthsCount'] as num?)?.toInt() ?? 0,
      collectorId: json['collectorId'] as String?,
      collectorName: json['collectorName'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  @override
  List<Object?> get props => [id, status, totalDebt, collectedAmount, collectorId];
}
