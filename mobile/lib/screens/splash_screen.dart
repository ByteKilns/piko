import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/brand_mark.dart';
import 'home_screen.dart';
import 'login_screen.dart';

class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final serverUrl = ref.watch(serverUrlProvider);
    final auth = ref.watch(authProvider);

    if (serverUrl.isLoading || auth.isLoading) {
      return const Scaffold(body: Center(child: BrandMark(size: 40)));
    }

    if (serverUrl.hasError || auth.hasError) {
      return const LoginScreen();
    }

    final token = auth.value;
    if (token == null || token.isEmpty) {
      return const LoginScreen();
    }
    return const HomeScreen();
  }
}
