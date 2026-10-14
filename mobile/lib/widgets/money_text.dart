import 'package:flutter/material.dart';

import '../services/money.dart';
import '../theme/app_theme.dart';

// An amount set the website's way (its Money component): grouped rupees in
// the given style, then smaller, lighter paisa. Digits are tabular so
// amounts line up down a list.
class MoneyText extends StatelessWidget {
  const MoneyText(this.value, {super.key, this.style});

  final double value;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final parts = splitAmount(value);
    final base = (style ?? DefaultTextStyle.of(context).style).copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    return Text.rich(
      TextSpan(
        style: base,
        children: [
          TextSpan(text: '${parts.negative ? '−' : ''}${parts.integer}'),
          TextSpan(
            text: parts.decimals,
            style: TextStyle(color: c.n500, fontWeight: FontWeight.w400),
          ),
        ],
      ),
      maxLines: 1,
      softWrap: false,
    );
  }
}
