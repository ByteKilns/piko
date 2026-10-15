import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/esewa_review_banner.dart';

void main() {
  Future<void> pump(WidgetTester tester, int count, VoidCallback onTap) => tester.pumpWidget(
        MaterialApp(theme: AppTheme.light, home: Scaffold(body: EsewaReviewBanner(count: count, onTap: onTap))),
      );

  testWidgets('says how many payments wait for review', (tester) async {
    await pump(tester, 3, () {});
    expect(find.text('3 eSewa payments to review'), findsOneWidget);

    await pump(tester, 1, () {});
    expect(find.text('1 eSewa payment to review'), findsOneWidget);
  });

  testWidgets('Review opens the review screen', (tester) async {
    var opened = 0;
    await pump(tester, 2, () => opened++);

    await tester.tap(find.text('Review'));
    expect(opened, 1);
  });
}
