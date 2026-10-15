import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

// Home's strip for eSewa payments waiting for review, in the update strip's
// style: the red square for anything unread, a line, and Review.
class EsewaReviewBanner extends StatelessWidget {
  const EsewaReviewBanner({super.key, required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return Material(
      color: c.surface,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 4, 4, 4),
          child: Row(
            children: [
              Container(width: 8, height: 8, color: c.signal),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  count == 1 ? '1 eSewa payment to review' : '$count eSewa payments to review',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              TextButton(onPressed: onTap, child: const Text('Review')),
            ],
          ),
        ),
      ),
    );
  }
}
