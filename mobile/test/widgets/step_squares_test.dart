import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/step_squares.dart';

void main() {
  // The colour of each of the three squares, left to right.
  List<Color?> colors(WidgetTester tester) => tester
      .widgetList<Container>(find.descendant(of: find.byType(StepSquares), matching: find.byType(Container)))
      .map((box) => box.color)
      .toList();

  Future<void> pump(WidgetTester tester, {bool disableAnimations = false}) => tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: MediaQuery(
            data: MediaQueryData(disableAnimations: disableAnimations),
            child: const Scaffold(body: StepSquares()),
          ),
        ),
      );

  const red = Color(0xFFEC3013);
  final grey = PikoColors.light.n300;

  testWidgets('the red square steps across the three squares', (tester) async {
    await pump(tester);
    expect(colors(tester), [red, grey, grey]);

    await tester.pump(const Duration(milliseconds: 300));
    expect(colors(tester), [grey, red, grey]);

    await tester.pump(const Duration(milliseconds: 300));
    expect(colors(tester), [grey, grey, red]);

    await tester.pump(const Duration(milliseconds: 300));
    expect(colors(tester), [red, grey, grey]);
  });

  testWidgets("stays still when the phone's animations are off", (tester) async {
    await pump(tester, disableAnimations: true);

    await tester.pump(const Duration(milliseconds: 300));
    expect(colors(tester), [red, grey, grey]);
  });
}
