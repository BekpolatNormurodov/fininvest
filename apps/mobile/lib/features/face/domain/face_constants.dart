/// Face-recognition thresholds and model I/O sizes (ported from the government worker app).
///
/// A real MobileFaceNet model produces embeddings separable at [kFaceMatchThreshold]; the pixel
/// fallback (used until a real `.tflite` is dropped in) is softer, hence [kFaceMatchFallbackThreshold].
const double kFaceMatchThreshold = 0.7;
const double kFaceMatchFallbackThreshold = 0.5;

/// Embedding length — set to the real model's output (128 or 192).
const int kFaceEmbeddingSize = 192;

/// Model input is a [kFaceInputSize]×[kFaceInputSize] RGB frame.
const int kFaceInputSize = 112;
