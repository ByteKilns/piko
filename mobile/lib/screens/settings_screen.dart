import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../esewa/captured_notifications_screen.dart';
import '../providers/auth_provider.dart';
import '../providers/esewa_provider.dart';
import '../providers/settings_provider.dart';
import '../services/bs_calendar.dart';
import '../theme/app_theme.dart';
import '../widgets/segmented.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _urlController;
  // Notification access is switched on in Android's settings, so check again
  // when the app comes back from there.
  late final AppLifecycleListener _lifecycle;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController();
    _lifecycle = AppLifecycleListener(
      onResume: () {
        ref.invalidate(esewaAccessProvider);
        ref.invalidate(esewaAlertsAllowedProvider);
      },
    );
  }

  @override
  void dispose() {
    _urlController.dispose();
    _lifecycle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final serverUrl = ref.watch(serverUrlProvider);
    final isLoggedIn = ref.watch(authProvider).value != null;
    final esewa = ref.watch(esewaServiceProvider);

    if (!_initialized && serverUrl.hasValue) {
      _urlController.text = serverUrl.value!;
      _initialized = true;
    }

    // The website's Settings page: sections under 20px headings, each row a
    // label and a line of description over its control.
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            const _SectionHeading('Appearance'),
            _SettingRow(
              title: 'Theme',
              description: 'Light, dark, or the same as the phone.',
              child: Segmented<ThemeMode>(
                key: const Key('theme-mode-toggle'),
                options: const [(ThemeMode.light, 'Light'), (ThemeMode.dark, 'Dark'), (ThemeMode.system, 'System')],
                value: ref.watch(themeModeProvider),
                onChanged: (mode) => ref.read(themeModeProvider.notifier).setMode(mode),
              ),
            ),
            const SizedBox(height: 36),
            const _SectionHeading('Dates'),
            _SettingRow(
              title: 'Calendar',
              description: 'How dates show on this phone. The website has its own setting.',
              child: Segmented<AppDateFormat>(
                key: const Key('date-format-toggle'),
                options: const [(AppDateFormat.nepali, 'BS (Nepali)'), (AppDateFormat.english, 'AD (English)')],
                value: ref.watch(dateFormatProvider),
                onChanged: (format) => ref.read(dateFormatProvider.notifier).setFormat(format),
              ),
            ),
            const SizedBox(height: 36),
            const _SectionHeading('Server'),
            _SettingRow(
              title: 'Server URL',
              description: 'The Piko website this app talks to.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(controller: _urlController, keyboardType: TextInputType.url),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () async {
                      final url = _urlController.text.trim();
                      if (url.isEmpty) return;
                      await ref.read(serverUrlProvider.notifier).setUrl(url);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Server URL saved')),
                        );
                      }
                    },
                    child: const Text('Save'),
                  ),
                ],
              ),
            ),
            if (esewa != null && esewa.isSupported) ...[
              const SizedBox(height: 36),
              const _SectionHeading('eSewa'),
              _SettingRow(
                title: 'Auto-capture',
                description: 'Lets Piko read eSewa notifications, so each payment arrives as a draft to review. '
                    'On Android 13 or later, first allow it: phone Settings → Apps → Piko → ⋮ → Allow restricted settings.',
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        ref.watch(esewaAccessProvider).valueOrNull == true ? 'On' : 'Off',
                        key: const Key('esewa-access'),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    OutlinedButton(onPressed: esewa.openAccessSettings, child: const Text('Notification access')),
                  ],
                ),
              ),
              _SettingRow(
                title: 'Draft alerts',
                description: 'A notification when an eSewa payment becomes a draft, even with Piko closed, '
                    "and when Piko can't read one.",
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        ref.watch(esewaAlertsAllowedProvider).valueOrNull == true ? 'On' : 'Off',
                        key: const Key('esewa-alerts'),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    OutlinedButton(
                      onPressed: () => ref.read(esewaAlertsProvider).request(),
                      child: const Text('Notifications'),
                    ),
                  ],
                ),
              ),
              _SettingRow(
                title: 'Captured notifications',
                description: "The latest eSewa notifications this phone saw. Copy one when a payment wasn't read right.",
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const CapturedNotificationsScreen()),
                    ),
                    child: const Text('Show'),
                  ),
                ),
              ),
            ],
            if (isLoggedIn) ...[
              const SizedBox(height: 36),
              const _SectionHeading('Account'),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  // Flush left with the headings, in the red used for destructive text.
                  style: TextButton.styleFrom(foregroundColor: c.signalInk, padding: EdgeInsets.zero),
                  onPressed: () async {
                    await ref.read(authProvider.notifier).logout();
                    if (context.mounted) Navigator.of(context).popUntil((route) => route.isFirst);
                  },
                  child: const Text('Log out'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// A 20px heading over a 2px rule.
class _SectionHeading extends StatelessWidget {
  const _SectionHeading(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: context.piko.rule, width: 2))),
      child: Text(title, style: Theme.of(context).textTheme.titleLarge),
    );
  }
}

class _SettingRow extends StatelessWidget {
  const _SettingRow({required this.title, required this.description, required this.child});

  final String title;
  final String description;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: text.titleMedium),
          const SizedBox(height: 2),
          Text(description, style: text.bodySmall),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
