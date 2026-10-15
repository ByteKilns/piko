import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/captured_notifications_screen.dart';
import 'package:piko/models/capture_event.dart';
import 'package:piko/providers/calendar_provider.dart';
import 'package:piko/providers/esewa_provider.dart';
import 'package:piko/services/bs_calendar.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  final calendar = BsCalendar.fromJson(
    jsonDecode(File('assets/bs_calendar.json').readAsStringSync()) as Map<String, dynamic>,
  );

  test('reads a notification with its time in local time', () {
    final event = CaptureEvent.fromJson({
      'key': 'k',
      'postedAt': '2026-10-14T06:15:00.000Z',
      'source': 'notification',
      'text': 'You have paid Rs. 500 to Daraz.',
      'title': 'eSewa',
    });

    expect(event.postedAt, DateTime.utc(2026, 10, 14, 6, 15).toLocal());
    expect(event.copyText, 'eSewa\nYou have paid Rs. 500 to Daraz.');
  });

  testWidgets('lists the notifications and copies one as it was sent', (tester) async {
    SharedPreferences.setMockInitialValues({});
    String? copied;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String;
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          captureEventsProvider.overrideWith(
            (ref) async => [
              CaptureEvent(title: 'eSewa', text: 'Payment of NPR 845 to Nepal Oil done', postedAt: DateTime(2026, 10, 14, 9, 5)),
              CaptureEvent(title: 'eSewa', text: 'Your OTP is ••••••', postedAt: DateTime(2026, 10, 14, 9, 1)),
            ],
          ),
          bsCalendarProvider.overrideWithValue(calendar),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const CapturedNotificationsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Payment of NPR 845 to Nepal Oil done'), findsOneWidget);
    expect(find.text('Your OTP is ••••••'), findsOneWidget);

    await tester.tap(find.text('Copy').first);
    await tester.pump();

    expect(copied, 'eSewa\nPayment of NPR 845 to Nepal Oil done');
    expect(find.text('Copied'), findsOneWidget);
  });
}
