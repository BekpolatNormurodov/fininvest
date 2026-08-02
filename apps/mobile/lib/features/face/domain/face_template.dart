import 'package:equatable/equatable.dart';

/// An enrolled face: the embedding vector plus when/who. Persisted locally, encrypted.
class FaceTemplate extends Equatable {
  const FaceTemplate({required this.embedding, required this.enrolledAt, required this.workerId});

  factory FaceTemplate.fromJson(Map<String, dynamic> json) {
    return FaceTemplate(
      embedding: (json['embedding'] as List).map((e) => (e as num).toDouble()).toList(),
      enrolledAt: DateTime.parse(json['enrolled_at'] as String),
      workerId: json['worker_id'] as String,
    );
  }

  final List<double> embedding;
  final DateTime enrolledAt;
  final String workerId;

  Map<String, dynamic> toJson() => {
        'embedding': embedding,
        'enrolled_at': enrolledAt.toIso8601String(),
        'worker_id': workerId,
      };

  @override
  List<Object?> get props => [embedding, enrolledAt, workerId];
}

class FaceMatchResult {
  const FaceMatchResult(this.similarity, {required this.passed});
  final double similarity;
  final bool passed;
}
