import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/captured_notifications_screen.dart';
import 'package:piko/esewa/esewa_alerts.dart';
import 'package:piko/models/capture_event.dart';
import 'package:piko/models/categories_result.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense.dart';
import 'package:piko/models/member_option.dart';
import 'package:piko/providers/app_update_provider.dart';
import 'package:piko/providers/calendar_provider.dart';
import 'package:piko/providers/categories_provider.dart';
import 'package:piko/providers/esewa_provider.dart';
import 'package:piko/providers/expenses_provider.dart';
import 'package:piko/screens/home_screen.dart';
import 'package:piko/screens/voice_capture_screen.dart';
import 'package:piko/services/bs_calendar.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/expense_confirm_sheet.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Where a tapped Piko alert points, if Piko was opened from one.
class _Alerts extends EsewaAlerts {
  _Alerts(this.target);

  AlertTarget? target;

  @override
  Future<AlertTarget?> takeOpenTarget() async {
    final t = target;
    target = null;
    return t;
  }
}

void main() {
  final calendar = BsCalendar.fromJson(
    jsonDecode(File('assets/bs_calendar.json').readAsStringSync()) as Map<String, dynamic>,
  );
  final options = CategoriesResult(
    categories: [CategoryOption(id: 'cat-groceries', name: 'Groceries')],
    members: [MemberOption(id: 'mem-1', name: 'Nirjal')],
    currentMemberId: 'mem-1',
  );

  Future<void> pumpHome(WidgetTester tester, {AlertTarget? openedFrom}) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          esewaAlertsProvider.overrideWithValue(_Alerts(openedFrom)),
          esewaServiceProvider.overrideWithValue(null),
          availableUpdateProvider.overrideWith((ref) async => null),
          categoriesProvider.overrideWith((ref) async => options),
          recentExpensesProvider.overrideWith((ref) async => const <Expense>[]),
          captureEventsProvider.overrideWith((ref) async => const <CaptureEvent>[]),
          bsCalendarProvider.overrideWithValue(calendar),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const HomeScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('opens on Home, not voice capture', (tester) async {
    await pumpHome(tester);

    expect(find.text('Recent expenses'), findsOneWidget);
    expect(find.byType(VoiceCaptureScreen), findsNothing);
  });

  testWidgets("opened from an alert, it shows the alert's screen", (tester) async {
    await pumpHome(tester, openedFrom: AlertTarget.captured);

    expect(find.byType(CapturedNotificationsScreen), findsOneWidget);
    expect(find.byType(VoiceCaptureScreen), findsNothing);
  });

  testWidgets('Add expense opens the sheet to type one', (tester) async {
    await pumpHome(tester);

    await tester.tap(find.text('Add expense'));
    await tester.pumpAndSettle();

    expect(find.byType(ExpenseConfirmSheet), findsOneWidget);
  });
}
