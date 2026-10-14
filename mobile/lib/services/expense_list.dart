import '../models/category_option.dart';
import '../models/expense.dart';

class DayGroup {
  DayGroup(this.date, this.expenses, {this.complete = true});

  // "YYYY-MM-DD" (AD), as the API sends it.
  final String date;
  final List<Expense> expenses;
  // False when the list may have cut this day short, so its total would be wrong.
  final bool complete;

  double? get total => complete ? expenses.fold<double>(0, (sum, e) => sum + e.amount) : null;
}

// Groups the recent list by day, newest first, as the website's Expenses list
// does. The API sends at most [limit] expenses, newest first, so when the list
// is full the oldest day may be missing some and is marked incomplete.
List<DayGroup> groupByDay(List<Expense> expenses, {required int limit}) {
  final groups = <DayGroup>[];
  for (final expense in expenses) {
    if (groups.isNotEmpty && groups.last.date == expense.date) {
      groups.last.expenses.add(expense);
    } else {
      groups.add(DayGroup(expense.date, [expense]));
    }
  }
  if (groups.isNotEmpty && expenses.length >= limit) {
    groups.add(DayGroup(groups.last.date, groups.removeLast().expenses, complete: false));
  }
  return groups;
}

const _weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// "Today", "Yesterday", else the weekday — the date itself sits next to it.
String dayLabel(String ad, String todayAd) {
  final day = _utcDay(ad);
  final daysAgo = _utcDay(todayAd).difference(day).inDays;
  if (daysAgo == 0) return 'Today';
  if (daysAgo == 1) return 'Yesterday';
  return _weekdays[day.weekday - 1];
}

DateTime _utcDay(String ad) {
  final parts = ad.split('-').map(int.parse).toList();
  return DateTime.utc(parts[0], parts[1], parts[2]);
}

// Up to [count] categories for the expense sheet's one-tap chips: the most
// used in the recent list (a tie goes to the more recent), then the rest in
// the server's order.
List<String> quickCategoryIds(List<Expense> recent, List<CategoryOption> categories, {int count = 5}) {
  final known = {for (final category in categories) category.id};
  final uses = <String, int>{};
  for (final expense in recent) {
    if (known.contains(expense.categoryId)) uses[expense.categoryId] = (uses[expense.categoryId] ?? 0) + 1;
  }
  // Map keys keep first-seen order, which is most recent first.
  final firstSeen = uses.keys.toList();
  final used = [...firstSeen]..sort((a, b) {
      final byUses = uses[b]!.compareTo(uses[a]!);
      return byUses != 0 ? byUses : firstSeen.indexOf(a).compareTo(firstSeen.indexOf(b));
    });
  return [...used, ...categories.map((c) => c.id).where((id) => !uses.containsKey(id))].take(count).toList();
}
