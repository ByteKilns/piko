import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'piko_colors.dart';

export 'piko_colors.dart';

// Legacy purple palette, still read by screens that haven't moved to
// `context.piko` yet. Removed once the last one has.
class AppColors {
  AppColors._();

  static const background = Color(0xFFF5F1FA);
  static const surface = Color(0xFFFFFFFF);
  static const primary = Color(0xFF5B3FA6);
  static const textPrimary = Color(0xFF1A1625);
  static const textMuted = Color(0xFF8A8398);
  static const accentLight = Color(0xFFF3E8FF);
  static const accentLightForeground = Color(0xFF7C3AED);
}

class AppTheme {
  AppTheme._();

  static const font = 'HostGrotesk';

  // Legacy text styles, removed with AppColors.
  static const eyebrow = TextStyle(fontWeight: FontWeight.w600, fontSize: 12, letterSpacing: 1.5, color: AppColors.textMuted);
  static const headline = TextStyle(fontWeight: FontWeight.w800, fontSize: 32, color: AppColors.textPrimary, height: 1.15);
  static const wordmark = TextStyle(fontWeight: FontWeight.w800, fontSize: 32, color: AppColors.textPrimary);
  static const sectionHeading = TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: AppColors.textPrimary);
  static const subtitle = TextStyle(fontSize: 15, color: AppColors.textMuted);

  static ThemeData get light => _build(PikoColors.light, Brightness.light);
  static ThemeData get dark => _build(PikoColors.dark, Brightness.dark);

  static ThemeData _build(PikoColors c, Brightness brightness) {
    const square = RoundedRectangleBorder();
    const buttonText = TextStyle(fontFamily: font, fontSize: 15, fontWeight: FontWeight.w600);
    final tint = c.ink.withValues(alpha: 0.06);

    OutlineInputBorder fieldBorder(Color color, [double width = 1]) =>
        OutlineInputBorder(borderRadius: BorderRadius.zero, borderSide: BorderSide(color: color, width: width));

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      fontFamily: font,
      extensions: [c],
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: c.ink,
        onPrimary: c.paper,
        primaryContainer: c.surface,
        onPrimaryContainer: c.ink,
        secondary: c.ink,
        onSecondary: c.paper,
        secondaryContainer: c.surface,
        onSecondaryContainer: c.ink,
        error: c.signalInk,
        onError: c.paper,
        surface: c.paper,
        onSurface: c.ink,
        onSurfaceVariant: c.n600,
        surfaceContainerLowest: c.paper,
        surfaceContainerLow: c.paper,
        surfaceContainer: c.paper,
        surfaceContainerHigh: c.paper,
        surfaceContainerHighest: c.surface,
        surfaceTint: Colors.transparent,
        outline: c.n400,
        outlineVariant: c.n300,
        inverseSurface: c.ink,
        onInverseSurface: c.paper,
      ),
      scaffoldBackgroundColor: c.paper,
      canvasColor: c.paper,
      splashColor: tint,
      highlightColor: tint,
      // Type scale from the web: 32/800 page titles, 20/800 headings, 15/600
      // row titles, 13 meta, 11/600 uppercase micro-labels.
      textTheme: TextTheme(
        displaySmall: TextStyle(fontSize: 42, height: 1, fontWeight: FontWeight.w800, letterSpacing: -0.84, color: c.ink),
        headlineLarge: TextStyle(fontSize: 32, height: 1.05, fontWeight: FontWeight.w800, letterSpacing: -0.64, color: c.ink),
        titleLarge: TextStyle(fontSize: 20, height: 1.2, fontWeight: FontWeight.w800, letterSpacing: -0.2, color: c.ink),
        titleMedium: TextStyle(fontSize: 15, height: 1.3, fontWeight: FontWeight.w600, color: c.ink),
        bodyLarge: TextStyle(fontSize: 15, height: 1.4, color: c.ink),
        bodyMedium: TextStyle(fontSize: 14, height: 1.4, color: c.n800),
        bodySmall: TextStyle(fontSize: 13, height: 1.35, color: c.n600),
        labelLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.ink),
        labelMedium: TextStyle(fontSize: 12, color: c.n700),
        labelSmall: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.88, color: c.n600),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: c.paper,
        foregroundColor: c.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: font, fontSize: 17, fontWeight: FontWeight.w800, color: c.ink),
        // Dark status-bar icons on paper, light ones in dark mode.
        systemOverlayStyle: brightness == Brightness.light ? SystemUiOverlayStyle.dark : SystemUiOverlayStyle.light,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: c.signalFill,
          foregroundColor: Colors.white,
          disabledBackgroundColor: c.n200,
          disabledForegroundColor: c.n500,
          minimumSize: const Size(64, 52),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          shape: square,
          textStyle: buttonText,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: c.ink,
          side: BorderSide(color: c.ink),
          minimumSize: const Size(64, 52),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          shape: square,
          textStyle: buttonText,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.ink,
          minimumSize: const Size(48, 44),
          shape: square,
          textStyle: buttonText,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(foregroundColor: c.ink, shape: square)),
      inputDecorationTheme: InputDecorationTheme(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        border: fieldBorder(c.n400),
        enabledBorder: fieldBorder(c.n400),
        focusedBorder: fieldBorder(c.signal, 1.5),
        errorBorder: fieldBorder(c.signalInk),
        focusedErrorBorder: fieldBorder(c.signalInk, 1.5),
        hintStyle: TextStyle(color: c.n500),
        errorStyle: TextStyle(color: c.signalInk, fontSize: 13),
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: c.signal,
        selectionColor: c.signal.withValues(alpha: 0.25),
        selectionHandleColor: c.signal,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: c.signal,
        linearTrackColor: c.n200,
        linearMinHeight: 2,
        refreshBackgroundColor: c.paper,
      ),
      dividerTheme: DividerThemeData(color: c.n300, thickness: 1, space: 1),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: c.ink,
        contentTextStyle: TextStyle(fontFamily: font, fontSize: 14, color: c.paper),
        actionTextColor: c.paper,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.paper,
        modalBackgroundColor: c.paper,
        surfaceTintColor: Colors.transparent,
        shape: square,
      ),
      dialogTheme: DialogThemeData(backgroundColor: c.paper, surfaceTintColor: Colors.transparent, shape: square),
      datePickerTheme: DatePickerThemeData(
        backgroundColor: c.paper,
        surfaceTintColor: Colors.transparent,
        shape: square,
        headerBackgroundColor: c.paper,
        headerForegroundColor: c.ink,
        dayShape: const WidgetStatePropertyAll(square),
        dayBackgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.ink : null),
        dayForegroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? c.paper : (s.contains(WidgetState.disabled) ? c.n400 : c.ink),
        ),
        todayBackgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.ink : null),
        todayForegroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.paper : c.ink),
        todayBorder: BorderSide(color: c.signal, width: 1.5),
        yearShape: const WidgetStatePropertyAll(square),
      ),
    );
  }
}
