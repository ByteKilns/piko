import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/theme/app_theme.dart';

void main() {
  test('the light theme carries the light palette on paper', () {
    final theme = AppTheme.light;

    expect(theme.brightness, Brightness.light);
    expect(theme.extension<PikoColors>(), PikoColors.light);
    expect(theme.scaffoldBackgroundColor, PikoColors.light.paper);
  });

  test('the dark theme carries the dark palette', () {
    final theme = AppTheme.dark;

    expect(theme.brightness, Brightness.dark);
    expect(theme.extension<PikoColors>(), PikoColors.dark);
    expect(theme.colorScheme.onSurface, PikoColors.dark.ink);
  });

  test('primary buttons are the same red in both themes', () {
    expect(PikoColors.light.signalFill, PikoColors.dark.signalFill);
  });
}
