import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/pacing.dart';

void main() {
  test('Pacing.fromJson reads Safe to spend', () {
    final pacing = Pacing.fromJson({
      'carryIn': 980,
      'nextWeekAllowance': 2100.5,
      'nextWeekday': 'Sunday',
      'over': true,
      'overrunNote': 'Rent went Rs 500.00 over, taken from your spending money.',
      'safeToday': 0,
      'weekLeft': 0,
      'weeklyAllowance': 2100,
    });

    expect(pacing.safeToday, 0);
    expect(pacing.over, isTrue);
    expect(pacing.nextWeekAllowance, 2100.5);
    expect(pacing.nextWeekday, 'Sunday');
    expect(pacing.overrunNote, 'Rent went Rs 500.00 over, taken from your spending money.');
  });

  test('Pacing.fromJson allows no next weekday and no overrun note', () {
    final pacing = Pacing.fromJson({
      'nextWeekAllowance': 490,
      'nextWeekday': null,
      'over': false,
      'overrunNote': null,
      'safeToday': 78,
    });

    expect(pacing.nextWeekday, isNull);
    expect(pacing.overrunNote, isNull);
  });
}
