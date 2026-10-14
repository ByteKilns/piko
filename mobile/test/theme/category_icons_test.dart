import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/theme/category_icons.dart';

void main() {
  group('categoryIconFor', () {
    test("uses the category's own icon key over its name", () {
      expect(categoryIconFor('Lunch', 'wifi'), Icons.wifi);
    });

    test('falls back to a receipt for an icon key it does not know', () {
      expect(categoryIconFor('Lunch', 'rocket'), Icons.receipt_long_outlined);
    });

    test('guesses from the name, case-insensitively, when there is no key', () {
      expect(categoryIconFor('Lunch & Tea', null), Icons.restaurant_outlined);
      expect(categoryIconFor('PETROL', null), Icons.local_gas_station_outlined);
    });

    test('checks keywords in order, so clothes win over shopping', () {
      expect(categoryIconFor('Clothes shopping', null), Icons.checkroom_outlined);
      expect(categoryIconFor('Shopping', null), Icons.shopping_bag_outlined);
    });

    test('falls back to a tag for an unmatched name', () {
      expect(categoryIconFor('Miscellaneous', null), Icons.sell_outlined);
    });
  });
}
