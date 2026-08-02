# TensorFlow Lite (tflite_flutter) — the face-verification engine.
# R8 in release mode reports the optional GPU-delegate classes as "missing" because we ship only
# the CPU interpreter (the GPU delegate is an optional artifact we don't include). Keep the TFLite
# classes and silence the unresolved GPU references so minification can complete.
-keep class org.tensorflow.lite.** { *; }
-dontwarn org.tensorflow.lite.**
-keep class org.tensorflow.lite.gpu.** { *; }
-dontwarn org.tensorflow.lite.gpu.**

# Google ML Kit face detection — models are loaded reflectively.
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**
