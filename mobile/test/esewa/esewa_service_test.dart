import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/categorizer.dart';
import 'package:piko/esewa/esewa_service.dart';
import 'package:piko/esewa/models.dart';

// Stores captures in memory; `offline` makes every write fail, like a phone with no data.
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
  Future<void> insert(Txn t) async {
    _write();
    txns.add(t);
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
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, (call) async {
      switch (call.method) {
        case 'pending':
          return jsonEncode(queue);
        case 'ack':
          final ids = (call.arguments as List).cast<String>();
          acked.addAll(ids);
          queue.removeWhere((e) => ids.contains(e['id']));
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

  test('acks notifications that are not payments, keeping them in the log', () async {
    final repo = _MemoryRepo();
    queue.add(event('otp', 'Your OTP for payment of Rs. 500 is 123456', 0));

    await serviceWith(repo).drainPending();

    expect(repo.txns, isEmpty);
    expect(repo.raws, hasLength(1));
    expect(acked, ['otp']);
  });
}
