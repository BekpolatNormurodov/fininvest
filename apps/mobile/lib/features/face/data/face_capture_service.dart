import 'dart:io';
import 'dart:typed_data';

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';

import '../domain/face_constants.dart';
import 'face_embedder.dart';

/// Captures a selfie, finds the largest face, crops+resizes it to a 112×112 RGB frame and returns its
/// embedding. Decoupled from the government worker app's camera-stream detector: it runs ML Kit on a
/// single still image (orientation baked in first so the box and the crop share one coordinate space).
class FaceCaptureService {
  FaceCaptureService(this._embedder);

  final FaceEmbedder _embedder;
  final ImagePicker _picker = ImagePicker();
  final FaceDetector _detector = FaceDetector(
    options: FaceDetectorOptions(performanceMode: FaceDetectorMode.accurate),
  );

  bool get isFallback => _embedder.isFallback;

  /// Take a front-camera selfie and return its embedding, or a [FaceCaptureError] reason on failure.
  Future<FaceCaptureOutcome> captureEmbedding() async {
    await _embedder.load();

    final XFile? shot = await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 92,
    );
    if (shot == null) return const FaceCaptureOutcome.error(FaceCaptureError.cancelled);

    final bytes = await File(shot.path).readAsBytes();
    var decoded = img.decodeImage(bytes);
    if (decoded == null) return const FaceCaptureOutcome.error(FaceCaptureError.decode);
    decoded = img.bakeOrientation(decoded);

    // ML Kit on the orientation-corrected image (written to a temp file it can read).
    final tmp = File('${(await getTemporaryDirectory()).path}/face_probe.jpg');
    await tmp.writeAsBytes(img.encodeJpg(decoded));
    final faces = await _detector.processImage(InputImage.fromFilePath(tmp.path));
    if (faces.isEmpty) return const FaceCaptureOutcome.error(FaceCaptureError.noFace);

    faces.sort((a, b) =>
        (b.boundingBox.width * b.boundingBox.height).compareTo(a.boundingBox.width * a.boundingBox.height));
    final box = faces.first.boundingBox;

    final x = box.left.clamp(0, decoded.width - 1).toInt();
    final y = box.top.clamp(0, decoded.height - 1).toInt();
    final w = box.width.clamp(1, decoded.width - x).toInt();
    final h = box.height.clamp(1, decoded.height - y).toInt();

    final crop = img.copyResize(
      img.copyCrop(decoded, x: x, y: y, width: w, height: h),
      width: kFaceInputSize,
      height: kFaceInputSize,
    );

    final rgb = Uint8List(kFaceInputSize * kFaceInputSize * 3);
    var i = 0;
    for (var yy = 0; yy < kFaceInputSize; yy++) {
      for (var xx = 0; xx < kFaceInputSize; xx++) {
        final p = crop.getPixel(xx, yy);
        rgb[i++] = p.r.toInt();
        rgb[i++] = p.g.toInt();
        rgb[i++] = p.b.toInt();
      }
    }
    return FaceCaptureOutcome.success(_embedder.embed(rgb));
  }

  Future<void> dispose() async {
    await _detector.close();
    _embedder.dispose();
  }
}

enum FaceCaptureError { cancelled, decode, noFace }

class FaceCaptureOutcome {
  const FaceCaptureOutcome.success(this.embedding) : error = null;
  const FaceCaptureOutcome.error(this.error) : embedding = null;

  final List<double>? embedding;
  final FaceCaptureError? error;

  bool get ok => embedding != null;
}
