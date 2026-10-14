import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ota_update/ota_update.dart';

import '../models/app_release.dart';
import '../theme/app_theme.dart';
import 'sheet_frame.dart';

Future<void> showAppUpdateSheet(BuildContext context, AppRelease release) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => AppUpdateSheet(release: release),
  );
}

/// Tappable strip telling the user a newer build is available.
class AppUpdateBanner extends StatelessWidget {
  const AppUpdateBanner({super.key, required this.release});

  final AppRelease release;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return Material(
      color: c.surface,
      child: InkWell(
        onTap: () => showAppUpdateSheet(context, release),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 4, 4, 4),
          child: Row(
            children: [
              // The red square the website uses for anything unread.
              Container(width: 8, height: 8, color: c.signal),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Update available — v${release.versionName}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              TextButton(
                onPressed: () => showAppUpdateSheet(context, release),
                child: const Text('Update'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AppUpdateSheet extends StatefulWidget {
  const AppUpdateSheet({super.key, required this.release});

  final AppRelease release;

  @override
  State<AppUpdateSheet> createState() => _AppUpdateSheetState();
}

class _AppUpdateSheetState extends State<AppUpdateSheet> {
  StreamSubscription<OtaEvent>? _subscription;
  double? _progress;
  bool _installing = false;
  String? _error;

  bool get _busy => _progress != null && _error == null;

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  void _startUpdate() {
    setState(() {
      _progress = 0;
      _installing = false;
      _error = null;
    });

    try {
      _subscription = OtaUpdate()
          .execute(
            widget.release.apkUrl,
            destinationFilename: 'piko-${widget.release.versionName}.apk',
            sha256checksum: widget.release.sha256,
          )
          .listen(_onEvent, onError: (Object e) => _fail('Update failed: $e'));
    } catch (e) {
      _fail('Update failed: $e');
    }
  }

  void _onEvent(OtaEvent event) {
    if (!mounted) return;
    switch (event.status) {
      case OtaStatus.DOWNLOADING:
        setState(() => _progress = (double.tryParse(event.value ?? '') ?? 0) / 100);
      case OtaStatus.INSTALLING:
      case OtaStatus.INSTALLATION_DONE:
        setState(() {
          _progress = 1;
          _installing = true;
        });
      case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
        _fail('Allow Piko to install apps (Settings → Install unknown apps), then try again.');
      case OtaStatus.CHECKSUM_ERROR:
        _fail('The download was corrupted — please try again.');
      case OtaStatus.ALREADY_RUNNING_ERROR:
        _fail('An update is already downloading.');
      default:
        _fail('Update failed${event.value == null ? '' : ': ${event.value}'}');
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    setState(() => _error = message);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final release = widget.release;
    final sizeMb = (release.sizeBytes / (1024 * 1024)).toStringAsFixed(1);

    return SheetFrame(
      title: 'Piko v${release.versionName}',
      footer: _busy
          // The installer is a separate system screen; if it's dismissed there's no event, so offer a way out.
          ? (_installing
              ? Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
                )
              : null)
          : Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _startUpdate,
                    child: Text(_error == null ? 'Update now' : 'Try again'),
                  ),
                ),
                const SizedBox(width: 12),
                OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Later')),
              ],
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('UPDATE AVAILABLE · $sizeMb MB', style: text.labelSmall),
          if (release.notes != null && release.notes!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(release.notes!, style: text.bodyMedium),
          ],
          if (_busy) ...[
            const SizedBox(height: 20),
            LinearProgressIndicator(value: _installing ? null : _progress),
            const SizedBox(height: 8),
            Text(
              _installing ? 'Follow the prompt to install the update.' : 'Downloading… ${((_progress ?? 0) * 100).round()}%',
              style: text.bodySmall,
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: text.bodyMedium!.copyWith(color: c.signalInk)),
          ],
        ],
      ),
    );
  }
}
