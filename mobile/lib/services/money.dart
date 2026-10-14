import 'package:flutter/services.dart';

// Dart port of the website's money helpers (src/lib/money.ts).

typedef AmountParts = ({String integer, String decimals, bool negative});

// Grouped rupees and two-digit paisa, e.g. 1234.5 -> ("1,234", ".50").
AmountParts splitAmount(double value) {
  // Work in whole paisa so -0.004 rounds to 0 (not "-0.00") and NaN/Infinity
  // from bad data show as 0.00 instead of leaking into the UI.
  final paisa = value.isFinite ? (value * 100).round() : 0;
  final fixed = (paisa.abs() / 100).toStringAsFixed(2).split('.');
  return (integer: _group(fixed[0]), decimals: '.${fixed[1]}', negative: paisa < 0);
}

String _group(String digits) => digits.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');

// "Rs", "NPR", "रु"/"रू" with an optional abbreviation dot — removed before
// cleaning so that dot is never read as the decimal point ("Rs.1500").
final _currencyToken = RegExp(r'(?:rs|npr|रु|रू)\.?', caseSensitive: false, unicode: true);

// Keeps what someone types or pastes into an amount field to digits and one
// decimal point with at most two places; everything else is dropped.
String sanitizeAmountInput(String raw) {
  final withoutCurrency = raw.replaceAll(_currencyToken, '');
  final start = withoutCurrency.indexOf(RegExp(r'\d|\.(?=\d|$)'));
  if (start == -1) return '';
  final cleaned = withoutCurrency.substring(start).replaceAll(RegExp(r'[^\d.]'), '');
  final dot = cleaned.indexOf('.');
  if (dot == -1) return cleaned;
  final fraction = cleaned.substring(dot + 1).replaceAll('.', '');
  return '${cleaned.substring(0, dot)}.${fraction.length > 2 ? fraction.substring(0, 2) : fraction}';
}

class AmountInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final text = sanitizeAmountInput(newValue.text);
    if (text == newValue.text) return newValue;
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}
