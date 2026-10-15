import 'category_option.dart';
import 'member_option.dart';

class CategoriesResult {
  final List<CategoryOption> categories;
  final List<MemberOption> members;
  // The signed-in member. Null from a server older than this field.
  final String? currentMemberId;
  // Word → category id, learned from the household's notes, for suggesting a
  // category as a note is typed. Empty from a server older than this field.
  final Map<String, String> noteWords;

  CategoriesResult({required this.categories, required this.members, this.currentMemberId, this.noteWords = const {}});

  factory CategoriesResult.fromJson(Map<String, dynamic> json) {
    return CategoriesResult(
      categories: (json['categories'] as List<dynamic>)
          .map((c) => CategoryOption.fromJson(c as Map<String, dynamic>))
          .toList(),
      members: (json['members'] as List<dynamic>)
          .map((m) => MemberOption.fromJson(m as Map<String, dynamic>))
          .toList(),
      currentMemberId: json['currentMemberId'] as String?,
      noteWords: (json['noteWords'] as Map<String, dynamic>? ?? const {}).map((word, id) => MapEntry(word, id as String)),
    );
  }
}
