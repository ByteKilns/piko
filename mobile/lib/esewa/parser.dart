import 'models.dart';

/// Pattern-driven parser for eSewa notification / SMS text.
///
/// IMPORTANT: The exact wording of eSewa notifications is not documented and
/// changes between app versions. The patterns below are deliberately loose and
/// keyword based. Collect real (anonymized) samples from your users/devices,
/// add them to test/parser_test.dart, and tune [ParserRules]. Ideally ship
/// ParserRules as JSON from your backend so you can fix breakage without an
/// app release.
class ParserRules {
  /// Amount like "Rs. 1,250.50", "NPR 500", "Rs500", "रु 200".
  final RegExp amount;

  /// Keywords -> (direction, kind). First match wins, so order matters.
  final List<(RegExp, TxnDirection, TxnKind)> kindRules;

  /// Ways the counterparty is introduced: "to X", "from X", "at X", "for X".
  final List<RegExp> counterparty;

  /// Reference / transaction id.
  final RegExp refId;

  /// Messages to ignore outright (OTP, promos, login alerts...).
  final RegExp ignore;

  ParserRules({
    required this.amount,
    required this.kindRules,
    required this.counterparty,
    required this.refId,
    required this.ignore,
  });

  factory ParserRules.defaults() {
    RegExp r(String p) => RegExp(p, caseSensitive: false);
    return ParserRules(
      amount: r(r'(?:rs\.?|npr|रु\.?)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)'),
      kindRules: [
        (r(r'cash\s*back'), TxnDirection.credit, TxnKind.cashback),
        (r(r'refund(ed)?|revers(ed|al)'), TxnDirection.credit, TxnKind.refund),
        (r(r'received|credited|has sent you|transferred to you'), TxnDirection.credit, TxnKind.transfer),
        (r(r'load(ed)?\s+(?:fund|money|balance)|fund load|added to your (?:esewa|wallet)'),
            TxnDirection.credit, TxnKind.load),
        (r(r'top\s*-?\s*up|recharge'), TxnDirection.debit, TxnKind.topup),
        (r(r'\b(?:bill|electricity|nea|khanepani|water|internet|tv|insurance|fees?)\b'),
            TxnDirection.debit, TxnKind.billPay),
        (r(r'\b(?:sent|transferred|fund transfer)\b'), TxnDirection.debit, TxnKind.transfer),
        (r(r'\b(?:paid|payment|purchased?|debited|deducted)\b'), TxnDirection.debit, TxnKind.payment),
      ],
      counterparty: [
        // "to Ram Kirana Pasal on", "to Ram Kirana Pasal." etc.
        r(r'\b(?:to|at)\s+([A-Za-z0-9&.\-\s]{2,60}?)(?=\s+(?:on|for|via|with|is|has|ref|txn|\()|[.,]|$)'),
        r(r'\bfrom\s+([A-Za-z0-9&.\-\s]{2,60}?)(?=\s+(?:on|for|via|with|is|has|ref|txn|\()|[.,]|$)'),
        r(r'\bfor\s+([A-Za-z0-9&.\-\s]{2,60}?)(?=\s+(?:on|via|with|is|has|ref|txn|\()|[.,]|$)'),
      ],
      // Must contain a digit, so "transaction successful" isn't read as an id.
      refId: r(r'(?:ref(?:erence)?|txn|transaction)\s*(?:id|no|code)?\s*[:#.\-]?\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{6,})'),
      ignore: r(r'\botp\b|one[\s-]?time password|login|logged in|offer|promo|win |congratulations|kyc'),
    );
  }
}

class EsewaParser {
  final ParserRules rules;
  EsewaParser([ParserRules? rules]) : rules = rules ?? ParserRules.defaults();

  /// Returns null when the message is not a money movement.
  Txn? parse(RawEvent e) {
    final text = _normalize(e.body);
    if (text.isEmpty || rules.ignore.hasMatch(text)) return null;

    final amountMatch = rules.amount.firstMatch(text);
    if (amountMatch == null) return null;
    final amount = double.tryParse(amountMatch.group(1)!.replaceAll(',', ''));
    if (amount == null || amount <= 0) return null;

    var direction = TxnDirection.debit;
    var kind = TxnKind.unknown;
    for (final (re, dir, k) in rules.kindRules) {
      if (re.hasMatch(text)) {
        direction = dir;
        kind = k;
        break;
      }
    }
    // Amount with no recognisable verb: not confident it's a transaction.
    if (kind == TxnKind.unknown) return null;

    return Txn(
      amount: amount,
      direction: direction,
      kind: kind,
      counterparty: _counterparty(text),
      refId: rules.refId.firstMatch(text)?.group(1),
      occurredAt: e.postedAt,
      source: e.source,
      rawText: e.body,
      eventId: e.id.isEmpty ? null : e.id,
    );
  }

  /// Piko: true for a message that isn't on the ignore list (OTP, login,
  /// promos) but holds no payment the parser can read: the ones worth a
  /// "couldn't read" alert, so the rules can be taught them.
  bool isUnreadable(RawEvent e) {
    final text = _normalize(e.body);
    return text.isNotEmpty && !rules.ignore.hasMatch(text) && parse(e) == null;
  }

  String? _counterparty(String text) {
    // Strip the amount so "to Rs. 500" style text doesn't get picked up.
    final cleaned = text.replaceAll(rules.amount, ' ');
    for (final re in rules.counterparty) {
      final m = re.firstMatch(cleaned);
      final v = m?.group(1)?.trim();
      if (v != null && v.isNotEmpty && !_isNoise(v)) return _title(v);
    }
    return null;
  }

  bool _isNoise(String v) =>
      RegExp(r'^(your|you|esewa|wallet|account|the|a|an)$', caseSensitive: false).hasMatch(v) ||
      RegExp(r'^[0-9\s]+$').hasMatch(v);

  static String _normalize(String s) => s.replaceAll(RegExp(r'\s+'), ' ').trim();

  static String _title(String s) => s
      .split(' ')
      .where((w) => w.isNotEmpty)
      .map((w) => w.length <= 3 && w == w.toUpperCase() ? w : w[0].toUpperCase() + w.substring(1).toLowerCase())
      .join(' ');
}
