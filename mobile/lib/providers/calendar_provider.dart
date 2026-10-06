import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/bs_calendar.dart';
import 'api_client_provider.dart';
import 'auth_provider.dart';

// Loaded from assets/bs_calendar.json in main() before the app starts.
final bundledCalendarProvider = Provider<BsCalendar>((ref) => throw UnimplementedError('override in main()'));

// The website's own table, so a calendar correction reaches the app with a web
// deploy. null when logged out or unreachable — the bundled copy covers that.
final serverCalendarProvider = FutureProvider<BsCalendar?>((ref) async {
  if (ref.watch(authProvider).value == null) return null;
  try {
    return await ref.watch(apiClientProvider).fetchCalendar();
  } catch (_) {
    return null;
  }
});

final bsCalendarProvider = Provider<BsCalendar>(
  (ref) => ref.watch(serverCalendarProvider).valueOrNull ?? ref.watch(bundledCalendarProvider),
);
