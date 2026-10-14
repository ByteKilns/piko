import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/expense.dart';
import 'package:piko/models/member_option.dart';
import 'package:piko/services/people.dart';

void main() {
  final nirjal = MemberOption(id: 'mem-1', name: 'Nirjal');
  final karuna = MemberOption(id: 'mem-2', name: 'Karuna');
  final members = [nirjal, karuna];

  Expense expense({String? owner, required String paidBy}) => Expense(
        id: 'exp-1',
        amount: 100,
        categoryId: 'cat-1',
        ownerMemberId: owner,
        paidByMemberId: paidBy,
        date: '2026-10-14',
        note: null,
      );

  test('meFirst puts the signed-in person first', () {
    expect(meFirst(members, 'mem-2').map((m) => m.id), ['mem-2', 'mem-1']);
  });

  test('meFirst keeps the server order when it does not know who is signed in', () {
    expect(meFirst(members, null).map((m) => m.id), ['mem-1', 'mem-2']);
  });

  test('personLabel says Me for the signed-in person and the name otherwise', () {
    expect(personLabel(karuna, 'mem-2'), 'Me');
    expect(personLabel(nirjal, 'mem-2'), 'Nirjal');
  });

  group('expenseWho', () {
    test("leaves out who paid when it was the person's own expense", () {
      final who = expenseWho(expense(owner: 'mem-1', paidBy: 'mem-1'), members, 'mem-1');

      expect(who.label, 'Me');
      expect(who.people, [(name: 'Nirjal', isMe: true)]);
    });

    test('says who paid when someone paid for the other person', () {
      final who = expenseWho(expense(owner: 'mem-2', paidBy: 'mem-1'), members, 'mem-1');

      expect(who.label, 'Karuna · paid by Me');
      expect(who.people, [(name: 'Karuna', isMe: false)]);
    });

    test('shows both people, signed-in first, for a shared expense', () {
      final who = expenseWho(expense(paidBy: 'mem-2'), members, 'mem-1');

      expect(who.label, 'Shared · paid by Karuna');
      expect(who.people, [(name: 'Nirjal', isMe: true), (name: 'Karuna', isMe: false)]);
    });

    test('uses names when the server does not say who is signed in', () {
      final who = expenseWho(expense(paidBy: 'mem-1'), members, null);

      expect(who.label, 'Shared · paid by Nirjal');
      expect(who.people.every((p) => !p.isMe), isTrue);
    });
  });
}
