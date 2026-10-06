// mobile/lib/screens/settings_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import '../services/bs_calendar.dart';
import '../theme/app_theme.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _urlController;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController();
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final serverUrl = ref.watch(serverUrlProvider);
    final isLoggedIn = ref.watch(authProvider).value != null;

    if (!_initialized && serverUrl.hasValue) {
      _urlController.text = serverUrl.value!;
      _initialized = true;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('SERVER', style: AppTheme.eyebrow),
              const SizedBox(height: 12),
              TextField(
                controller: _urlController,
                decoration: const InputDecoration(labelText: 'Server URL'),
                keyboardType: TextInputType.url,
              ),
              const SizedBox(height: 16),
              FilledButton(
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
              const SizedBox(height: 40),
              const Text('DATE FORMAT', style: AppTheme.eyebrow),
              const SizedBox(height: 12),
              SegmentedButton<AppDateFormat>(
                key: const Key('date-format-toggle'),
                segments: const [
                  ButtonSegment(value: AppDateFormat.nepali, label: Text('BS (Nepali)')),
                  ButtonSegment(value: AppDateFormat.english, label: Text('AD (English)')),
                ],
                selected: {ref.watch(dateFormatProvider)},
                onSelectionChanged: (selection) => ref.read(dateFormatProvider.notifier).setFormat(selection.first),
              ),
              if (isLoggedIn) ...[
                const SizedBox(height: 40),
                const Text('ACCOUNT', style: AppTheme.eyebrow),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () async {
                    await ref.read(authProvider.notifier).logout();
                    if (context.mounted) Navigator.of(context).popUntil((route) => route.isFirst);
                  },
                  child: const Text('Log out'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
