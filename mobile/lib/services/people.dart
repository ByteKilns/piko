import '../models/expense.dart';
import '../models/member_option.dart';

// The signed-in person first, then the other, as the website lists people.
List<MemberOption> meFirst(List<MemberOption> members, String? currentMemberId) => [
      ...members.where((m) => m.id == currentMemberId),
      ...members.where((m) => m.id != currentMemberId),
    ];

String personLabel(MemberOption member, String? currentMemberId) =>
    member.id == currentMemberId ? 'Me' : member.name;

// Who an expense was for and who paid it, for a list row: the monogram badges
// and a line like "Me", "Karuna · paid by Me" or "Shared · paid by Karuna".
// "paid by" only shows when it isn't the person the expense was for.
({List<({String name, bool isMe})> people, String label}) expenseWho(
  Expense expense,
  List<MemberOption> members,
  String? currentMemberId,
) {
  MemberOption? find(String? id) => members.where((m) => m.id == id).firstOrNull;
  final owner = find(expense.ownerMemberId);
  final payer = find(expense.paidByMemberId);
  final forWhom = expense.ownerMemberId == null ? meFirst(members, currentMemberId) : [?owner];

  final parts = [
    if (expense.ownerMemberId == null) 'Shared' else if (owner != null) personLabel(owner, currentMemberId),
    if (payer != null && payer.id != expense.ownerMemberId) 'paid by ${personLabel(payer, currentMemberId)}',
  ];
  return (
    people: [for (final m in forWhom) (name: m.name, isMe: m.id == currentMemberId)],
    label: parts.join(' · '),
  );
}
