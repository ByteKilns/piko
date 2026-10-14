import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/category_icons.dart';

// A square surface tile with the category's icon, like the website's
// CategoryIcon: its own icon when it has one, else a guess from its name.
class CategoryIcon extends StatelessWidget {
  const CategoryIcon({super.key, required this.name, this.iconKey});

  final String name;
  final String? iconKey;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      color: c.surface,
      child: Icon(categoryIconFor(name, iconKey), size: 18, color: c.ink),
    );
  }
}
