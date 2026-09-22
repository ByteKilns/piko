import 'package:flutter_test/flutter_test.dart';
import 'package:piko/providers/app_update_provider.dart';

void main() {
  test('pubspecBuildNumber strips the split-per-abi prefix', () {
    expect(pubspecBuildNumber(2002), 2); // arm64-v8a
    expect(pubspecBuildNumber(1002), 2); // armeabi-v7a
    expect(pubspecBuildNumber(4015), 15); // x86_64
  });

  test('pubspecBuildNumber leaves universal APK build numbers alone', () {
    expect(pubspecBuildNumber(1), 1);
    expect(pubspecBuildNumber(42), 42);
  });
}
