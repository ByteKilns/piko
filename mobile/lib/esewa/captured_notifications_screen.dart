import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/capture_event.dart';
import '../providers/calendar_provider.dart';
import '../providers/esewa_provider.dart';
import '../providers/settings_provider.dart';
import '../services/bs_calendar.dart';
import '../theme/app_theme.dart';

// The latest eSewa notifications this phone saw, read or not, each with Copy:
// when a payment doesn't show up as a draft, its text here is what tunes the
// parser (lib/esewa/parser.dart and test/esewa_parser_test.dart).
class CapturedNotificationsScreen extends ConsumerWidget {
  const CapturedNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final events = ref.watch(captureEventsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Captured notifications')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(captureEventsProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Text(
              'The latest eSewa notifications this phone saw. Codes in OTP and login messages are hidden.',
              style: text.bodySmall,
            ),
            const SizedBox(height: 16),
            ...events.when(
              loading: () => [const LinearProgressIndicator()],
              error: (error, _) => [Text("Couldn't load them. Pull down to try again.", style: text.bodyMedium)],
              data: (list) => list.isEmpty
                  ? [Text('None yet.', style: text.titleLarge)]
                  : [
                      Container(height: 2, color: context.piko.ink),
                      for (final event in list) _EventRow(event: event),
                    ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EventRow extends ConsumerWidget {
  const _EventRow({required this.event});

  final CaptureEvent event;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final at = event.postedAt;
    final time = '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';
    final date = formatAppDate(formatAd(at), ref.watch(dateFormatProvider), ref.watch(bsCalendarProvider));

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.n300))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$date · $time', style: text.bodySmall),
                const SizedBox(height: 4),
                Text(event.title, style: text.titleMedium),
                const SizedBox(height: 2),
                SelectableText(event.text, style: text.bodyMedium),
              ],
            ),
          ),
          TextButton(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: event.copyText));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Copied')));
              }
            },
            child: const Text('Copy'),
          ),
        ],
      ),
    );
  }
}
