import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

// Piko's waiting mark: the red "unread" square steps across three grey ones.
// Still when the phone's animations are off.
class StepSquares extends StatefulWidget {
  const StepSquares({super.key});

  @override
  State<StepSquares> createState() => _StepSquaresState();
}

class _StepSquaresState extends State<StepSquares> with SingleTickerProviderStateMixin {
  // One step every 300ms, three steps a round.
  late final AnimationController _steps =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 900));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _steps
        ..stop()
        ..value = 0;
    } else if (!_steps.isAnimating) {
      _steps.repeat();
    }
  }

  @override
  void dispose() {
    _steps.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return Semantics(
      label: 'Loading',
      child: SizedBox(
        height: 14,
        child: AnimatedBuilder(
          animation: _steps,
          builder: (context, _) {
            final lit = (_steps.value * 3).floor() % 3;
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < 3; i++) ...[
                  if (i > 0) const SizedBox(width: 6),
                  Container(width: 7, height: 7, color: i == lit ? c.signal : c.n300),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
