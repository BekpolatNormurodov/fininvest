import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fininvest_undiruv/core/format.dart';
import 'package:fininvest_undiruv/core/widgets/app_logo.dart';

void main() {
  group('formatMoney', () {
    test('groups thousands with a space and appends so‘m', () {
      expect(formatMoney(1500000), '1 500 000 so‘m');
      expect(formatMoney(0), '0 so‘m');
      expect(formatMoney(999), '999 so‘m');
    });
  });

  group('formatMonth', () {
    test('renders the Uzbek month name and year', () {
      expect(formatMonth(3, 2026), 'Mart 2026');
      expect(formatMonth(12, 2025), 'Dekabr 2025');
    });
  });

  testWidgets('AppLogo renders the wordmark', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: AppLogo())));
    expect(find.text('FinInvest'), findsOneWidget);
    expect(find.text('UNDIRUV'), findsOneWidget);
  });
}
