import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/esewa_draft_strip.dart';
import 'package:piko/widgets/esewa_review_banner.dart';
import 'package:piko/widgets/step_squares.dart';

void main() {
  Future<void> pump(WidgetTester tester, {required bool checking, required int count}) => tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: Column(
              children: [
                EsewaDraftStrip(checking: checking, count: count, onTap: () {}),
                const Text('Recent expenses'),
              ],
            ),
          ),
        ),
      );

  double headingTop(WidgetTester tester) => tester.getTopLeft(find.text('Recent expenses')).dy;

  testWidgets('shows the stepping squares while Piko checks', (tester) async {
    await pump(tester, checking: true, count: 0);

    expect(find.byType(StepSquares), findsOneWidget);
    expect(find.byType(EsewaReviewBanner), findsNothing);
  });

  testWidgets('a found draft turns the squares into the banner, pushing the list down smoothly', (tester) async {
    await pump(tester, checking: true, count: 0);
    final before = headingTop(tester);

    await pump(tester, checking: false, count: 2);
    await tester.pump(const Duration(milliseconds: 100));
    final midway = headingTop(tester);
    await tester.pumpAndSettle();

    expect(find.byType(StepSquares), findsNothing);
    expect(find.text('2 eSewa payments to review'), findsOneWidget);
    // Partway there at 100ms, not jumped straight to the end.
    expect(midway, greaterThan(before));
    expect(midway, lessThan(headingTop(tester)));
  });

  testWidgets('with nothing found the squares fold away', (tester) async {
    await pump(tester, checking: false, count: 0);
    final empty = headingTop(tester);

    await pump(tester, checking: true, count: 0);
    await tester.pump();
    await pump(tester, checking: false, count: 0);
    await tester.pumpAndSettle();

    expect(find.byType(StepSquares), findsNothing);
    expect(find.byType(EsewaReviewBanner), findsNothing);
    expect(headingTop(tester), empty);
  });

  testWidgets('the banner stays while Piko checks again', (tester) async {
    await pump(tester, checking: true, count: 1);

    expect(find.text('1 eSewa payment to review'), findsOneWidget);
    expect(find.byType(StepSquares), findsNothing);
  });
}
