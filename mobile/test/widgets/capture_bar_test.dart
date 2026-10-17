import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/capture_bar.dart';

void main() {
  testWidgets('Add expense is the main button; voice is the small mic beside it', (tester) async {
    var added = 0;
    var spoken = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(bottomNavigationBar: CaptureBar(onAdd: () => added++, onVoice: () => spoken++)),
      ),
    );

    expect(find.widgetWithText(FilledButton, 'Add expense'), findsOneWidget);
    expect(find.text('Add by voice'), findsNothing);

    await tester.tap(find.text('Add expense'));
    await tester.tap(find.byTooltip('Add by voice'));
    expect(added, 1);
    expect(spoken, 1);
  });
}
