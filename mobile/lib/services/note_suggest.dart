// Words that say nothing about what was bought, in English and in romanised
// Nepali. Keep in step with the server's list in
// src/modules/expenses/lib/note-words.ts, which builds the word table.
const _filler = {
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'me', 'my', 'of', 'on', 'or', 'our', 'the', 'to', 'was', 'with',
  'bata', 'ka', 'ki', 'ko', 'lagi', 'lai', 'le', 'ma', 'ra',
};

// Letters with their accents and vowel signs, so Devanagari stays whole.
final _word = RegExp(r'[\p{L}\p{M}\p{N}]+', unicode: true);
final _number = RegExp(r'^\p{N}+$', unicode: true);

// The words of a note, split the way the server splits them.
List<String> noteWords(String note) => [
      for (final match in _word.allMatches(note.toLowerCase()))
        if (match[0]!.length >= 2 && !_filler.contains(match[0]) && !_number.hasMatch(match[0]!)) match[0]!,
    ];

// The category a note points to, from the server's word → category table:
// the one most of its known words point to, a tie going to the earlier word.
// Null when no word is known or its category isn't among [offeredIds].
String? suggestCategoryId(String note, Map<String, String> wordTable, Iterable<String> offeredIds) {
  final offered = offeredIds.toSet();
  final votes = <String, int>{};
  for (final word in noteWords(note)) {
    final id = wordTable[word];
    if (id != null && offered.contains(id)) votes[id] = (votes[id] ?? 0) + 1;
  }
  if (votes.isEmpty) return null;
  // Map keys keep first-seen order, so the first with the top count is the earliest word.
  final top = votes.values.reduce((a, b) => a > b ? a : b);
  return votes.keys.firstWhere((id) => votes[id] == top);
}
