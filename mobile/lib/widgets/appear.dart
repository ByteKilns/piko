import 'package:flutter/material.dart';

// Unfolds and fades [child] in the first time it's built, after [delay], so
// a new row slides the ones below it down instead of appearing all at once.
// Give it a key that stays the same while the row is the same row: a rebuilt
// row keeps its state and doesn't animate again. Instant when the phone's
// animations are off.
class Appear extends StatefulWidget {
  const Appear({super.key, this.delay = Duration.zero, required this.child});

  final Duration delay;
  final Widget child;

  @override
  State<Appear> createState() => _AppearState();
}

class _AppearState extends State<Appear> with SingleTickerProviderStateMixin {
  static const _length = Duration(milliseconds: 280);

  late final AnimationController _controller =
      AnimationController(vsync: this, duration: widget.delay + _length);
  // The delay is the start of the run, so no timer outlives the row.
  late final Animation<double> _shown = CurvedAnimation(
    parent: _controller,
    curve: Interval(widget.delay.inMicroseconds / (widget.delay + _length).inMicroseconds, 1, curve: Curves.easeOutCubic),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_controller.isAnimating || _controller.isCompleted) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.value = 1;
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizeTransition(
      sizeFactor: _shown,
      alignment: Alignment.topCenter,
      child: FadeTransition(opacity: _shown, child: widget.child),
    );
  }
}
