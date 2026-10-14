import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/categories_result.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense.dart';
import 'package:piko/models/expense_draft.dart';
import 'package:piko/models/member_option.dart';

void main() {
  group('Expense.fromJson', () {
    test('parses a full expense row, converting amount to double', () {
      final expense = Expense.fromJson({
        'id': 'exp-1',
        'amount': 500,
        'categoryId': 'cat-1',
        'ownerMemberId': 'mem-1',
        'paidByMemberId': 'mem-1',
        'date': '2026-09-03',
        'note': 'groceries',
      });

      expect(expense.id, 'exp-1');
      expect(expense.amount, 500.0);
      expect(expense.categoryId, 'cat-1');
      expect(expense.ownerMemberId, 'mem-1');
      expect(expense.paidByMemberId, 'mem-1');
      expect(expense.date, '2026-09-03');
      expect(expense.note, 'groceries');
    });

    test('treats a null ownerMemberId as shared and a null note as no note', () {
      final expense = Expense.fromJson({
        'id': 'exp-2',
        'amount': 250,
        'categoryId': 'cat-2',
        'ownerMemberId': null,
        'paidByMemberId': 'mem-2',
        'date': '2026-09-01',
        'note': null,
      });

      expect(expense.ownerMemberId, isNull);
      expect(expense.note, isNull);
    });
  });

  group('ExpenseDraft.toJson', () {
    test('serializes every field, including a null ownerMemberId', () {
      final draft = ExpenseDraft(
        amount: 500,
        categoryId: 'cat-1',
        ownerMemberId: null,
        paidByMemberId: 'mem-1',
        date: '2026-09-03',
        note: 'curl test',
      );

      expect(draft.toJson(), {
        'amount': 500,
        'categoryId': 'cat-1',
        'ownerMemberId': null,
        'paidByMemberId': 'mem-1',
        'date': '2026-09-03',
        'note': 'curl test',
      });
    });

    test('copyWith replaces only the given fields and can set ownerMemberId to null', () {
      final draft = ExpenseDraft(
        amount: 500,
        categoryId: 'cat-1',
        ownerMemberId: 'mem-1',
        paidByMemberId: 'mem-1',
        date: '2026-09-03',
        note: null,
      );

      final updated = draft.copyWith(amount: 750, ownerMemberId: null, ownerMemberIdSet: true);

      expect(updated.amount, 750);
      expect(updated.ownerMemberId, isNull);
      expect(updated.categoryId, 'cat-1');
      expect(updated.date, '2026-09-03');
    });

    test('omits the note key entirely when note is null (server rejects an explicit null)', () {
      final draft = ExpenseDraft(
        amount: 500,
        categoryId: 'cat-1',
        ownerMemberId: 'mem-1',
        paidByMemberId: 'mem-1',
        date: '2026-09-03',
        note: null,
      );

      final json = draft.toJson();

      expect(json.containsKey('note'), isFalse);
      expect(json['ownerMemberId'], 'mem-1');
    });
  });

  group('ExpenseDraft.blank', () {
    final members = [MemberOption(id: 'mem-1', name: 'Nirjal'), MemberOption(id: 'mem-2', name: 'Karuna')];
    final categories = [CategoryOption(id: 'cat-1', name: 'Groceries')];

    test('is for and paid by the signed-in person, dated today', () {
      final draft = ExpenseDraft.blank(
        CategoriesResult(categories: categories, members: members, currentMemberId: 'mem-2'),
        today: '2026-10-14',
      );

      expect(draft.amount, 0);
      expect(draft.categoryId, 'cat-1');
      expect(draft.ownerMemberId, 'mem-2');
      expect(draft.paidByMemberId, 'mem-2');
      expect(draft.date, '2026-10-14');
      expect(draft.note, isNull);
    });

    test('is shared and paid by the first member when the server does not say who is signed in', () {
      final draft = ExpenseDraft.blank(CategoriesResult(categories: categories, members: members), today: '2026-10-14');

      expect(draft.ownerMemberId, isNull);
      expect(draft.paidByMemberId, 'mem-1');
    });

    test('still works before categories have loaded', () {
      final draft = ExpenseDraft.blank(null, today: '2026-10-14');

      expect(draft.categoryId, '');
      expect(draft.paidByMemberId, '');
    });
  });
}
