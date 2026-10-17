import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/categorizer.dart';
import 'package:piko/esewa/esewa_service.dart';
import 'package:piko/esewa/models.dart';

// Stores captures in memory; `offline` makes every write fail, like a phone with no data.
// Like the server, it keeps one capture per notification (eventId).
class _MemoryRepo implements TxnRepository {
  final txns = <Txn>[];
  final raws = <RawEvent>[];
  bool offline = false;

  void _write() {
    if (offline) throw Exception('offline');
  }

  @override
  Future<List<Txn>> around(DateTime at, Duration window) async =>
      txns.where((t) => t.occurredAt.difference(at).abs() <= window).toList();

  @override
  Future<List<Txn>> drafts() async => txns.where((t) => t.isDraft).toList();

  @override
  Future<bool> insert(Txn t) async {
    _write();
    if (t.eventId != null && txns.any((s) => s.eventId == t.eventId)) return false;
    txns.add(t);
    return true;
  }

  @override
  Future<void> update(Txn t) async => _write();

  @override
  Future<void> saveRaw(RawEvent e) async {
    _write();
    raws.add(e);
  }

  @override
  Future<Map<String, String>> loadUserRules() async => {};

  @override
  Future<void> saveUserRules(Map<String, String> rules) async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('finance/esewa');

  // The native queue: events stay until Dart acks them.
  late List<Map<String, Object>> queue;
  late List<String> acked;
  // What Dart asked the native notifier to show.
  late List<Map<Object?, Object?>> notified;

  Map<String, Object> event(String id, String text, int minute) => {
        'id': id,
        'key': 'k',
        'postedAt': DateTime(2026, 10, 14, 12, minute).millisecondsSinceEpoch,
        'source': 'notification',
        'text': text,
        'title': 'eSewa',
      };

  setUp(() {
    queue = [];
    acked = [];
    notified = [];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, (call) async {
      switch (call.method) {
        case 'pending':
          return jsonEncode(queue);
        case 'ack':
          final ids = (call.arguments as List).cast<String>();
          acked.addAll(ids);
          queue.removeWhere((e) => ids.contains(e['id']));
          return null;
        case 'notify':
          notified.add(call.arguments as Map<Object?, Object?>);
          return null;
      }
      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, null);
  });

  EsewaService serviceWith(_MemoryRepo repo) => EsewaService(repo)..categorizer = Categorizer();

  test('stores each queued payment as a draft and only then acks it', () async {
    final repo = _MemoryRepo();
    queue.addAll([
      event('a', 'You have paid Rs. 500 to Daraz.', 0),
      event('b', 'You have paid Rs. 120 to Ncell.', 10),
    ]);

    await serviceWith(repo).drainPending();

    expect(repo.txns.map((t) => t.amount), [500, 120]);
    expect(repo.txns.every((t) => t.isDraft), isTrue);
    expect(acked, ['a', 'b']);
    expect(queue, isEmpty);
  });

  test('keeps a payment queued when it could not be stored, and stores it next time', () async {
    final repo = _MemoryRepo()..offline = true;
    queue.add(event('a', 'You have paid Rs. 500 to Daraz.', 0));
    final service = serviceWith(repo);

    await service.drainPending();
    expect(repo.txns, isEmpty);
    expect(acked, isEmpty);
    expect(queue, hasLength(1));

    repo.offline = false;
    await service.drainPending();
    expect(repo.txns, hasLength(1));
    expect(acked, ['a']);
  });

  test('two drains at once store a payment only once', () async {
    final repo = _MemoryRepo();
    queue.add(event('a', 'You have paid Rs. 500 to Daraz.', 0));
    final service = serviceWith(repo);

    await Future.wait([service.drainPending(), service.drainPending()]);

    expect(repo.txns, hasLength(1));
  });

