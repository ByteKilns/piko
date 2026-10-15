import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense_draft.dart';
import 'package:piko/models/member_option.dart';
import 'package:piko/services/bs_calendar.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/expense_confirm_sheet.dart';

void main() {
  final categories = [CategoryOption(id: 'cat-1', name: 'Groceries'), CategoryOption(id: 'cat-2', name: 'Transport')];
  final calendar = BsCalendar.fromJson(
    jsonDecode(File('assets/bs_calendar.json').readAsStringSync()) as Map<String, dynamic>,
  );
  final members = [MemberOption(id: 'mem-1', name: 'Nirjal'), MemberOption(id: 'mem-2', name: 'Karuna')];

  ExpenseDraft draft({double amount = 500}) => ExpenseDraft(
        amount: amount,
        categoryId: 'cat-1',
        ownerMemberId: 'mem-1',
        paidByMemberId: 'mem-1',
        date: '2026-09-03',
        note: 'groceries',
      );

  Future<void> pumpSheet(
    WidgetTester tester, {
    required ExpenseDraft initialDraft,
    required void Function(ExpenseDraft) onSave,
    AppDateFormat dateFormat = AppDateFormat.nepali,
    String? currentMemberId = 'mem-1',
    List<String> quickCategoryIds = const [],
    Map<String, String> noteWords = const {},
  }) async {
    // Tall enough that every field is on screen without scrolling.
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: ExpenseConfirmSheet(
            initialDraft: initialDraft,
            categories: categories,
            members: members,
            currentMemberId: currentMemberId,
            quickCategoryIds: quickCategoryIds,
            noteWords: noteWords,
            dateFormat: dateFormat,
            calendar: calendar,
            onSave: (d) async => onSave(d),
          ),
        ),
      ),
    );
  }

  Finder inField(String key, String text) => find.descendant(of: find.byKey(Key(key)), matching: find.text(text));

  group('the note suggests a category', () {
    const noteWords = {'banana': 'cat-1', 'bus': 'cat-2', 'yango': 'cat-2'};

    String categoryShown(WidgetTester tester) =>
        tester.widget<DropdownButton<String>>(find.byKey(const Key('category-field'))).value!;

    testWidgets('typing a known word picks its category and says why', (tester) async {
      ExpenseDraft? saved;
      await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d, noteWords: noteWords);
      expect(find.byKey(const Key('category-suggested')), findsNothing);

      await tester.enterText(find.byKey(const Key('note-field')), 'Yango to office');
      await tester.pump();

      expect(categoryShown(tester), 'cat-2');
      expect(find.text('From your notes'), findsOneWidget);
      await tester.tap(find.byKey(const Key('save-button')));
      await tester.pump();
      expect(saved!.categoryId, 'cat-2');
    });

    testWidgets('a word it has never seen leaves the category alone', (tester) async {
      await pumpSheet(tester, initialDraft: draft(), onSave: (_) {}, noteWords: noteWords);

      await tester.enterText(find.byKey(const Key('note-field')), 'something new');
      await tester.pump();

      expect(categoryShown(tester), 'cat-1');
      expect(find.byKey(const Key('category-suggested')), findsNothing);
    });

    testWidgets('a category picked by hand stays, whatever the note says', (tester) async {
      await pumpSheet(
        tester,
        initialDraft: draft(),
        onSave: (_) {},
        noteWords: noteWords,
        quickCategoryIds: const ['cat-1', 'cat-2'],
      );

      await tester.tap(find.byKey(const Key('quick-category-cat-1')));
      await tester.pump();
      await tester.enterText(find.byKey(const Key('note-field')), 'bus');
      await tester.pump();

      expect(categoryShown(tester), 'cat-1');
      expect(find.byKey(const Key('category-suggested')), findsNothing);
    });

    testWidgets("a draft's category stays until the note is edited", (tester) async {
      // The draft's own note ("groceries") isn't a known word; nothing changes on open.
      await pumpSheet(tester, initialDraft: draft(), onSave: (_) {}, noteWords: const {'groceries': 'cat-2'});

      expect(categoryShown(tester), 'cat-1');
      expect(find.byKey(const Key('category-suggested')), findsNothing);
    });
  });

  testWidgets('shows the prefilled amount and note', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {});

    expect(find.text('500'), findsOneWidget);
    expect(find.text('groceries'), findsOneWidget);
  });

  testWidgets('Save is disabled when amount is zero or empty', (tester) async {
    await pumpSheet(tester, initialDraft: draft(amount: 0), onSave: (_) {});

    final saveButton = tester.widget<FilledButton>(find.byKey(const Key('save-button')));
    expect(saveButton.onPressed, isNull);
  });

  testWidgets('Save is enabled and calls onSave with the edited amount', (tester) async {
    ExpenseDraft? saved;
    await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d);

    await tester.enterText(find.byKey(const Key('amount-field')), '750');
    await tester.pump();

    final saveButton = tester.widget<FilledButton>(find.byKey(const Key('save-button')));
    expect(saveButton.onPressed, isNotNull);

    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pump();

    expect(saved, isNotNull);
    expect(saved!.amount, 750);
  });

  testWidgets("a minus sign can't be typed into the amount", (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {});

    await tester.enterText(find.byKey(const Key('amount-field')), '-5');
    await tester.pump();

    expect(find.text('5'), findsOneWidget);
    expect(find.text('-5'), findsNothing);
  });

  testWidgets('Save is disabled when categoryId does not match any available category', (tester) async {
    await pumpSheet(
      tester,
      initialDraft: ExpenseDraft(
        amount: 500,
        categoryId: 'not-a-real-category',
        ownerMemberId: 'mem-1',
        paidByMemberId: 'mem-1',
        date: '2026-09-03',
        note: 'groceries',
      ),
      onSave: (_) {},
    );

    final saveButton = tester.widget<FilledButton>(find.byKey(const Key('save-button')));
    expect(saveButton.onPressed, isNull);
  });

  testWidgets('For and Paid by say Me for the signed-in person, listed first', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {}, currentMemberId: 'mem-2');

    expect(inField('owner-field', 'Me'), findsOneWidget);
    expect(inField('owner-field', 'Nirjal'), findsOneWidget);
    expect(inField('owner-field', 'Shared'), findsOneWidget);
    expect(inField('paid-by-field', 'Me'), findsOneWidget);
    expect(
      tester.getTopLeft(inField('owner-field', 'Me')).dx,
      lessThan(tester.getTopLeft(inField('owner-field', 'Nirjal')).dx),
    );
  });

  testWidgets('choosing someone under For makes them the payer too', (tester) async {
    ExpenseDraft? saved;
    await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d);

    await tester.tap(inField('owner-field', 'Karuna'));
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pump();

    expect(saved!.ownerMemberId, 'mem-2');
    expect(saved!.paidByMemberId, 'mem-2');
  });

  testWidgets('choosing Shared keeps whoever paid', (tester) async {
    ExpenseDraft? saved;
    await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d);

    await tester.tap(inField('owner-field', 'Shared'));
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pump();

    expect(saved!.ownerMemberId, isNull);
    expect(saved!.paidByMemberId, 'mem-1');
  });

  testWidgets('a quick category chip picks that category', (tester) async {
    ExpenseDraft? saved;
    await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d, quickCategoryIds: ['cat-2', 'cat-1']);

    await tester.tap(find.byKey(const Key('quick-category-cat-2')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pump();

    expect(saved!.categoryId, 'cat-2');
  });

  testWidgets('shows the draft date in BS by default', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {});

    expect(find.text('18 Bhadra 2083'), findsOneWidget);
  });

  testWidgets('shows the draft date in AD when the app is set to AD', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {}, dateFormat: AppDateFormat.english);

    expect(find.text('3 Sep 2026'), findsOneWidget);
  });

  testWidgets('picking a BS day saves the matching AD date', (tester) async {
    ExpenseDraft? saved;
    await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d);

    await tester.ensureVisible(find.text('18 Bhadra 2083'));
    await tester.tap(find.text('18 Bhadra 2083'));
    await tester.pumpAndSettle();
    expect(find.text('Bhadra 2083'), findsOneWidget);

    await tester.tap(find.byKey(const Key('bs-next-month')));
    await tester.pumpAndSettle();
    expect(find.text('Ashwin 2083'), findsOneWidget);

    await tester.tap(find.text('19'));
    await tester.pumpAndSettle();
    expect(find.text('19 Ashwin 2083'), findsOneWidget);

    await tester.ensureVisible(find.byKey(const Key('save-button')));
    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pump();

    expect(saved!.date, '2026-10-05');
  });
}
