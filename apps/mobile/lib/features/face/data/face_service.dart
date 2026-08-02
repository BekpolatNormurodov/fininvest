import '../domain/face_constants.dart';
import '../domain/face_template.dart';
import 'face_capture_service.dart';
import 'face_matcher.dart';
import 'face_store.dart';

/// The face check-in facade the app uses: enroll a template, and verify a live selfie against it.
class FaceService {
  FaceService(this._capture, this._store, this._matcher);

  final FaceCaptureService _capture;
  final FaceStore _store;
  final FaceMatcher _matcher;

  Future<bool> isEnrolled() => _store.hasTemplate();
  Future<void> clear() => _store.clear();
  bool get isFallback => _capture.isFallback;

  /// Capture and save the face template. Returns null on success, or the capture error reason.
  Future<FaceCaptureError?> enroll(String workerId, {required DateTime now}) async {
    final outcome = await _capture.captureEmbedding();
    if (!outcome.ok) return outcome.error;
    await _store.write(FaceTemplate(embedding: outcome.embedding!, enrolledAt: now, workerId: workerId));
    return null;
  }

  /// Capture a selfie and match it against the enrolled template.
  Future<FaceVerifyResult> verify() async {
    final template = await _store.read();
    if (template == null) return const FaceVerifyResult(notEnrolled: true);
    final outcome = await _capture.captureEmbedding();
    if (!outcome.ok) return FaceVerifyResult(error: outcome.error);
    final threshold = _capture.isFallback ? kFaceMatchFallbackThreshold : kFaceMatchThreshold;
    final m = _matcher.match(outcome.embedding!, template.embedding, threshold: threshold);
    return FaceVerifyResult(passed: m.passed, similarity: m.similarity);
  }
}

class FaceVerifyResult {
  const FaceVerifyResult({this.passed = false, this.similarity = 0, this.error, this.notEnrolled = false});

  final bool passed;
  final double similarity;
  final FaceCaptureError? error;
  final bool notEnrolled;
}
