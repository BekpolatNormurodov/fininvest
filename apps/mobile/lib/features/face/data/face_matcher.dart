import 'dart:math' as math;

import '../domain/face_constants.dart';
import '../domain/face_template.dart';

/// Compares two face embeddings by cosine similarity (ported from the government worker app).
class FaceMatcher {
  double cosineSimilarity(List<double> a, List<double> b) {
    if (a.length != b.length) {
      throw ArgumentError('embedding sizes differ: ${a.length} vs ${b.length}');
    }
    var dot = 0.0, na = 0.0, nb = 0.0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na == 0 || nb == 0) return 0;
    return dot / (math.sqrt(na) * math.sqrt(nb));
  }

  FaceMatchResult match(List<double> probe, List<double> template, {double threshold = kFaceMatchThreshold}) {
    final s = cosineSimilarity(probe, template);
    return FaceMatchResult(s, passed: s >= threshold);
  }
}
