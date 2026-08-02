import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';

import '../../../app/theme.dart';
import '../../../core/di/injector.dart';
import '../data/face_capture_service.dart';
import '../data/face_service.dart';

enum FaceMode { enroll, verify }

/// One page for both enrolling a face and verifying it. Pops `true` on success (or when no template
/// exists for a verify — no gate), `false`/nothing otherwise. Uses the front camera via a selfie.
class FaceCapturePage extends StatefulWidget {
  const FaceCapturePage({super.key, required this.mode, this.workerId = ''});

  final FaceMode mode;
  final String workerId;

  @override
  State<FaceCapturePage> createState() => _FaceCapturePageState();
}

class _FaceCapturePageState extends State<FaceCapturePage> {
  bool _busy = false;
  String? _message;

  bool get _isEnroll => widget.mode == FaceMode.enroll;

  String _errText(FaceCaptureError e) {
    switch (e) {
      case FaceCaptureError.cancelled:
        return 'Bekor qilindi.';
      case FaceCaptureError.decode:
        return 'Rasmni o‘qib bo‘lmadi. Qayta urining.';
      case FaceCaptureError.noFace:
        return 'Yuz aniqlanmadi. Yorug‘ joyda, yuzingizni to‘liq ko‘rsating.';
    }
  }

  Future<void> _run() async {
    setState(() { _busy = true; _message = null; });
    final face = sl<FaceService>();
    try {
      if (_isEnroll) {
        final err = await face.enroll(widget.workerId, now: DateTime.now());
        if (!mounted) return;
        if (err == null) { Navigator.pop(context, true); return; }
        setState(() => _message = _errText(err));
      } else {
        final r = await face.verify();
        if (!mounted) return;
        if (r.notEnrolled) { Navigator.pop(context, true); return; }
        if (r.error != null) { setState(() => _message = _errText(r.error!)); }
        else if (r.passed) { Navigator.pop(context, true); return; }
        else { setState(() => _message = 'Yuz mos kelmadi (${(r.similarity * 100).round()}%). Qayta urining.'); }
      }
    } catch (_) {
      if (mounted) setState(() => _message = 'Xatolik yuz berdi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEnroll ? 'Yuzni ro‘yxatga olish' : 'Yuzni tasdiqlash')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 150,
              height: 190,
              decoration: BoxDecoration(
                color: AppTheme.brand.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(90),
                border: Border.all(color: AppTheme.brand.withValues(alpha: 0.4), width: 2),
              ),
              child: const Icon(Iconsax.user, size: 72, color: AppTheme.brand),
            ),
            const SizedBox(height: 24),
            Text(
              _isEnroll
                  ? 'Old kamerani oching va yuzingizni to‘liq, yorug‘ joyda suratga oling.'
                  : 'Ishni boshlash uchun yuzingizni tasdiqlang.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Theme.of(context).colorScheme.outline),
            ),
            if (_message != null) ...[
              const SizedBox(height: 14),
              Text(_message!, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.danger, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 28),
            FilledButton.icon(
              onPressed: _busy ? null : _run,
              icon: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                  : const Icon(Iconsax.camera),
              label: Text(_isEnroll ? 'Suratga olish' : 'Tasdiqlash'),
            ),
          ],
        ),
      ),
    );
  }
}
