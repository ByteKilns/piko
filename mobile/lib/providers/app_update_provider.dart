import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../models/app_release.dart';
import 'api_client_provider.dart';

/// `flutter build apk --split-per-abi` rewrites the Android versionCode to
/// `abi * 1000 + build` (arm64 → 2000 + build), so strip that prefix to get
/// the pubspec build number that releases are published under.
int pubspecBuildNumber(int installedVersionCode) => installedVersionCode % 1000;

/// The latest published release, or null when this install is already up to date.
/// Updates are sideloaded APKs, so this only applies on Android.
final availableUpdateProvider = FutureProvider.autoDispose<AppRelease?>((ref) async {
  if (!Platform.isAndroid) return null;

  final client = ref.watch(apiClientProvider);
  final results = await Future.wait([client.fetchLatestRelease(), PackageInfo.fromPlatform()]);
  final latest = results[0] as AppRelease?;
  final installedBuild = pubspecBuildNumber(int.tryParse((results[1] as PackageInfo).buildNumber) ?? 0);

  if (latest == null || latest.versionCode <= installedBuild) return null;
  return latest;
});
