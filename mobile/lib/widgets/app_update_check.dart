import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/app_update_provider.dart';
import '../theme/app_theme.dart';
import 'app_update_sheet.dart';
import 'step_squares.dart';

// Settings' App row: this install's version and a way to look for a newer
// one now, rather than waiting for Piko to check on its own. A newer one
// found here also shows on Home, since both read the same check.
class AppUpdateCheck extends ConsumerStatefulWidget {
  const AppUpdateCheck({super.key});

  @override
  ConsumerState<AppUpdateCheck> createState() => _AppUpdateCheckState();
}

class _AppUpdateCheckState extends ConsumerState<AppUpdateCheck> {
  // Up to date and couldn't check only answer a tap, so they wait for one.
  bool _asked = false;

  void _check() {
    setState(() => _asked = true);
    ref.invalidate(availableUpdateProvider);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final version = ref.watch(installedVersionProvider).valueOrNull;
    final update = ref.watch(availableUpdateProvider);
    final checking = _asked && update.isLoading;

    final Widget? status;
    if (checking) {
      status = const StepSquares();
    } else if (update.hasError) {
      status = _asked ? Text("Couldn't check. Try again.", style: text.bodyMedium!.copyWith(color: c.signalInk)) : null;
    } else if (update.valueOrNull case final release?) {
      status = Row(
        children: [
          Expanded(child: Text('Piko ${release.versionName} is available', style: text.titleMedium)),
          FilledButton(onPressed: () => showAppUpdateSheet(context, release), child: const Text('Update')),
        ],
      );
    } else {
      status = _asked && update.hasValue ? Text("You're up to date", style: text.bodyMedium) : null;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text(version == null ? 'Version' : 'Version $version', style: text.titleMedium)),
            OutlinedButton(onPressed: checking ? null : _check, child: const Text('Check for updates')),
          ],
        ),
        AnimatedSize(
          duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          alignment: Alignment.topLeft,
          child: status == null
              ? const SizedBox(width: double.infinity)
              : Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Align(alignment: Alignment.centerLeft, child: status),
                ),
        ),
      ],
    );
  }
}