  test('reports the new drafts and asks the notifier to alert with one line each', () async {
    final repo = _MemoryRepo();
    queue.addAll([
      event('a', 'You have paid Rs. 1,250.50 to Daraz.', 0),
      event('b', 'You have received Rs. 200 from Ram.', 5),
      event('c', 'You have paid Rs. 120 to Ncell.', 10),
    ]);

    final result = await serviceWith(repo).drainPending();

    // Money coming in is stored but isn't a draft, so it isn't announced.
    expect(result.drafts.map((t) => t.amount), [1250.5, 120]);
    expect(result.unreadable, 0);
    expect(notified, [
      {
        'drafts': ['Rs 1,250.50 to Daraz', 'Rs 120 to Ncell'],
        'unreadable': 0,
      },
    ]);
  });

  test('gives each draft the id of the notification it came from', () async {
    final repo = _MemoryRepo();
    queue.add(event('k@1', 'You have paid Rs. 500 to Daraz.', 0));

    await serviceWith(repo).drainPending();

    expect(repo.txns.single.eventId, 'k@1');
  });

  test('counts a message it could not read, but not an OTP or login message', () async {
    final repo = _MemoryRepo();
    queue.addAll([
      event('low', 'Your eSewa balance is low. Load fund now.', 0),
      event('otp', 'Your OTP for payment of Rs. 500 is 123456', 1),
      event('login', 'New login to your eSewa account', 2),
    ]);

    final result = await serviceWith(repo).drainPending();

    expect(result.drafts, isEmpty);
    expect(result.unreadable, 1);
    expect(notified, [
      {'drafts': <String>[], 'unreadable': 1},
    ]);
    expect(acked, ['low', 'otp', 'login']);
  });

  test('a draft the server already had is acked but not announced again', () async {
    final repo = _MemoryRepo();
    // Another drain (the app and the background at once) stored it first.
    repo.txns.add(Txn(
      amount: 500,
      direction: TxnDirection.debit,
      kind: TxnKind.payment,
      occurredAt: DateTime(2026, 10, 14, 9),
      source: 'notification',
      rawText: 'earlier',
      eventId: 'a',
    ));
    queue.add(event('a', 'You have paid Rs. 500 to Daraz.', 0));

    final result = await serviceWith(repo).drainPending();

    expect(repo.txns, hasLength(1));
    expect(result.isEmpty, isTrue);
    expect(notified, isEmpty);
    expect(acked, ['a']);
  });

  test('does not alert when nothing new was stored, including when offline', () async {
    final repo = _MemoryRepo()..offline = true;
    queue.add(event('a', 'You have paid Rs. 500 to Daraz.', 0));

    final result = await serviceWith(repo).drainPending();

    expect(result.isEmpty, isTrue);
    expect(notified, isEmpty);
  });

  test('idle waits for a drain that starts while another is running', () async {
    final repo = _MemoryRepo();
    queue.add(event('a', 'You have paid Rs. 500 to Daraz.', 0));
    final service = serviceWith(repo);

    final first = service.drainPending();
    queue.add(event('b', 'You have paid Rs. 120 to Ncell.', 10));
    unawaited(service.drainPending());
    await service.idle();

    await first;
    expect(repo.txns, hasLength(2));
  });

  group('DrainResult.draftLine', () {
    Txn paid(double amount, String? payee) => Txn(
          amount: amount,
          direction: TxnDirection.debit,
          kind: TxnKind.payment,
          occurredAt: DateTime(2026, 10, 14),
          source: 'notification',
          rawText: '',
          counterparty: payee,
        );

    test('whole rupees without paisa, grouped', () {
      expect(DrainResult.draftLine(paid(12500, 'Daraz')), 'Rs 12,500 to Daraz');
    });

    test('paisa when there are any', () {
      expect(DrainResult.draftLine(paid(99.5, 'Pathao')), 'Rs 99.50 to Pathao');
    });

    test('no payee', () {
      expect(DrainResult.draftLine(paid(500, null)), 'Rs 500 eSewa payment');
    });
  });

  test('acks notifications that are not payments, keeping them in the log', () async {
    final repo = _MemoryRepo();
    queue.add(event('otp', 'Your OTP for payment of Rs. 500 is 123456', 0));

    await serviceWith(repo).drainPending();

    expect(repo.txns, isEmpty);
    expect(repo.raws, hasLength(1));
    expect(acked, ['otp']);
  });
}
