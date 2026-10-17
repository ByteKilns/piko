import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:piko/esewa/categorizer.dart';
import 'package:piko/esewa/esewa_alerts.dart';
import 'package:piko/esewa/esewa_service.dart';
import 'package:piko/esewa/piko_txn_repository.dart';
import 'package:piko/esewa/review_screen.dart';
import 'package:piko/models/categories_result.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense.dart';
import 'package:piko/models/member_option.dart';
import 'package:piko/providers/calendar_provider.dart';
import 'package:piko/providers/categories_provider.dart';
import 'package:piko/providers/esewa_provider.dart';
import 'package:piko/providers/expenses_provider.dart';
import 'package:piko/services/api_client.dart';
import 'package:piko/services/bs_calendar.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/appear.dart';
import 'package:piko/widgets/step_squares.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Piko's capture endpoints, in memory.
class _FakeServer {
  final drafts = <Map<String, Object?>>[
    _capture('cap-bhat', 1250.5, 'Bhatbhateni Supermarket', 'Groceries'),
    _capture('cap-hari', 300, 'Hari Shrestha', 'Transfers', kind: 'transfer'),
  ];
  final approved = <Map<String, dynamic>>[];
  final rejected = <String>[];
  final rules = <Map<String, dynamic>>[];
  // While set, the drafts don't arrive until it completes.
  Completer<void>? hold;

  static Map<String, Object?> _capture(String id, num amount, String payee, String category, {String kind = 'payment'}) => {
        'amount': amount,
        'category': category,
        'categoryConfidence': 0.9,
        'counterparty': payee,
        'direction': 'debit',
        'id': id,
        'kind': kind,
        'occurredAt': '2026-10-14T06:00:00.000Z',
        'rawText': 'You have paid Rs. $amount to $payee',
        'refId': null,
        'source': 'notification',
        'status': 'draft',
      };

  http.Client get client => MockClient((request) async {
        http.Response json(Object body) => http.Response(jsonEncode(body), 200);
        final body = request.body.isEmpty ? <String, dynamic>{} : jsonDecode(request.body) as Map<String, dynamic>;
        switch ('${request.method} ${request.url.path}') {
          case 'GET /api/mobile/captures':
            await hold?.future;
            return json({'captures': drafts});
          case 'POST /api/mobile/captures/approve':
            approved.add(body);
            drafts.removeWhere((d) => d['id'] == body['id']);
            return json({
              'expense': {...(body['expense'] as Map<String, dynamic>), 'id': 'exp-${approved.length}'},
            });
          case 'POST /api/mobile/captures/reject':
            rejected.add(body['id'] as String);
            drafts.removeWhere((d) => d['id'] == body['id']);
            return json({'ok': true});
          case 'POST /api/mobile/capture-rules':
            rules.addAll((body['rules'] as List<dynamic>).cast<Map<String, dynamic>>());
            return json({'ok': true});
        }
        return http.Response('{}', 404);
      });
}

// Counts how often the drafts alert was cleared.
class _Alerts extends EsewaAlerts {
  int cleared = 0;

  @override
  Future<void> clearDrafts() async => cleared++;
}

