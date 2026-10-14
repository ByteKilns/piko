import 'package:flutter/material.dart';

// The website's modernist palette (src/app/globals.css), light and dark.
// Widgets read it through `context.piko`, so they follow the theme mode.
@immutable
class PikoColors extends ThemeExtension<PikoColors> {
  const PikoColors({
    required this.paper,
    required this.surface,
    required this.ink,
    required this.rule,
    required this.n200,
    required this.n300,
    required this.n400,
    required this.n500,
    required this.n600,
    required this.n700,
    required this.n800,
    required this.signal,
    required this.signalInk,
    required this.signalFill,
  });

  // Page and sheet background.
  final Color paper;
  // Icon tiles, chips and the update banner.
  final Color surface;
  // Text, selected segments and the 2px rule above a list.
  final Color ink;
  // 2px rules under headings, 1px under day heads.
  final Color rule;
  // Warm neutrals: 200 progress tracks, 300 row rules, 400 field borders,
  // 500 paisa and placeholders, 600 labels, 700 secondary text, 800 body copy.
  final Color n200;
  final Color n300;
  final Color n400;
  final Color n500;
  final Color n600;
  final Color n700;
  final Color n800;
  // The one red accent, for marks: progress, today, the caret, the mic.
  final Color signal;
  // Red text: errors and Log out.
  final Color signalInk;
  // Primary buttons. The same red in both themes so white text keeps 4.5:1.
  final Color signalFill;

  static const light = PikoColors(
    paper: Color(0xFFFAF8F4),
    surface: Color(0xFFF0EDE7),
    ink: Color(0xFF201E1D),
    rule: Color(0xFF3D3936),
    n200: Color(0xFFE6E2DB),
    n300: Color(0xFFD8D3CB),
    n400: Color(0xFFB5AFA6),
    n500: Color(0xFF8F8981),
    n600: Color(0xFF6E6862),
    n700: Color(0xFF56514C),
    n800: Color(0xFF3D3936),
    signal: Color(0xFFEC3013),
    signalInk: Color(0xFFC02A10),
    signalFill: Color(0xFFEC3013),
  );

  static const dark = PikoColors(
    paper: Color(0xFF161413),
    surface: Color(0xFF22201E),
    ink: Color(0xFFF3EFE8),
    rule: Color(0xFFD3CEC6),
    n200: Color(0xFF2A2725),
    n300: Color(0xFF3A3633),
    n400: Color(0xFF57524D),
    n500: Color(0xFF7A746D),
    n600: Color(0xFF9A948C),
    n700: Color(0xFFB7B1A9),
    n800: Color(0xFFD3CEC6),
    signal: Color(0xFFFF6247),
    signalInk: Color(0xFFFF9C88),
    signalFill: Color(0xFFEC3013),
  );

  // Nothing overrides single colours; the theme only swaps whole palettes.
  @override
  PikoColors copyWith() => this;

  @override
  PikoColors lerp(PikoColors? other, double t) {
    if (other == null) return this;
    Color mix(Color a, Color b) => Color.lerp(a, b, t)!;
    return PikoColors(
      paper: mix(paper, other.paper),
      surface: mix(surface, other.surface),
      ink: mix(ink, other.ink),
      rule: mix(rule, other.rule),
      n200: mix(n200, other.n200),
      n300: mix(n300, other.n300),
      n400: mix(n400, other.n400),
      n500: mix(n500, other.n500),
      n600: mix(n600, other.n600),
      n700: mix(n700, other.n700),
      n800: mix(n800, other.n800),
      signal: mix(signal, other.signal),
      signalInk: mix(signalInk, other.signalInk),
      signalFill: mix(signalFill, other.signalFill),
    );
  }
}

extension PikoColorsContext on BuildContext {
  // Widget tests that pump a bare MaterialApp get the light palette.
  PikoColors get piko => Theme.of(this).extension<PikoColors>() ?? PikoColors.light;
}
