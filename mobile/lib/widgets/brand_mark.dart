import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

// The ink "P" square and "Piko" wordmark from the website's sidebar.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          color: c.ink,
          child: Text(
            'P',
            style: TextStyle(fontSize: size * 0.5, height: 1, fontWeight: FontWeight.w800, color: c.paper),
          ),
        ),
        const SizedBox(width: 10),
        Text('Piko', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.ink)),
      ],
    );
  }
}
