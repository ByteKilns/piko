import 'package:flutter/material.dart';

import '../models/category_option.dart';
import '../models/expense.dart';
import '../models/member_option.dart';
import '../services/people.dart';
import '../theme/app_theme.dart';
import 'category_icon.dart';
import 'money_text.dart';
import 'monogram.dart';

// One row of the recent list, like a row in the website's Expenses list: the
// category's icon and name, who it was for (and who paid) with the note, and
// the amount, over a 1px rule.
class ExpenseListTile extends StatelessWidget {
  const ExpenseListTile({
    super.key,
    required this.expense,
    required this.category,
    required this.members,
    required this.currentMemberId,
  });

  final Expense expense;
  final CategoryOption? category;
  final List<MemberOption> members;
  final String? currentMemberId;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final name = category?.name ?? 'Uncategorized';
    final who = expenseWho(expense, members, currentMemberId);
    final note = expense.note?.trim() ?? '';
    // A note that only repeats the category adds nothing.
    final details = [
      if (who.label.isNotEmpty) who.label,
      if (note.isNotEmpty && note.toLowerCase() != name.toLowerCase()) note,
    ].join(' · ');

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.n300))),
      child: Row(
        children: [
          CategoryIcon(name: name, iconKey: category?.icon),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleMedium),
                const SizedBox(height: 4),
                Row(
                  children: [
                    if (who.people.isNotEmpty) ...[Monogram(people: who.people), const SizedBox(width: 6)],
                    Expanded(
                      child: Text(details, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.bodySmall),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          MoneyText(expense.amount, style: text.titleMedium),
        ],
      ),
    );
  }
}
