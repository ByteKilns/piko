import 'package:flutter_test/flutter_test.dart';
import 'package:piko/services/note_suggest.dart';

void main() {
  group('noteWords', () {
    // The same cases as the server's note-words.test.ts, so both split notes alike.
    test('lowercases and splits on anything that is not a letter or digit', () {
      expect(noteWords('Groceries, BANANA & apples'), ['groceries', 'banana', 'apples']);
    });

    test('drops filler words, one-letter words and bare numbers', () {
      expect(noteWords('T shirt from Basemark for 1500'), ['shirt', 'basemark']);
      expect(noteWords('momo ko lagi'), ['momo']);
    });

    test('keeps words in any script', () {
      expect(noteWords('केरा र स्याउ'), ['केरा', 'स्याउ']);
    });
  });

  group('suggestCategoryId', () {
    const table = {'banana': 'groceries', 'apples': 'groceries', 'momo': 'lunch', 'shirt': 'shopping'};
    const offered = ['groceries', 'lunch', 'shopping'];

    test('suggests the category a known word points to', () {
      expect(suggestCategoryId('Banana', table, offered), 'groceries');
    });

    test('goes with what most of the words point to', () {
      expect(suggestCategoryId('momo, banana and apples', table, offered), 'groceries');
    });

    test('gives a tie to the earlier word', () {
      expect(suggestCategoryId('shirt and momo', table, offered), 'shopping');
      expect(suggestCategoryId('momo and shirt', table, offered), 'lunch');
    });

    test('suggests nothing for words it has never seen', () {
      expect(suggestCategoryId('t shirt', const {'banana': 'groceries'}, offered), isNull);
      expect(suggestCategoryId('', table, offered), isNull);
    });

    test("ignores a category the sheet doesn't offer", () {
      expect(suggestCategoryId('banana', table, const ['lunch']), isNull);
    });
  });
}
