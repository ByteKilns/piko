import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/services/money.dart';

void main() {
  group('splitAmount', () {
    test('groups rupees with commas and keeps two-digit paisa', () {
      expect(splitAmount(179291.88), (integer: '179,291', decimals: '.88', negative: false));
    });

    test('pads whole amounts with .00', () {
      expect(splitAmount(512), (integer: '512', decimals: '.00', negative: false));
    });

    test('rounds to the nearest paisa', () {
      expect(splitAmount(2974.199), (integer: '2,974', decimals: '.20', negative: false));
    });

    test('flags negatives and keeps the sign out of the digits', () {
      expect(splitAmount(-23691.88), (integer: '23,691', decimals: '.88', negative: true));
    });

    test('never shows a negative zero', () {
      expect(splitAmount(-0.004), (integer: '0', decimals: '.00', negative: false));
    });

    test('shows zero for non-finite input', () {
      expect(splitAmount(double.nan), (integer: '0', decimals: '.00', negative: false));
      expect(splitAmount(double.infinity), (integer: '0', decimals: '.00', negative: false));
    });

    test('groups millions', () {
      expect(splitAmount(1234567).integer, '1,234,567');
    });
  });

  group('sanitizeAmountInput', () {
    test('drops currency text and thousands separators from pasted amounts', () {
      expect(sanitizeAmountInput('Rs 1,500.50'), '1500.50');
      expect(sanitizeAmountInput('Rs.1500'), '1500');
      expect(sanitizeAmountInput('रु 200'), '200');
    });

    test('keeps only the first decimal point', () {
      expect(sanitizeAmountInput('1.2.3'), '1.23');
    });

    test('limits paisa to two places', () {
      expect(sanitizeAmountInput('12.345'), '12.34');
    });

    test('drops a minus sign', () {
      expect(sanitizeAmountInput('-5'), '5');
    });

    test('lets a point be typed first or last', () {
      expect(sanitizeAmountInput('.5'), '.5');
      expect(sanitizeAmountInput('12.'), '12.');
    });

    test('returns empty when there is no number', () {
      expect(sanitizeAmountInput('abc'), '');
    });
  });

  test('AmountInputFormatter applies sanitizeAmountInput and moves the caret to the end', () {
    final result = AmountInputFormatter().formatEditUpdate(
      TextEditingValue.empty,
      const TextEditingValue(text: '1.2.3', selection: TextSelection.collapsed(offset: 5)),
    );

    expect(result.text, '1.23');
    expect(result.selection, const TextSelection.collapsed(offset: 4));
  });
}
