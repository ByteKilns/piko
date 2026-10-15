import 'models.dart';

/// The same payment can arrive via notification, SMS and a later statement
/// import. Decide whether [candidate] is already present in [existing].
class Deduplicator {
  /// Notifications vs statements can differ by a few minutes.
  final Duration window;
  Deduplicator({this.window = const Duration(minutes: 3)});

  bool isDuplicate(Txn candidate, Iterable<Txn> existing) {
    for (final t in existing) {
      // 1. Reference id is authoritative when both sides have one.
      if (candidate.refId != null && t.refId != null) {
        if (candidate.refId == t.refId) return true;
        continue;
      }
      // 2. Fuzzy: same amount + direction, close in time, compatible counterparty.
      if (t.amount != candidate.amount || t.direction != candidate.direction) continue;
      if (t.occurredAt.difference(candidate.occurredAt).abs() > window) continue;
      if (_sameParty(t.counterparty, candidate.counterparty)) return true;
    }
    return false;
  }

  /// Merge a duplicate into the existing record (fill gaps, keep best data).
  Txn merge(Txn kept, Txn incoming) => Txn(
        amount: kept.amount,
        direction: kept.direction,
        kind: kept.kind == TxnKind.unknown ? incoming.kind : kept.kind,
        counterparty: kept.counterparty ?? incoming.counterparty,
        refId: kept.refId ?? incoming.refId,
        occurredAt: kept.occurredAt,
        source: kept.source,
        rawText: kept.rawText,
        category: kept.category,
        categoryConfidence: kept.categoryConfidence,
        status: kept.status,
      );

  bool _sameParty(String? a, String? b) {
    if (a == null || b == null) return true; // one side unknown: rely on amount+time
    final x = a.toLowerCase(), y = b.toLowerCase();
    return x == y || x.contains(y) || y.contains(x);
  }
}
