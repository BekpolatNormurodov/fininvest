import 'dart:math' as math;
import 'dart:typed_data';

import 'package:tflite_flutter/tflite_flutter.dart';

import '../domain/face_constants.dart';

/// Loads `assets/models/mobilefacenet.tflite` and turns a 112×112 RGB frame into an L2-normalized
/// embedding. Ported verbatim from the government worker app.
///
/// **Model-less fallback**: while the asset is a placeholder (not a real MobileFaceNet — see
/// `assets/models/README.md`), [load] never throws — it sets [isFallback] and [embed] falls back to a
/// deterministic pixel-based perceptual embedding, so the flow never gets stuck on a "model error".
/// Dropping a real `.tflite` in makes the next [load] switch to the real model automatically.
class FaceEmbedder {
  static const _modelAssetPath = 'assets/models/mobilefacenet.tflite';
  static const _fallbackGrid = 8;

  Interpreter? _interpreter;
  bool get isFallback => _fallback;
  var _fallback = false;

  Future<void> load() async {
    if (_interpreter != null || _fallback) return;
    try {
      _interpreter = await Interpreter.fromAsset(_modelAssetPath);
    } on Object catch (_) {
      _fallback = true;
    }
  }

  List<double> embed(Uint8List rgb112) {
    _checkLength(rgb112);
    final interpreter = _interpreter;
    if (interpreter == null) return _fallbackEmbed(rgb112);

    final input = _preprocess(rgb112);
    final output = [List<double>.filled(kFaceEmbeddingSize, 0)];
    interpreter.run(input, output);
    return l2normalize(output.first);
  }

  void _checkLength(Uint8List rgb112) {
    const expectedLength = kFaceInputSize * kFaceInputSize * 3;
    if (rgb112.length != expectedLength) {
      throw ArgumentError('rgb112 length wrong: expected $expectedLength, got ${rgb112.length}.');
    }
  }

  List<List<List<List<double>>>> _preprocess(Uint8List rgb112) {
    return [
      List.generate(
        kFaceInputSize,
        (row) => List.generate(kFaceInputSize, (col) {
          final base = (row * kFaceInputSize + col) * 3;
          return [_normalizePixel(rgb112[base]), _normalizePixel(rgb112[base + 1]), _normalizePixel(rgb112[base + 2])];
        }),
      ),
    ];
  }

  double _normalizePixel(int channel) => channel / 127.5 - 1.0;

  /// Model-less perceptual embedding: three standardized 8×8 grids (luma + horizontal/vertical
  /// gradients) → 192, L2-normalized. Deterministic, real pixel signal (softer than a trained model).
  List<double> _fallbackEmbed(Uint8List rgb112) {
    const grid = _fallbackGrid;
    const blockSize = kFaceInputSize ~/ grid;

    final luma = List<double>.filled(grid * grid, 0);
    for (var by = 0; by < grid; by++) {
      for (var bx = 0; bx < grid; bx++) {
        var sum = 0.0;
        for (var y = 0; y < blockSize; y++) {
          for (var x = 0; x < blockSize; x++) {
            final px = bx * blockSize + x;
            final py = by * blockSize + y;
            final base = (py * kFaceInputSize + px) * 3;
            sum += 0.299 * rgb112[base] + 0.587 * rgb112[base + 1] + 0.114 * rgb112[base + 2];
          }
        }
        luma[by * grid + bx] = sum / (blockSize * blockSize);
      }
    }

    final gradX = List<double>.filled(grid * grid, 0);
    final gradY = List<double>.filled(grid * grid, 0);
    for (var y = 0; y < grid; y++) {
      for (var x = 0; x < grid; x++) {
        final left = luma[y * grid + math.max(0, x - 1)];
        final right = luma[y * grid + math.min(grid - 1, x + 1)];
        final up = luma[math.max(0, y - 1) * grid + x];
        final down = luma[math.min(grid - 1, y + 1) * grid + x];
        gradX[y * grid + x] = (right - left) / 2;
        gradY[y * grid + x] = (down - up) / 2;
      }
    }

    final descriptor = [..._standardize(luma), ..._standardize(gradX), ..._standardize(gradY)];
    return l2normalize(descriptor);
  }

  List<double> _standardize(List<double> values) {
    final mean = values.reduce((a, b) => a + b) / values.length;
    var variance = 0.0;
    for (final v in values) {
      variance += (v - mean) * (v - mean);
    }
    final std = math.sqrt(variance / values.length);
    if (std == 0) return List<double>.filled(values.length, 0);
    return [for (final v in values) (v - mean) / std];
  }

  static List<double> l2normalize(List<double> v) {
    var sumOfSquares = 0.0;
    for (final value in v) {
      sumOfSquares += value * value;
    }
    final norm = math.sqrt(sumOfSquares);
    if (norm == 0) return List<double>.from(v);
    return [for (final value in v) value / norm];
  }

  void dispose() => _interpreter?.close();
}