void main() {
  final calendar = BsCalendar.fromJson(
    jsonDecode(File('assets/bs_calendar.json').readAsStringSync()) as Map<String, dynamic>,
  );
  final options = CategoriesResult(
    categories: [CategoryOption(id: 'cat-groceries', name: 'Groceries'), CategoryOption(id: 'cat-lunch', name: 'Lunch')],
    members: [MemberOption(id: 'mem-1', name: 'Nirjal'), MemberOption(id: 'mem-2', name: 'Karuna')],
    currentMemberId: 'mem-1',
  );

  late _FakeServer server;
  late _Alerts alerts;

  Future<void> pumpReview(WidgetTester tester, {bool settle = true}) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final api = ApiClient(getBaseUrl: () => 'https://piko.test', getToken: () => 'jwt', onUnauthorized: () {}, client: server.client);
    final repo = PikoTxnRepository(client: api, options: () async => options);
    final service = EsewaService(repo)..categorizer = Categorizer();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          esewaRepositoryProvider.overrideWithValue(repo),
          esewaServiceProvider.overrideWithValue(service),
          esewaAlertsProvider.overrideWithValue(alerts),
          categoriesProvider.overrideWith((ref) async => options),
          recentExpensesProvider.overrideWith((ref) async => const <Expense>[]),
          bsCalendarProvider.overrideWithValue(calendar),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const EsewaReviewScreen()),
      ),
    );
    if (settle) await tester.pumpAndSettle();
  }

  // How visible the row showing [payee] is, 0 to 1.
  double opacityOf(WidgetTester tester, String payee) => tester
      .widget<FadeTransition>(find
          .descendant(
            of: find.ancestor(of: find.text(payee), matching: find.byType(Appear)),
            matching: find.byType(FadeTransition),
          )
          .first)
      .opacity
      .value;

  setUp(() {
    server = _FakeServer();
    alerts = _Alerts();
  });

  testWidgets('opening it clears the drafts alert, since every draft is on screen', (tester) async {
    await pumpReview(tester);

    expect(alerts.cleared, 1);
  });

  testWidgets('shows the stepping squares until the drafts arrive, then fades them in', (tester) async {
    server.hold = Completer<void>();
    await pumpReview(tester, settle: false);
    await tester.pump();

    expect(find.byType(StepSquares), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);

    server.hold!.complete();
    await tester.pump();
    await tester.pump();
    expect(find.byType(StepSquares), findsNothing);
    expect(opacityOf(tester, 'Bhatbhateni Supermarket'), lessThan(1));

    await tester.pumpAndSettle();
    expect(opacityOf(tester, 'Bhatbhateni Supermarket'), 1);
    expect(opacityOf(tester, 'Hari Shrestha'), 1);
  });

  testWidgets('a draft that turns up on a refresh fades in; the ones already there stay put', (tester) async {
    await pumpReview(tester);

    server.drafts.insert(0, _FakeServer._capture('cap-daraz', 500, 'Daraz', 'Groceries'));
    await tester.fling(find.text('eSewa payments'), const Offset(0, 400), 1000);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(milliseconds: 50));

    expect(opacityOf(tester, 'Daraz'), lessThan(1));
    expect(opacityOf(tester, 'Bhatbhateni Supermarket'), 1);

    await tester.pumpAndSettle();
    expect(opacityOf(tester, 'Daraz'), 1);
  });

  testWidgets('lists each draft with its category, or asks for one', (tester) async {
    await pumpReview(tester);

    expect(find.text('Bhatbhateni Supermarket'), findsOneWidget);
    expect(find.text('Hari Shrestha'), findsOneWidget);
    expect(find.textContaining('Groceries ·', findRichText: true), findsOneWidget);
    expect(find.textContaining('Pick a category ·', findRichText: true), findsOneWidget);
  });

  testWidgets('swiping right approves a draft as it is: for and paid by me, with the payee as the note', (tester) async {
    await pumpReview(tester);

    await tester.drag(find.text('Bhatbhateni Supermarket'), const Offset(600, 0));
    await tester.pumpAndSettle();

    expect(server.approved.single['id'], 'cap-bhat');
    expect(server.approved.single['expense'], {
      'amount': 1250.5,
      'categoryId': 'cat-groceries',
      'ownerMemberId': 'mem-1',
      'paidByMemberId': 'mem-1',
      'date': '2026-10-14',
      'note': 'Bhatbhateni Supermarket',
    });
    expect(find.text('Bhatbhateni Supermarket'), findsNothing);
  });

  testWidgets('swiping right on a draft without a category opens the sheet instead', (tester) async {
    await pumpReview(tester);

    await tester.drag(find.text('Hari Shrestha'), const Offset(600, 0));
    await tester.pumpAndSettle();

    expect(find.text('Approve payment'), findsOneWidget);
    expect(server.approved, isEmpty);
  });

  testWidgets('swiping left rejects a draft', (tester) async {
    await pumpReview(tester);

    await tester.drag(find.text('Hari Shrestha'), const Offset(-600, 0));
    await tester.pumpAndSettle();

    expect(server.rejected, ['cap-hari']);
    expect(find.text('Hari Shrestha'), findsNothing);
  });

  testWidgets('Approve all approves only the drafts that have a category', (tester) async {
    await pumpReview(tester);

    await tester.tap(find.byKey(const Key('approve-all')));
    await tester.pumpAndSettle();

    expect(server.approved.map((a) => a['id']), ['cap-bhat']);
    expect(find.text('Hari Shrestha'), findsOneWidget);
    expect(find.byKey(const Key('approve-all')), findsNothing);
  });

  testWidgets('approving from the sheet uses what was picked and learns it for that payee', (tester) async {
    await pumpReview(tester);

    await tester.tap(find.text('Hari Shrestha'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, 'Approve'), findsOneWidget);

    await tester.tap(find.byKey(const Key('quick-category-cat-lunch')));
    await tester.enterText(find.byKey(const Key('note-field')), 'Momo with friends');
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pumpAndSettle();

    final expense = server.approved.single['expense'] as Map<String, dynamic>;
    expect(expense['categoryId'], 'cat-lunch');
    expect(expense['note'], 'Momo with friends');
    // Learned by the payee from the notification, not by the note.
    expect(server.rules, [
      {'categoryId': 'cat-lunch', 'counterparty': 'hari shrestha'},
    ]);
    expect(find.text('Approve payment'), findsNothing);
  });
}
