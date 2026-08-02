import 'package:equatable/equatable.dart';

class AppNotification extends Equatable {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.caseId,
    required this.read,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String? body;
  final String? caseId;
  final bool read;
  final String createdAt;

  AppNotification copyWith({bool? read}) => AppNotification(
        id: id, type: type, title: title, body: body, caseId: caseId,
        read: read ?? this.read, createdAt: createdAt,
      );

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      type: json['type'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String?,
      caseId: json['caseId'] as String?,
      read: json['read'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  @override
  List<Object?> get props => [id, read];
}
