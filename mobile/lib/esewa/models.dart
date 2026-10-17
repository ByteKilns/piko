enum TxnDirection { debit, credit }

enum TxnKind { payment, transfer, topup, billPay, load, cashback, refund, unknown }

/// draft    -> auto-captured, waiting for review (NOT counted in totals)
/// approved -> user confirmed; this is real data
/// rejected -> user dismissed; kept only so the same txn isn't re-drafted
enum TxnStatus { draft, approved, rejected }

/// Raw event exactly as captured (notification / SMS / statement row / OCR).
/// Keep these: when the parser improves you can re-parse history.
class RawEvent {
  final String source; // notification | sms | statement | ocr | manual
  final String key; // source-specific unique key
  final String title;
  final String text;
  final DateTime postedAt;

  /// Piko: the phone queue's name for this notification ("key@postedAt");
  /// empty when it didn't come from the queue.
  final String id;

  RawEvent({
    required this.source,
    required this.key,
    required this.title,
    required this.text,
    required this.postedAt,
    this.id = '',
  });

  String get body => '$title $text'.trim();

  factory RawEvent.fromJson(Map<String, dynamic> j) => RawEvent(
        id: j['id'] as String? ?? '',
        source: j['source'] as String? ?? 'notification',
        key: j['key'] as String? ?? '',
        title: j['title'] as String? ?? '',
        text: j['text'] as String? ?? '',
        postedAt: DateTime.fromMillisecondsSinceEpoch(
            (j['postedAt'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch),
      );
}

/// Normalized transaction, independent of where it came from.
class Txn {
  double amount; // always positive, NPR (editable during review)
  final TxnDirection direction;
  final TxnKind kind;
  String? counterparty; // merchant / person / biller (editable during review)
  final String? refId; // eSewa reference / transaction code if present
  final DateTime occurredAt;
  final String source;
  final String rawText;
  String category;
  double categoryConfidence;
  TxnStatus status;

  /// Piko: the [RawEvent.id] it was read from, so the server keeps one draft
  /// per notification. Null when it didn't come from the phone queue.
  final String? eventId;

  Txn({
    required this.amount,
    required this.direction,
    required this.kind,
    required this.occurredAt,
    required this.source,
    required this.rawText,
    this.counterparty,
    this.refId,
    this.category = 'Uncategorized',
    this.categoryConfidence = 0,
    this.status = TxnStatus.draft,
    this.eventId,
  });

  bool get isExpense => direction == TxnDirection.debit;
  bool get isDraft => status == TxnStatus.draft;

  Map<String, dynamic> toJson() => {
        'amount': amount,
        'direction': direction.name,
        'kind': kind.name,
        'counterparty': counterparty,
        'refId': refId,
        'occurredAt': occurredAt.toIso8601String(),
        'source': source,
        'rawText': rawText,
        'category': category,
        'categoryConfidence': categoryConfidence,
        'status': status.name,
      };

  @override
  String toString() =>
      'Txn(${status.name} ${direction.name} Rs.$amount, ${kind.name}, $counterparty, ref=$refId, $category)';
}
