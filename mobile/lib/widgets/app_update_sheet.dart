import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ota_update/ota_update.dart';

import '../models/app_release.dart';
import '../theme/app_theme.dart';

Future<void> showAppUpdateSheet(BuildContext context, AppRelease release) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (_) => AppUpdateSheet(release: release),
  );
}

/// Tappable card telling the user a newer build is available.
class AppUpdateBanner extends StatelessWidget {
  const AppUpdateBanner({super.key, required this.release});

  final AppRelease release;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.accentLight,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => showAppUpdateSheet(context, release),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
          child: Row(
            children: [
              const Icon(Icons.system_update, color: AppColors.accentLightForeground),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Update available — v${release.versionName}',
                  style: const TextStyle(fontWeight: FontWeight.w500, color: AppColors.textPrimary),
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
    final release = widget.release;
    final sizeMb = (release.sizeBytes / (1024 * 1024)).toStringAsFixed(1);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('UPDATE AVAILABLE', style: AppTheme.eyebrow),
            const SizedBox(height: 4),
            Text('Piko v${release.versionName}', style: AppTheme.sectionHeading),
            const SizedBox(height: 4),
            Text('$sizeMb MB', style: AppTheme.subtitle),
            if (release.notes != null && release.notes!.isNotEmpty) ...[
              const SizedBox(height: 16),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 200),
                child: SingleChildScrollView(child: Text(release.notes!)),
              ),
            ],
            const SizedBox(height: 24),
            if (_busy) ...[
              LinearProgressIndicator(value: _installing ? null : _progress, color: AppColors.primary),
              const SizedBox(height: 8),
              Text(
                _installing
                    ? 'Follow the prompt to install the update.'
                    : 'Downloading… ${((_progress ?? 0) * 100).round()}%',
                style: AppTheme.subtitle,
              ),
              // The installer is a separate system screen; if it's dismissed there's no event, so offer a way out.
              if (_installing)
                TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
            ] else ...[
              if (_error != null) ...[
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                const SizedBox(height: 12),
              ],
              FilledButton(
                onPressed: _startUpdate,
                child: Text(_error == null ? 'Update now' : 'Try again'),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Later'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
