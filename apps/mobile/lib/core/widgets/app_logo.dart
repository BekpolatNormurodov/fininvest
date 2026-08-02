import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../app/theme.dart';

/// The FinInvest brand mark — the exact SVG the web uses (gradient badge, rising bars + trend line),
/// so the mobile app reads as the same product.
const String _logoSvg = '''
<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fi-logo" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
      <stop stop-color="#38BDF8"/>
      <stop offset="1" stop-color="#0369A1"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" rx="11" fill="url(#fi-logo)"/>
  <rect x="10.5" y="23.5" width="3.4" height="6" rx="1.2" fill="#ffffff" fill-opacity="0.45"/>
  <rect x="18.3" y="20" width="3.4" height="9.5" rx="1.2" fill="#ffffff" fill-opacity="0.6"/>
  <rect x="26.1" y="16" width="3.4" height="13.5" rx="1.2" fill="#ffffff" fill-opacity="0.75"/>
  <path d="M11 24.5 L18 19 L23 22 L29.5 12.5" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24.8 12.6 L30 12 L29.4 17.2" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
''';

class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 48});

  final double size;

  @override
  Widget build(BuildContext context) => SvgPicture.string(_logoSvg, width: size, height: size);
}

/// The full brand lockup: the mark plus the «FinInvest / UNDIRUVCHI» wordmark, matching the web.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 64, this.showText = true});

  final double size;
  final bool showText;

  @override
  Widget build(BuildContext context) {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        LogoMark(size: size),
        if (showText) ...[
          SizedBox(height: size * 0.22),
          RichText(
            text: TextSpan(
              style: TextStyle(fontSize: size * 0.34, fontWeight: FontWeight.w800, letterSpacing: -0.5, color: onSurface),
              children: const [
                TextSpan(text: 'Fin'),
                TextSpan(text: 'Invest', style: TextStyle(color: AppTheme.brand)),
              ],
            ),
          ),
          const SizedBox(height: 3),
          Text(
            'UNDIRUVCHI',
            style: TextStyle(
              fontSize: size * 0.16,
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
