import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/app_release.dart';
import 'package:piko/providers/app_update_provider.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/app_update_check.dart';
import 'package:piko/widgets/step_squares.dart';

void main() {
  final release = AppRelease(
    apkUrl: 'https://piko.test/piko.apk',
    notes: 'Smoother loading.',
    sha256: 'abc',
    sizeBytes: 18 * 1024 * 1024,
    versionCode: 7,
    versionName: '1.4.1',
  );

  // What each check finds, in order: the one Settings starts with, then one per tap.
  late List<Future<AppRelease?> Function()> checks;

  Future<void> pump(WidgetTester tester) => tester.pumpWidget(
        ProviderScope(
          overrides: [
            installedVersionProvider.overrideWith((ref) async => '1.4.0 (6)'),
            availableUpdateProvider.overrideWith((ref) => checks.removeAt(0)()),
          ],
          child: MaterialApp(theme: AppTheme.light, home: const Scaffold(body: AppUpdateCheck())),
        ),
      );

  Future<void> tapCheck(WidgetTester tester) async {
    await tester.tap(find.text('Check for updates'));
    await tester.pump();
  }

  testWidgets('shows the installed version', (tester) async {
    checks = [() async => null];
    await pump(tester);
    await tester.pumpAndSettle();

    expect(find.text('Version 1.4.0 (6)'), findsOneWidget);
    expect(find.text("You're up to date"), findsNothing);
  });

  testWidgets('checking shows the stepping squares, then says it is up to date', (tester) async {
    final found = Completer<AppRelease?>();
    checks = [() async => null, () => found.future];
    await pump(tester);
    await tester.pumpAndSettle();

    await tapCheck(tester);
    expect(find.byType(StepSquares), findsOneWidget);

    found.complete(null);
    await tester.pumpAndSettle();
    expect(find.byType(StepSquares), findsNothing);
    expect(find.text("You're up to date"), findsOneWidget);
  });

  testWidgets('a newer release offers Update, which opens the update sheet', (tester) async {
    checks = [() async => null, () async => release];
    await pump(tester);
    await tester.pumpAndSettle();

    await tapCheck(tester);
    await tester.pumpAndSettle();
    expect(find.text('Piko 1.4.1 is available'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Update'));
    await tester.pumpAndSettle();
    expect(find.text('Piko v1.4.1'), findsOneWidget);
  });

  testWidgets("says so when it can't reach the server", (tester) async {
    checks = [() async => null, () async => throw Exception('offline')];
    await pump(tester);
    await tester.pumpAndSettle();

    await tapCheck(tester);
    await tester.pumpAndSettle();
    expect(find.text("Couldn't check. Try again."), findsOneWidget);
  });
}
