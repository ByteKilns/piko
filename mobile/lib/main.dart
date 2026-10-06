import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'providers/auth_provider.dart';
import 'providers/calendar_provider.dart';
import 'services/bs_calendar.dart';
import 'screens/login_screen.dart';
import 'screens/splash_screen.dart';
import 'theme/app_theme.dart';

final navigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final calendarJson = jsonDecode(await rootBundle.loadString('assets/bs_calendar.json')) as Map<String, dynamic>;
  runApp(
    ProviderScope(
      overrides: [bundledCalendarProvider.overrideWithValue(BsCalendar.fromJson(calendarJson))],
      child: const PikoApp(),
    ),
  );
}

class PikoApp extends ConsumerWidget {
  const PikoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen<AsyncValue<String?>>(authProvider, (previous, next) {
      final wasLoggedIn = previous?.value != null;
      final isLoggedIn = next.value != null;
      if (wasLoggedIn && !isLoggedIn) {
        navigatorKey.currentState?.pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    });

    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'Piko',
      theme: AppTheme.theme,
      home: const SplashScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}
