import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

// One-of-n choice drawn as joined square buttons, like the website's
// Segmented. The chosen option is filled with ink.
class Segmented<T> extends StatelessWidget {
  const Segmented({super.key, required this.options, required this.value, required this.onChanged});

  final List<(T, String)> options;
  final T value;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final textStyle = Theme.of(context).textTheme.bodyMedium!;

    return Container(
      height: 46,
      decoration: BoxDecoration(border: Border.all(color: c.n400)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, (option, label)) in options.indexed) ...[
            if (i > 0) VerticalDivider(width: 1, thickness: 1, color: c.n400),
            Expanded(
              child: Semantics(
                button: true,
                inMutuallyExclusiveGroup: true,
                selected: option == value,
                child: Material(
                  color: option == value ? c.ink : Colors.transparent,
                  child: InkWell(
                    onTap: () => onChanged(option),
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: textStyle.copyWith(
                            color: option == value ? c.paper : c.n800,
                            fontWeight: option == value ? FontWeight.w600 : FontWeight.w400,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
