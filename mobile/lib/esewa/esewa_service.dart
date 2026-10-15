import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/services.dart';

import 'categorizer.dart';
import 'deduplicator.dart';
import 'models.dart';
import 'parser.dart';

/// Your persistence layer (sqflite / drift / isar / Firestore...).
///
/// Store [Txn.status] as a column. Your existing reports, totals and budgets
/// must only read rows where status == approved.
abstract class TxnRepository {
  /// Transactions near [at] in ANY status (draft, approved, rejected) — used
  /// for duplicate checks, so a rejected txn is never re-drafted.
  Future<List<Txn>> around(DateTime at, Duration window);

  /// Drafts waiting for review, newest first.
  Future<List<Txn>> drafts();

  Future<void> insert(Txn t);
  Future<void> update(Txn t);
  Future<void> saveRaw(RawEvent e); // keep raw events for re-parsing
  Future<Map<String, String>> loadUserRules();
  Future<void> saveUserRules(Map<String, String> rules);
}

/// Wires native capture -> parse -> dedupe -> categorize -> store.
class EsewaService {
  static const _method = MethodChannel('finance/esewa');
  static const _events = EventChannel('finance/esewa/events');

  final TxnRepository repo;
  final EsewaParser parser;
  final Deduplicator dedup;
  late Categorizer categorizer;

  final _newTxns = StreamController<Txn>.broadcast();
  StreamSubscription? _sub;

  EsewaService(this.repo, {EsewaParser? parser, Deduplicator? dedup})
      : parser = parser ?? EsewaParser(),
        dedup = dedup ?? Deduplicator();

  /// Emits every new draft (use it to refresh a "N to review" badge).
  Stream<Txn> get onDraft => _newTxns.stream;

  bool get isSupported => Platform.isAndroid;

  Future<bool> isAccessGranted() async =>
      isSupported && (await _method.invokeMethod<bool>('isAccessGranted') ?? false);

  /// Show your own explanation screen first, then call this.
  Future<void> openAccessSettings() => _method.invokeMethod('openAccessSettings');

  /// Safe to call again (Piko calls it whenever the app comes back to the
  /// front): it reloads the learned rules and drains the queue once more.
  Future<void> start() async {
    categorizer = Categorizer(userRules: await repo.loadUserRules());
    if (!isSupported) return;

    // Piko: the native side queues every notification before it tells us, so
    // a live event only means "something new": draining picks it up along
    // with anything older that hasn't been stored yet.
    _sub ??= _events.receiveBroadcastStream().listen((_) => drainPending());

    // Catch up on anything captured while the app was closed or offline.
    await drainPending();
  }

  Future<void> _draining = Future.value();

  /// Piko: ingests every queued event, oldest first, and acks each one only
  /// once it has been stored, so nothing is lost when the phone is offline or
  /// the app is killed half way. Drains run one at a time, so a live event
  /// arriving mid-drain can't be stored twice. Never throws.
  Future<void> drainPending() => _draining = _draining.then((_) => _drainOnce());

  Future<void> _drainOnce() async {
    final List<dynamic> queued;
    try {
      queued = jsonDecode(await _method.invokeMethod<String>('pending') ?? '[]') as List<dynamic>;
    } catch (_) {
      return;
    }
    for (final e in queued) {
      final event = Map<String, dynamic>.from(e as Map);
      try {
        await ingest(RawEvent.fromJson(event));
        await _method.invokeMethod('ack', [event['id']]);
      } catch (_) {
        // Left queued (offline, or the server failed): tried again next drain.
      }
    }
  }

  /// Single entry point for every source (also call this from statement
  /// import, OCR, or SMS code paths).
  Future<Txn?> ingest(RawEvent e) async {
    await repo.saveRaw(e);
    final txn = parser.parse(e);
    if (txn == null) return null;

    final nearby = await repo.around(txn.occurredAt, dedup.window);
    if (dedup.isDuplicate(txn, nearby)) return null;

    categorizer.categorize(txn);
    txn.status = TxnStatus.draft; // never straight to real data
    await repo.insert(txn);
    _newTxns.add(txn);
    return txn;
  }

  // ---------------- Review ----------------

  Future<List<Txn>> pendingReview() => repo.drafts();

  /// User okays a draft, optionally fixing fields first. Only now does it
  /// become real data. A changed category is learned for next time.
  Future<void> approve(Txn t, {String? category, double? amount, String? counterparty}) async {
    if (amount != null && amount > 0) t.amount = amount;
    if (counterparty != null && counterparty.trim().isNotEmpty) t.counterparty = counterparty.trim();
    if (category != null && category != t.category) {
      categorizer.learn(t, category);
      await repo.saveUserRules(categorizer.userRules);
    }
    t.status = TxnStatus.approved;
    await repo.update(t);
  }

  /// User dismisses a draft (wrong parse, not an expense, already entered by
  /// hand...). Kept as rejected so the same notification isn't drafted again.
  Future<void> reject(Txn t) async {
    t.status = TxnStatus.rejected;
    await repo.update(t);
  }

  /// "Approve all" button: approves every draft as-is.
  Future<int> approveAll() async {
    final list = await repo.drafts();
    for (final t in list) {
      await approve(t);
    }
    return list.length;
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    await _newTxns.close();
  }
}
