import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

typedef MonogramPerson = ({String name, bool isMe});

// Square initial badges, like the website's Monogram: you in ink, the other
// person in grey. Shared expenses pass both, and the second badge overlaps
// the first behind a paper ring.
class Monogram extends StatelessWidget {
  const Monogram({super.key, required this.people});

  final List<MonogramPerson> people;

  static const _size = 20.0;
  static const _overlap = 4.0;
  static const _ring = 2.0;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final step = _size - _overlap;

    Widget badge(MonogramPerson person) {
      final name = person.name.trim();
      return Container(
        width: _size,
        height: _size,
        alignment: Alignment.center,
        color: person.isMe ? c.ink : c.n600,
        child: Text(
          name.isEmpty ? '?' : name[0].toUpperCase(),
          style: TextStyle(fontSize: 11, height: 1, fontWeight: FontWeight.w600, color: c.paper),
        ),
      );
    }

    return SizedBox(
      width: people.isEmpty ? 0 : _size + step * (people.length - 1),
      height: _size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          for (final (i, person) in people.indexed)
            if (i == 0)
              Positioned(left: 0, top: 0, child: badge(person))
            else
              Positioned(
                left: step * i - _ring,
                top: -_ring,
                child: Container(padding: const EdgeInsets.all(_ring), color: c.paper, child: badge(person)),
              ),
        ],
      ),
    );
  }
}
