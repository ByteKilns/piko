import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:piko/esewa/models.dart';
import 'package:piko/esewa/piko_txn_repository.dart';
import 'package:piko/models/categories_result.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense_draft.dart';
import 'package:piko/models/member_option.dart';
import 'package:piko/services/api_client.dart';

void main() {
  final options = CategoriesResult(
    categories: [CategoryOption(id: 'cat-groceries', name: 'Groceries'), CategoryOption(id: 'cat-lunch', name: 'Lunch')],
    members: [MemberOption(id: 'mem-1', name: 'Nirjal'), MemberOption(id: 'mem-2', name: 'Karuna')],
    currentMemberId: 'mem-1',
  );

  // Every request the repository makes, and a canned reply per path.
  late List<http.Request> requests;
  late Map<String, Object> replies;

  PikoTxnRepository repo() {
    final client = MockClient((request) async {
      requests.add(request);
      return http.Response(jsonEncode(replies[request.url.path] ?? {}), 200);
    });
    return PikoTxnRepository(
      client: ApiClient(getBaseUrl: () => 'https://piko.test', getToken: () => 'jwt', onUnauthorized: () {}, client: client),
      options: () async => options,
    );
  }

  Map<String, dynamic> bodyOf(String path) =>
      jsonDecode(requests.lastWhere((r) => r.url.path == path).body) as Map<String, dynamic>;

  Txn paid({String category = 'Groceries', String? counterparty = 'Bhatbhateni Supermarket'}) => Txn(
        amount: 1250.5,
        direction: TxnDirection.debit,
        kind: TxnKind.payment,
        // Late at night, local time: the expense must still land on this day.
        occurredAt: DateTime(2026, 10, 14, 23, 30),
        source: 'notification',
        rawText: 'You have paid Rs. 1,250.50 to Bhatbhateni Supermarket',
        counterparty: counterparty,
        refId: '0ABC12345',
        category: category,
        categoryConfidence: 0.9,
      );

  Map<String, Object?> serverCapture(String id, String status) => {
        'amount': 500,
        'category': 'Lunch',
        'categoryConfidence': 0.75,
        'counterparty': 'Momo Center',
        'direction': 'debit',
        'id': id,
        'kind': 'payment',
        'occurredAt': '2026-10-14T06:15:30.250Z',
        'rawText': 'You have paid Rs. 500 to Momo Center',
        'refId': null,
        'source': 'notification',
        'status': status,
      };

  setUp(() {
    requests = [];
    replies = {
      '/api/mobile/captures': {
        'capture': {'id': 'cap-1'},
      },
      '/api/mobile/captures/approve': {
        'expense': {
          'amount': 1250.5,
          'categoryId': 'cat-groceries',
          'date': '2026-10-14',
          'id': 'exp-1',
          'note': 'Bhatbhateni Supermarket',
          'ownerMemberId': 'mem-1',
          'paidByMemberId': 'mem-1',
        },
      },
    };
  });

  test('stores a capture with its time in UTC', () async {
    final t = paid();
    await repo().insert(t);

    final sent = bodyOf('/api/mobile/captures');
    expect(sent['occurredAt'], t.occurredAt.toUtc().toIso8601String());
    expect(sent['occurredAt'], endsWith('Z'));
    expect(sent['amount'], 1250.5);
    expect(sent['direction'], 'debit');
    expect(sent['kind'], 'payment');
    expect(sent['category'], 'Groceries');
  });

  test('sends the notification id and reports a capture the server stored now', () async {
    final t = Txn(
      amount: 500,
      direction: TxnDirection.debit,
      kind: TxnKind.payment,
      occurredAt: DateTime(2026, 10, 14, 12),
      source: 'notification',
      rawText: 'You have paid Rs. 500 to Daraz',
      eventId: 'k@1792036530250',
    );
    replies['/api/mobile/captures'] = {
      'capture': {'id': 'cap-1'},
      'created': true,
    };

    expect(await repo().insert(t), isTrue);
    expect(bodyOf('/api/mobile/captures')['eventId'], 'k@1792036530250');
  });

  test('reports a capture the server already had, and still knows its id', () async {
    final r = repo();
    final t = paid();
    replies['/api/mobile/captures'] = {
      'capture': {'id': 'cap-1'},
      'created': false,
    };

    expect(await r.insert(t), isFalse);
    t.status = TxnStatus.rejected;
    await r.update(t);
    expect(bodyOf('/api/mobile/captures/reject'), {'id': 'cap-1'});
  });

  test('leaves the notification id out when there is none, and an older server means stored', () async {
    // The default reply has no `created`, like the server before this change.
    expect(await repo().insert(paid()), isTrue);
    expect(bodyOf('/api/mobile/captures').containsKey('eventId'), isFalse);
  });

  test('approving files it for and paid by me, on the day it was paid, with the payee as the note', () async {
    final r = repo();
    final t = paid();
    await r.insert(t);

    t.status = TxnStatus.approved;
    await r.update(t);

    final sent = bodyOf('/api/mobile/captures/approve');
    expect(sent['id'], 'cap-1');
    expect(sent['expense'], {
      'amount': 1250.5,
      'categoryId': 'cat-groceries',
      'ownerMemberId': 'mem-1',
      'paidByMemberId': 'mem-1',
      'date': '2026-10-14',
      'note': 'Bhatbhateni Supermarket',
    });
  });

  test('approving uses what was checked in the sheet', () async {
    final r = repo();
    final t = paid();
    await r.insert(t);
    final checked = ExpenseDraft(
      amount: 1200,
      categoryId: 'cat-lunch',
      ownerMemberId: null,
      paidByMemberId: 'mem-1',
      date: '2026-10-13',
      note: 'T shirt from Basemark',
    );

    r.prepareApproval(t, checked);
    t.status = TxnStatus.approved;
    await r.update(t);

    expect(bodyOf('/api/mobile/captures/approve')['expense'], checked.toJson());
  });

  test("can't approve as it is without one of the household's categories", () async {
    final r = repo();
    final t = paid(category: 'Transfers');
    await r.insert(t);

    expect(r.approvalDraft(t, options), isNull);
    t.status = TxnStatus.approved;
    await expectLater(r.update(t), throwsStateError);
    expect(requests.where((q) => q.url.path == '/api/mobile/captures/approve'), isEmpty);
  });

  test('matches a category by name whatever its capitals', () async {
    expect(repo().approvalDraft(paid(category: 'groceries '), options)?.categoryId, 'cat-groceries');
  });

  test('rejecting tells the server which capture', () async {
    final r = repo();
    final t = paid();
    await r.insert(t);

    t.status = TxnStatus.rejected;
    await r.update(t);

    expect(bodyOf('/api/mobile/captures/reject'), {'id': 'cap-1'});
  });

  test('reads drafts back with their ids, so they can be approved', () async {
    replies['/api/mobile/captures'] = {
      'captures': [serverCapture('cap-9', 'draft')],
    };
    final r = repo();

    final drafts = await r.drafts();
    expect(drafts.single.amount, 500);
    expect(drafts.single.counterparty, 'Momo Center');
    expect(drafts.single.occurredAt, DateTime.utc(2026, 10, 14, 6, 15, 30, 250).toLocal());
    expect(drafts.single.isDraft, isTrue);

    drafts.single.status = TxnStatus.rejected;
    await r.update(drafts.single);
    expect(bodyOf('/api/mobile/captures/reject'), {'id': 'cap-9'});
  });

  test('a skipped capture counts as dismissed in the duplicate check', () async {
    replies['/api/mobile/captures/around'] = {
      'captures': [serverCapture('cap-3', 'skipped'), serverCapture('cap-4', 'approved')],
    };

    final nearby = await repo().around(DateTime.utc(2026, 10, 14, 6, 15), const Duration(minutes: 3));

    expect(nearby.map((t) => t.status), [TxnStatus.rejected, TxnStatus.approved]);
    expect(requests.last.url.queryParameters, {'at': '2026-10-14T06:15:00.000Z', 'seconds': '180'});
  });

  test('masks the digits of OTP and login messages in the log, and only those', () async {
    final r = repo();
    await r.saveRaw(RawEvent(source: 'notification', key: 'k1', title: 'eSewa', text: 'Your OTP for payment of Rs. 500 is 123456', postedAt: DateTime.utc(2026, 10, 14, 6)));
    expect(bodyOf('/api/mobile/capture-events')['text'], 'Your OTP for payment of Rs. ••• is ••••••');

    await r.saveRaw(RawEvent(source: 'notification', key: 'k2', title: 'eSewa', text: 'You have paid Rs. 500 to Daraz.', postedAt: DateTime.utc(2026, 10, 14, 6)));
    final sent = bodyOf('/api/mobile/capture-events');
    expect(sent['text'], 'You have paid Rs. 500 to Daraz.');
    expect(sent['key'], 'k2');
    expect(sent['postedAt'], '2026-10-14T06:00:00.000Z');
  });

  test('loads learned rules by category name, dropping ones whose category is gone', () async {
    replies['/api/mobile/capture-rules'] = {
      'rules': [
        {'categoryId': 'cat-lunch', 'counterparty': 'momo center'},
        {'categoryId': 'cat-archived', 'counterparty': 'old shop'},
      ],
    };

    expect(await repo().loadUserRules(), {'momo center': 'Lunch'});
  });

  test('starts with no rules when they cannot be loaded', () async {
    final failing = PikoTxnRepository(
      client: ApiClient(
        getBaseUrl: () => 'https://piko.test',
        getToken: () => 'jwt',
        onUnauthorized: () {},
        client: MockClient((_) async => throw http.ClientException('offline')),
      ),
      options: () async => options,
    );

    expect(await failing.loadUserRules(), isEmpty);
  });

  test('saves rules by category id, leaving out names the household does not have', () async {
    await repo().saveUserRules({'momo center': 'Lunch', 'hari shrestha': 'Rent'});

    expect(bodyOf('/api/mobile/capture-rules'), {
      'rules': [
        {'categoryId': 'cat-lunch', 'counterparty': 'momo center'},
      ],
    });
  });
}
