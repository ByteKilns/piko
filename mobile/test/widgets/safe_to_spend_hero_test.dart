import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/pacing.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/safe_to_spend_hero.dart';
import 'package:piko/widgets/step_squares.dart';

const _onTrack = Pacing(nextWeekAllowance: 490, nextWeekday: 'Wednesday', over: false, overrunNote: null, safeToday: 78);
const _over = Pacing(nextWeekAllowance: 2100, nextWeekday: 'Sunday', over: true, overrunNote: null, safeToday: 0);

void main() {
  Future<void> pump(WidgetTester tester, AsyncValue<Pacing?> pacing) => tester.pumpWidget(
        MaterialApp(theme: AppTheme.light, home: Scaffold(body: SafeToSpendHero(pacing: pacing))),
      );

  testWidgets('on track: the figure, the status and what it means', (tester) async {
    await pump(tester, const AsyncValue.data(_onTrack));

    expect(find.text('SAFE TO SPEND TODAY'), findsOneWidget);
    expect(find.text('On track'), findsOneWidget);
    expect(find.textContaining('78', findRichText: true), findsOneWidget);
    expect(find.text('Spend up to this today on things you can cut and the week stays on plan.'), findsOneWidget);
  });

  testWidgets('over: says the allowance is spent and when the next one starts', (tester) async {
    await pump(tester, const AsyncValue.data(_over));

    expect(find.text('Over budget'), findsOneWidget);
    expect(
      find.text("This week's allowance is fully spent. A new weekly allowance of Rs 2,100 starts on Sunday."),
      findsOneWidget,
    );

    await pump(
      tester,
      const AsyncValue.data(Pacing(nextWeekAllowance: 2100, nextWeekday: null, over: true, overrunNote: null, safeToday: 0)),
    );
    expect(find.textContaining('starts on the next week.'), findsOneWidget);
  });

  testWidgets("shows why another line's overrun came out of it", (tester) async {
    await pump(
      tester,
      const AsyncValue.data(Pacing(
        nextWeekAllowance: 408,
        nextWeekday: 'Wednesday',
        over: false,
        overrunNote: 'Rent went Rs 500.00 over, taken from your spending money.',
        safeToday: 62,
      )),
    );

    expect(find.text('Rent went Rs 500.00 over, taken from your spending money.'), findsOneWidget);
  });

  testWidgets('without can-cut lines, says where to set them up', (tester) async {
    await pump(tester, const AsyncValue.data(null));

    expect(find.text('SAFE TO SPEND TODAY'), findsNothing);
    expect(
      find.text("Mark budget lines as Can cut on the website's Budget page to see what's safe to spend each day."),
      findsOneWidget,
    );
  });

  testWidgets('the stepping squares while it first loads; nothing if that fails', (tester) async {
    await pump(tester, const AsyncValue.loading());
    expect(find.byType(StepSquares), findsOneWidget);

    await pump(tester, AsyncValue.error(Exception('offline'), StackTrace.empty));
    expect(find.byType(StepSquares), findsNothing);
    expect(find.text('SAFE TO SPEND TODAY'), findsNothing);
  });

  testWidgets('keeps the last figure while refreshing and when a refresh fails', (tester) async {
    var calls = 0;
    final pacing = FutureProvider.autoDispose<Pacing?>((ref) async {
      calls++;
      if (calls == 1) return _onTrack;
      throw Exception('offline');
    });
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(body: Consumer(builder: (context, ref, _) => SafeToSpendHero(pacing: ref.watch(pacing)))),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('78', findRichText: true), findsOneWidget);

    ProviderScope.containerOf(tester.element(find.byType(SafeToSpendHero))).invalidate(pacing);
    await tester.pump();
    expect(find.byType(StepSquares), findsNothing);
    expect(find.textContaining('78', findRichText: true), findsOneWidget);

    await tester.pumpAndSettle();
    expect(calls, 2);
    expect(find.textContaining('78', findRichText: true), findsOneWidget);
  });
}
