import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/app_release.dart';

void main() {
  test('AppRelease.fromJson parses a release', () {
    final release = AppRelease.fromJson({
      'apkUrl': 'https://x.public.blob.vercel-storage.com/app-releases/piko-1.1.0.apk',
      'notes': 'Faster voice capture',
      'sha256': 'a' * 64,
      'sizeBytes': 21000000,
      'versionCode': 2,
      'versionName': '1.1.0',
    });

    expect(release.versionCode, 2);
    expect(release.versionName, '1.1.0');
    expect(release.notes, 'Faster voice capture');
    expect(release.sizeBytes, 21000000);
  });

  test('AppRelease.fromJson allows missing notes', () {
    final release = AppRelease.fromJson({
      'apkUrl': 'https://x.public.blob.vercel-storage.com/a.apk',
      'notes': null,
      'sha256': 'b' * 64,
      'sizeBytes': 1,
      'versionCode': 3,
      'versionName': '1.2.0',
    });

    expect(release.notes, isNull);
  });
}
