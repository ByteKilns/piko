import 'package:flutter/material.dart';

import 'esewa_review_banner.dart';
import 'step_squares.dart';

// Home's eSewa slot: the stepping squares while Piko checks for drafts, the
// review banner once there are some, nothing otherwise. Changes unfold and
// fold, so the list below slides instead of jumping.
class EsewaDraftStrip extends StatelessWidget {
  const EsewaDraftStrip({super.key, required this.checking, required this.count, required this.onTap});

  final bool checking;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    final Widget child;
    if (count > 0) {
      child = Padding(
        key: const ValueKey('banner'),
        padding: const EdgeInsets.only(bottom: 20),
        child: EsewaReviewBanner(count: count, onTap: onTap),
      );
    } else if (checking) {
      child = const Padding(
        key: ValueKey('checking'),
        padding: EdgeInsets.only(bottom: 14),
        child: Align(alignment: Alignment.centerLeft, child: StepSquares()),
      );
    } else {
      child = const SizedBox(key: ValueKey('none'), width: double.infinity);
    }

    return AnimatedSize(
      duration: still ? Duration.zero : const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(
        duration: still ? Duration.zero : const Duration(milliseconds: 200),
        // Only the newest child takes up room, so the size animates cleanly.
        layoutBuilder: (current, previous) => Stack(
          alignment: Alignment.topCenter,
          children: [
            for (final old in previous) Positioned(left: 0, right: 0, top: 0, child: old),
            ?current,
          ],
        ),
        child: child,
      ),
    );
  }
}
