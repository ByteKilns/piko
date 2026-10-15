import 'models.dart';

/// Layered categorizer:
///   1. user rules (learned from corrections)   -> confidence 1.0
///   2. known merchant/biller table             -> 0.9
///   3. keyword rules on the raw text           -> 0.7
///   4. kind-based fallback                     -> 0.4
/// Anything below [reviewThreshold] should show in a "Review" inbox.
class Categorizer {
  static const reviewThreshold = 0.6;

  /// counterparty (lowercased) -> category. Persist this per user.
  final Map<String, String> userRules;

  Categorizer({Map<String, String>? userRules}) : userRules = userRules ?? {};

  /// Known Nepali merchants / billers. Extend freely (or load from backend).
  ///
  /// Piko: the right-hand values are the household's own category names
  /// (agreed 2026-10-14). A name the household doesn't have (Education, Rent,
  /// Transfers, Uncategorized) means no guess: the draft waits for a pick.
  static final Map<RegExp, String> merchantTable = {
    _r(r'\bnea\b|nepal electricity'): 'Electricity',
    _r(r'khanepani|kukl|water supply'): 'Water',
    _r(r'\bntc\b|nepal telecom|ncell|smart ?cell'): 'Mobile/Telephone',
    _r(r'worldlink|vianet|classic tech|subisu|dishhome|clear ?tv|net ?tv'): 'Internet',
    _r(r'daraz|sastodeal|hamrobazar'): 'Shopping',
    _r(r'foodmandu|bhojdeals|pathao food|foodpanda'): 'Dining Out',
    _r(r'pathao|indrive|tootle|yango'): 'Transportation',
    _r(r'bhatbhateni|big ?mart|salesberry|kirana|grocery|mart\b'): 'Groceries',
    _r(r'cafe|restaurant|momo|bakery|khaja|chiya|tea house'): 'Lunch',
    _r(r'pharmacy|hospital|clinic|medic|aushadhi'): 'Medicine',
    _r(r'school|college|university|tuition|academy'): 'Education',
    _r(r'insurance|\blife\b|\blic\b'): 'Insurance',
    _r(r'qfx|big movies|fcube|netflix|spotify|youtube'): 'Entertainment',
    _r(r'buddha air|yeti|shree airlines|airlines|bus sewa|travels'): 'Transportation',
    _r(r'petrol|fuel|nepal oil|pump'): 'Petrol',
  };

  static final Map<RegExp, String> keywordTable = {
    _r(r'electricity|water bill'): 'Utilities',
    _r(r'recharge|top ?up|data pack'): 'Mobile/Telephone',
    _r(r'internet|wifi|\btv\b'): 'Internet',
    _r(r'\bfees?\b|tuition'): 'Education',
    _r(r'\brent\b'): 'Rent',
    _r(r'\bloan\b|\bemi\b|installment'): 'EMI',
  };

  void categorize(Txn t) {
    if (!t.isExpense) {
      t.category = switch (t.kind) {
        TxnKind.cashback => 'Cashback',
        TxnKind.refund => 'Refund',
        TxnKind.load => 'Wallet Load', // transfer between own accounts, not income
        _ => 'Income',
      };
      t.categoryConfidence = 0.8;
      return;
    }

    final cp = t.counterparty?.toLowerCase().trim();
    if (cp != null && userRules.containsKey(cp)) {
      return _set(t, userRules[cp]!, 1.0);
    }

    final haystack = '${t.counterparty ?? ''} ${t.rawText}'.toLowerCase();
    for (final e in merchantTable.entries) {
      if (cp != null && e.key.hasMatch(cp)) return _set(t, e.value, 0.9);
    }
    for (final e in merchantTable.entries) {
      if (e.key.hasMatch(haystack)) return _set(t, e.value, 0.75);
    }
    for (final e in keywordTable.entries) {
      if (e.key.hasMatch(haystack)) return _set(t, e.value, 0.7);
    }

    switch (t.kind) {
      case TxnKind.topup:
        return _set(t, 'Mobile/Telephone', 0.8);
      case TxnKind.billPay:
        return _set(t, 'Bills', 0.5);
      case TxnKind.transfer:
        return _set(t, 'Transfers', 0.4);
      default:
        return _set(t, 'Uncategorized', 0.0);
    }
  }

  /// Call when the user changes a category; future txns from the same
  /// counterparty are categorized automatically.
  void learn(Txn t, String newCategory) {
    final cp = t.counterparty?.toLowerCase().trim();
    if (cp != null && cp.isNotEmpty) userRules[cp] = newCategory;
    _set(t, newCategory, 1.0);
  }

  static void _set(Txn t, String c, double conf) {
    t.category = c;
    t.categoryConfidence = conf;
  }

  static RegExp _r(String p) => RegExp(p, caseSensitive: false);
}
