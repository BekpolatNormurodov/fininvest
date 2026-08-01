import 'package:flutter/material.dart';

import '../../app/theme.dart';

/// The FinInvest Undiruv wordmark/logo. A drawn mark (no asset dependency) so it renders identically
/// everywhere; the raster [assets/images/logo.png] is used only for the launcher icon.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 64, this.showText = true});

  final double size;
  final bool showText;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppTheme.brand, Color(0xFF1E88E5)],
            ),
            borderRadius: BorderRadius.circular(size * 0.28),
            boxShadow: [
              BoxShadow(
                color: AppTheme.brand.withValues(alpha: 0.35),
                blurRadius: size * 0.25,
                offset: Offset(0, size * 0.12),
              ),
            ],
          ),
          child: Center(
            child: Text(
              'FI',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: size * 0.4,
                letterSpacing: -1,
              ),
            ),
          ),
        ),
        if (showText) ...[
          SizedBox(height: size * 0.24),
          const Text(
            'FinInvest',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, height: 1),
          ),
          const SizedBox(height: 2),
          Text(
            'UNDIRUV',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 4,
              color: AppTheme.brand,
            ),
          ),
        ],
      ],
    );
  }
}
