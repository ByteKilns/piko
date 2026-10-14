import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

// The website's dialog layout (its Modal) for bottom sheets: the title and a
// close button over a 2px rule, a scrolling body, and an optional footer
// above a 1px rule with the main action first.
class SheetFrame extends StatelessWidget {
  const SheetFrame({super.key, required this.title, required this.child, this.footer});

  final String title;
  final Widget child;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 8, 8, 8),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.rule, width: 2))),
            child: Row(
              children: [
                Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
                IconButton(
                  tooltip: 'Close',
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
              ],
            ),
          ),
          Flexible(
            child: SingleChildScrollView(padding: const EdgeInsets.all(20), child: child),
          ),
          if (footer != null)
            Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: c.n300))),
              child: footer,
            ),
        ],
      ),
    );
  }
}
