import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/categories_result.dart';

void main() {
  test('CategoriesResult.fromJson parses categories and members', () {
    final result = CategoriesResult.fromJson({
      'categories': [
        {'id': 'cat-1', 'name': 'Groceries'},
        {'id': 'cat-2', 'name': 'Transport'},
      ],
      'members': [
        {'id': 'mem-1', 'name': 'Nirjal'},
        {'id': 'mem-2', 'name': 'Karuna'},
      ],
    });

    expect(result.categories, hasLength(2));
    expect(result.categories.first.id, 'cat-1');
    expect(result.categories.first.name, 'Groceries');
    expect(result.members, hasLength(2));
    expect(result.members.last.name, 'Karuna');
  });

  test('CategoriesResult.fromJson reads the signed-in member and category icons', () {
    final result = CategoriesResult.fromJson({
      'categories': [
        {'id': 'cat-1', 'name': 'Internet', 'icon': 'wifi'},
        {'id': 'cat-2', 'name': 'Transport', 'icon': null},
      ],
      'currentMemberId': 'mem-2',
      'members': [
        {'id': 'mem-1', 'name': 'Nirjal'},
        {'id': 'mem-2', 'name': 'Karuna'},
      ],
    });

    expect(result.currentMemberId, 'mem-2');
    expect(result.categories.first.icon, 'wifi');
    expect(result.categories.last.icon, isNull);
  });

  test('CategoriesResult.fromJson leaves currentMemberId null for an older server', () {
    final result = CategoriesResult.fromJson({
      'categories': <dynamic>[],
      'members': <dynamic>[],
    });

    expect(result.currentMemberId, isNull);
    expect(result.noteWords, isEmpty);
  });

  test('CategoriesResult.fromJson reads the note word table', () {
    final result = CategoriesResult.fromJson({
      'categories': <dynamic>[],
      'members': <dynamic>[],
      'noteWords': {'banana': 'cat-1', 'petrol': 'cat-2'},
    });

    expect(result.noteWords, {'banana': 'cat-1', 'petrol': 'cat-2'});
  });
}
