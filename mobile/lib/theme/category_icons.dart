import 'package:flutter/material.dart';

// The website's category icons as Material icons: a category's own icon key
// (src/modules/recurring/lib/recurring-icons.ts) when it has one, otherwise a
// guess from its name (src/modules/categories/lib/guess-category-icon.ts).

const _iconsByKey = <String, IconData>{
  'building': Icons.apartment_outlined,
  'car': Icons.directions_car_outlined,
  'creditCard': Icons.credit_card_outlined,
  'dumbbell': Icons.fitness_center_outlined,
  'gift': Icons.card_giftcard_outlined,
  'heartPulse': Icons.monitor_heart_outlined,
  'home': Icons.home_outlined,
  'landmark': Icons.account_balance_outlined,
  'music': Icons.music_note_outlined,
  'phone': Icons.smartphone_outlined,
  'receipt': Icons.receipt_long_outlined,
  'shield': Icons.shield_outlined,
  'tv': Icons.tv_outlined,
  'users': Icons.group_outlined,
  'wifi': Icons.wifi,
  'zap': Icons.bolt_outlined,
};

// Checked in order, so "Clothes shopping" is clothes, not shopping.
final _keywordIcons = <(RegExp, IconData)>[
  (RegExp('lunch|dinner|breakfast|food|restaurant|dining|momo|snack|tea|coffee|cafe'), Icons.restaurant_outlined),
  (RegExp('grocer|bhatbhateni|vegetable|market'), Icons.shopping_basket_outlined),
  (RegExp('petrol|fuel|diesel|gas station'), Icons.local_gas_station_outlined),
  (RegExp('cloth|shirt|shoe'), Icons.checkroom_outlined),
  (RegExp('shop'), Icons.shopping_bag_outlined),
  (RegExp('mobile|phone|telephone|top ?up|recharge'), Icons.smartphone_outlined),
  (RegExp('internet|wifi|wi-fi|wlink|broadband'), Icons.wifi),
  (RegExp('medic|pharma|hospital|health|doctor|clinic'), Icons.medication_outlined),
  (RegExp('rent|house|home'), Icons.home_outlined),
  (RegExp('loan|emi|obligation|bank|tax|insurance'), Icons.account_balance_outlined),
  (RegExp('bus|taxi|transport|travel'), Icons.directions_bus_outlined),
  (RegExp('parking|vehicle|bike|car'), Icons.directions_car_outlined),
  (RegExp('electric|water|utility|utilities|bill'), Icons.bolt_outlined),
  (RegExp('gift'), Icons.card_giftcard_outlined),
  (RegExp('school|tuition|course|education|book'), Icons.school_outlined),
  (RegExp('saving'), Icons.savings_outlined),
  (RegExp('movie|netflix|entertainment|subscription'), Icons.tv_outlined),
  (RegExp('skin|cosmetic|beauty|salon'), Icons.auto_awesome_outlined),
  (RegExp('date|romance'), Icons.favorite_border),
];

IconData categoryIconFor(String name, String? iconKey) {
  if (iconKey != null) return _iconsByKey[iconKey] ?? Icons.receipt_long_outlined;
  final lower = name.toLowerCase();
  for (final (pattern, icon) in _keywordIcons) {
    if (pattern.hasMatch(lower)) return icon;
  }
  return Icons.sell_outlined;
}
