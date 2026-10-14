import 'package:flutter/material.dart';

import '../services/money.dart';
import '../theme/app_theme.dart';
import 'labeled_field.dart';

// The big "Rs ____" field the expense sheet leads with, like the website's
// AmountInput: 40px digits over a 2px ink underline. Only digits and one
// decimal point with two places can be typed.
class AmountField extends StatelessWidget {
  const AmountField({super.key, required this.controller, this.autofocus = false, this.onChanged});

  final TextEditingController controller;
  final bool autofocus;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return LabeledField(
      label: 'Amount',
      child: Container(
        padding: const EdgeInsets.only(bottom: 6),
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.ink, width: 2))),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text('Rs', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: c.n600)),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: controller,
                autofocus: autofocus,
                onChanged: onChanged,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [AmountInputFormatter()],
                style: TextStyle(
                  fontSize: 40,
                  height: 1.1,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.8,
                  color: c.ink,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
                decoration: InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  hintText: '0.00',
                  hintStyle: TextStyle(color: c.n400),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
