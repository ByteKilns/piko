import 'dart:io' show Platform;

import 'package:flutter/services.dart';

/// The screen a tapped Piko alert opens.
enum AlertTarget { review, captured }

/// Piko's own eSewa alerts, shown by DraftNotifier on the Android side: the
/// notification permission they need, which screen a tapped one opens, and
/// clearing the drafts alert once the review screen is open. Does nothing off
/// Android.
class EsewaAlerts {
  /// [supported] stands in for "running on Android" in tests.
  const EsewaAlerts({this._supported});

  static const _method = MethodChannel('finance/esewa');

  final bool? _supported;

  bool get isSupported => _supported ?? Platform.isAndroid;

  /// Whether Android lets Piko show notifications.
  Future<bool> allowed() async => isSupported && (await _method.invokeMethod<bool>('notificationsAllowed') ?? false);

  /// Android 13+: the permission prompt, only the first time.
  Future<void> askOnce() async {
    if (isSupported) await _method.invokeMethod('askNotificationsOnce');
  }

  /// The prompt if Android will still show it, else Piko's notification settings.
  Future<void> request() async {
    if (isSupported) await _method.invokeMethod('requestNotificationPermission');
  }

  /// Where the alert that opened Piko points; null when it wasn't opened from
  /// one. Each tap is handed out once.
  Future<AlertTarget?> takeOpenTarget() async {
    if (!isSupported) return null;
    final name = await _method.invokeMethod<String>('takeOpenTarget');
    return AlertTarget.values.where((t) => t.name == name).firstOrNull;
  }

  /// Removes the drafts alert and restarts its count.
  Future<void> clearDrafts() async {
    if (isSupported) await _method.invokeMethod('clearDraftAlerts');
  }
}
