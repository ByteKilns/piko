class CategoryOption {
  final String id;
  final String name;
  // The web's icon key (e.g. "wifi"); null when the category has none, and
  // the app then guesses one from the name.
  final String? icon;

  CategoryOption({required this.id, required this.name, this.icon});

  factory CategoryOption.fromJson(Map<String, dynamic> json) {
    return CategoryOption(id: json['id'] as String, name: json['name'] as String, icon: json['icon'] as String?);
  }
}
