import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense.dart';
import 'package:piko/services/expense_list.dart';

void main() {
  Expense expense(String date, double amount, {String categoryId = 'cat-1'}) => Expense(
        id: '$date-$amount-$categoryId',
        amount: amount,
        categoryId: categoryId,
        ownerMemberId: null,
        paidByMemberId: 'mem-1',
        date: date,
        note: null,
      );

  group('groupByDay', () {
    test('groups consecutive expenses by date, newest first, with day totals', () {
      final groups = groupByDay(
        [expense('2026-10-14', 100), expense('2026-10-14', 50.5), expense('2026-10-12', 20)],
        limit: 20,
      );

      expect(groups.map((g) => g.date), ['2026-10-14', '2026-10-12']);
      expect(groups.first.expenses, hasLength(2));
      expect(groups.first.total, 150.5);
      expect(groups.last.total, 20);
    });

    test('leaves the total off the oldest day when the list is full, as it may be cut short', () {
      final groups = groupByDay([expense('2026-10-14', 100), expense('2026-10-13', 50)], limit: 2);

      expect(groups.first.total, 100);
      expect(groups.last.total, isNull);
      expect(groups.last.expenses, hasLength(1));
    });

    test('returns nothing for no expenses', () {
      expect(groupByDay([], limit: 20), isEmpty);
    });
  });

  group('dayLabel', () {
    test('says Today and Yesterday', () {
      expect(dayLabel('2026-10-14', '2026-10-14'), 'Today');
      expect(dayLabel('2026-10-13', '2026-10-14'), 'Yesterday');
    });

    test('gives the weekday for older days', () {
      expect(dayLabel('2026-10-11', '2026-10-14'), 'Sunday');
    });

    test('counts across a month end', () {
      expect(dayLabel('2026-09-30', '2026-10-01'), 'Yesterday');
    });
  });

  group('quickCategoryIds', () {
    final categories = [
      CategoryOption(id: 'a', name: 'A'),
      CategoryOption(id: 'b', name: 'B'),
      CategoryOption(id: 'c', name: 'C'),
      CategoryOption(id: 'd', name: 'D'),
    ];

    test('puts the most used first, a tie going to the more recent', () {
      final recent = [
        expense('2026-10-14', 1, categoryId: 'c'),
        expense('2026-10-14', 1, categoryId: 'b'),
        expense('2026-10-13', 1, categoryId: 'b'),
        expense('2026-10-12', 1, categoryId: 'a'),
      ];

      expect(quickCategoryIds(recent, categories, count: 3), ['b', 'c', 'a']);
    });

    test('fills up with the remaining categories in the server order', () {
      expect(quickCategoryIds([expense('2026-10-14', 1, categoryId: 'c')], categories), ['c', 'a', 'b', 'd']);
    });

    test('skips categories that no longer exist', () {
      expect(quickCategoryIds([expense('2026-10-14', 1, categoryId: 'gone')], categories, count: 2), ['a', 'b']);
    });
  });
}
