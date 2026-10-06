import 'package:flutter/material.dart';

import '../models/category_option.dart';
import '../models/expense.dart';
import '../theme/app_theme.dart';
import '../theme/category_style.dart';

class ExpenseListTile extends StatelessWidget {
  final Expense expense;
  final CategoryOption? category;
  final String dateLabel;

  const ExpenseListTile({super.key, required this.expense, required this.category, required this.dateLabel});

  @override
  Widget build(BuildContext context) {
    final name = category?.name ?? 'Uncategorized';
    final style = styleFor(name);
    final subtitle = '$dateLabel${expense.note != null ? ' · ${expense.note}' : ''}';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: AppColors.textMuted.withValues(alpha: 0.08), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: style.background, shape: BoxShape.circle),
            child: Center(child: Icon(style.icon, color: style.foreground, size: 22)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
              ],
            ),
          ),
          Text(
            'NPR ${expense.amount.toStringAsFixed(0)}',
            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
        ],
      ),
    );
  }
}
