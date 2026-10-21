import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/pacing.dart';
import '../services/money.dart';
import '../theme/app_theme.dart';
import 'money_text.dart';
import 'step_squares.dart';

// The top of Home: "Safe to spend today", the website's Home hero. The
// stepping squares while it first loads; afterwards a refresh keeps the last
// figure and cross-fades the new one in. Hidden if it never loaded.
class SafeToSpendHero extends StatelessWidget {
  const SafeToSpendHero({super.key, required this.pacing});

  final AsyncValue<Pacing?> pacing;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;

    if (!pacing.hasValue) {
      if (pacing.hasError) return const SizedBox.shrink();
      return const Padding(
        padding: EdgeInsets.only(bottom: 20),
        child: Align(alignment: Alignment.centerLeft, child: StepSquares()),
      );
    }

    final value = pacing.value;
    if (value == null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: Text(
          "Mark budget lines as Can cut on the website's Budget page to see what's safe to spend each day.",
          style: text.bodySmall,
        ),
      );
    }
    return Padding(padding: const EdgeInsets.only(bottom: 24), child: _Figure(pacing: value));
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.pacing});

  final Pacing pacing;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final still = MediaQuery.disableAnimationsOf(context);
    final statusColor = pacing.over ? c.signalInk : c.ink;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('SAFE TO SPEND TODAY', style: text.labelSmall),
            const SizedBox(width: 14),
            Container(width: 6, height: 6, color: pacing.over ? c.signal : c.ink),
            const SizedBox(width: 6),
            Text(
              pacing.over ? 'Over budget' : 'On track',
              style: text.bodySmall!.copyWith(color: statusColor, fontWeight: FontWeight.w600),
            ),
          ],
        ),
        const SizedBox(height: 10),
        // A new figure cross-fades in rather than flipping.
        AnimatedSwitcher(
          duration: still ? Duration.zero : const Duration(milliseconds: 200),
          layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
          child: Row(
            key: ValueKey(pacing.safeToday),
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text('Rs ', style: text.headlineLarge),
              MoneyText(pacing.safeToday, style: text.displaySmall),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Text(
          pacing.over
              ? "This week's allowance is fully spent. A new weekly allowance of ${formatRupees(pacing.nextWeekAllowance)} "
                  'starts on ${pacing.nextWeekday ?? 'the next week'}.'
              : 'Spend up to this today on things you can cut and the week stays on plan.',
          style: text.bodyMedium,
        ),
        if (pacing.overrunNote case final note?) ...[
          const SizedBox(height: 6),
          Text(note, style: text.bodySmall!.copyWith(color: c.signalInk)),
        ],
      ],
    );
  }
}
