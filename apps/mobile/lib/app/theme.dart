import 'package:flutter/material.dart';

/// FinInvest brand theme. The seed matches the web operator portal's brand blue so the two surfaces
/// read as one product.
class AppTheme {
  const AppTheme._();

  static const Color brand = Color(0xFF0F5FA6);
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFD97706);
  static const Color danger = Color(0xFFDC2626);

  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(seedColor: brand, brightness: Brightness.light);
    return _base(scheme, const Color(0xFFF6F8FB));
  }

  static ThemeData get dark {
    final scheme = ColorScheme.fromSeed(seedColor: brand, brightness: Brightness.dark);
    return _base(scheme, const Color(0xFF0B1220));
  }

  static ThemeData _base(ColorScheme scheme, Color scaffold) {
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scaffold,
      appBarTheme: AppBarTheme(
        backgroundColor: scaffold,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: scheme.onSurface,
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: scheme.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.5)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerHighest.withValues(alpha: 0.4),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
    );
  }
}
