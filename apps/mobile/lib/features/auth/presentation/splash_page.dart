import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../../../core/widgets/app_logo.dart';

/// Brand splash — echoes the web: the logo mark in a white tile over an ambient brand glow, with an
/// indeterminate spinner while the stored session resolves.
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: Stack(
        children: [
          // Ambient brand glow.
          Positioned(
            top: -140,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                width: 320,
                height: 320,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppTheme.brand.withValues(alpha: 0.14),
                ),
              ),
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo tile.
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: scheme.surface,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.6)),
                    boxShadow: [
                      BoxShadow(color: AppTheme.brand.withValues(alpha: 0.18), blurRadius: 40, offset: const Offset(0, 16)),
                    ],
                  ),
                  child: const LogoMark(size: 72),
                ),
                const SizedBox(height: 22),
                RichText(
                  text: TextSpan(
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5, color: scheme.onSurface),
                    children: const [
                      TextSpan(text: 'Fin'),
                      TextSpan(text: 'Invest', style: TextStyle(color: AppTheme.brand)),
                    ],
                  ),
                ),
                const SizedBox(height: 3),
                const Text(
                  'UNDIRUVCHI',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 5, color: AppTheme.brand),
                ),
                const SizedBox(height: 40),
                const SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
