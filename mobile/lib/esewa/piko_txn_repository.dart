import '../models/categories_result.dart';
import '../models/category_option.dart';
import '../models/expense_draft.dart';
import '../services/api_client.dart';
import '../services/bs_calendar.dart';
import 'esewa_service.dart';
import 'models.dart';
import 'parser.dart';

/// The household's category called [name], ignoring capitals and spaces at
/// the ends; null when there's none (the categorizer's guess isn't one of
/// theirs).
CategoryOption? categoryNamed(String name, List<CategoryOption> categories) {
  final wanted = name.trim().toLowerCase();
  for (final category in categories) {
    if (category.name.trim().toLowerCase() == wanted) return category;
  }
  return null;
}

/// [TxnRepository] on Piko's server. Captures live in their own table, so a
/// draft never reaches the household's expenses, or any total, until it is
/// approved; approving goes through the server's normal add-expense path.
class PikoTxnRepository implements TxnRepository {
  PikoTxnRepository({required this.client, required this.options, RegExp? ignore})
      : _ignore = ignore ?? ParserRules.defaults().ignore;

  final ApiClient client;

  /// The household's categories and the signed-in member.
  final Future<CategoriesResult> Function() options;

  // The parser's "not a money movement" rule (OTP, login, promos).
  final RegExp _ignore;

  // Txn has no id field, so the server's id for each capture rides alongside.
  final _ids = Expando<String>('capture id');
  final _approvals = Expando<ExpenseDraft>('approval');
  final _lastNotes = Expando<String>('last note');

  /// The server's id for [t]; null when [t] was never stored.
  String? idOf(Txn t) => _ids[t];

  /// The note [t] starts with: the one last used for its payee, else the payee.
  String? noteFor(Txn t) => _lastNotes[t] ?? t.counterparty;

  /// What was checked in the Add expense sheet, used the next time [t] is
  /// approved. Without it, [t] is approved as it is ([approvalDraft]).
  void prepareApproval(Txn t, ExpenseDraft draft) => _approvals[t] = draft;

  /// [t] as an expense for and paid by the signed-in person, on the day it
  /// was paid, with [noteFor] as the note. Null when its category isn't one
  /// of the household's, or the server doesn't say who is signed in.
  ExpenseDraft? approvalDraft(Txn t, CategoriesResult options) {
    final me = options.currentMemberId;
    final category = categoryNamed(t.category, options.categories);
    if (me == null || category == null) return null;
    return ExpenseDraft(
      amount: t.amount,
      categoryId: category.id,
      ownerMemberId: me,
      paidByMemberId: me,
      date: formatAd(t.occurredAt.toLocal()),
      note: noteFor(t),
    );
  }

  Txn _fromJson(Map<String, dynamic> json) {
    final t = Txn(
      amount: (json['amount'] as num).toDouble(),
      direction: TxnDirection.values.byName(json['direction'] as String),
      kind: TxnKind.values.byName(json['kind'] as String),
      occurredAt: DateTime.parse(json['occurredAt'] as String).toLocal(),
      source: json['source'] as String,
      rawText: json['rawText'] as String,
      counterparty: json['counterparty'] as String?,
      refId: json['refId'] as String?,
      category: json['category'] as String,
      categoryConfidence: (json['categoryConfidence'] as num).toDouble(),
      // Skipped (money coming in) counts as dismissed for the duplicate check.
      status: switch (json['status']) {
        'draft' => TxnStatus.draft,
        'approved' => TxnStatus.approved,
        _ => TxnStatus.rejected,
      },
    );
    _ids[t] = json['id'] as String;
    if (json['lastNote'] case final String note) _lastNotes[t] = note;
    return t;
  }

  @override
  Future<List<Txn>> around(DateTime at, Duration window) async =>
      (await client.fetchCapturesAround(at, window)).map(_fromJson).toList();

  @override
  Future<List<Txn>> drafts() async => (await client.fetchCaptureDrafts()).map(_fromJson).toList();

  @override
  Future<bool> insert(Txn t) async {
    final stored = await client.createCapture({
      'amount': t.amount,
      'category': t.category,
      'categoryConfidence': t.categoryConfidence,
      'counterparty': t.counterparty,
      'direction': t.direction.name,
      'eventId': ?t.eventId,
      'kind': t.kind.name,
      'occurredAt': t.occurredAt.toUtc().toIso8601String(),
      'rawText': t.rawText,
      'refId': t.refId,
      'source': t.source,
    });
    _ids[t] = stored.id;
    return stored.created;
  }

  @override
  Future<void> update(Txn t) async {
    final id = _ids[t];
    if (id == null) throw StateError('This payment was never stored');
    switch (t.status) {
      case TxnStatus.approved:
        final draft = _approvals[t] ?? approvalDraft(t, await options());
        if (draft == null) throw StateError('Pick a category first');
        await client.approveCapture(id, draft);
      case TxnStatus.rejected:
        await client.rejectCapture(id);
      case TxnStatus.draft:
        break;
    }
  }

  @override
  Future<void> saveRaw(RawEvent e) async {
    // OTP and login messages stay in the log for tuning, but never with their codes.
    final hide = _ignore.hasMatch(e.body.replaceAll(RegExp(r'\s+'), ' '));
    String mask(String s) => hide ? s.replaceAll(RegExp(r'\d'), '•') : s;
    await client.saveCaptureEvent({
      'key': e.key,
      'postedAt': e.postedAt.toUtc().toIso8601String(),
      'source': e.source,
      'text': mask(e.text),
      'title': mask(e.title),
    });
  }

  @override
  Future<Map<String, String>> loadUserRules() async {
    // Offline at start: carry on without them. The server only ever adds or
    // updates rules, so saving from this smaller set later loses nothing.
    try {
      final rules = await client.fetchCaptureRules();
      final names = {for (final c in (await options()).categories) c.id: c.name};
      return {
        for (final MapEntry(key: payee, value: id) in rules.entries) payee: ?names[id],
      };
    } catch (_) {
      return {};
    }
  }

  @override
  Future<void> saveUserRules(Map<String, String> rules) async {
    final categories = (await options()).categories;
    await client.saveCaptureRules({
      for (final MapEntry(key: payee, value: name) in rules.entries)
        if (categoryNamed(name, categories) case final category?) payee: category.id,
    });
  }
}
