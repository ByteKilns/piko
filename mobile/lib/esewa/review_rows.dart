import '../services/bs_calendar.dart';
import 'models.dart';

// What a draft row is called: who was paid, else what kind of payment it was.
String draftTitle(Txn t) {
  final payee = t.counterparty?.trim() ?? '';
  if (payee.isNotEmpty) return payee;
  return switch (t.kind) {
    TxnKind.topup => 'Top-up',
    TxnKind.billPay => 'Bill payment',
    TxnKind.transfer => 'Transfer',
    TxnKind.load => 'Load',
    TxnKind.cashback => 'Cashback',
    TxnKind.refund => 'Refund',
    TxnKind.payment || TxnKind.unknown => 'Payment',
  };
}

// When it was paid, in the phone's time: the date as the app shows dates, and
// the time ("2 Kartik 2083 · 14:05").
String draftWhen(Txn t, AppDateFormat format, BsCalendar calendar) {
  final local = t.occurredAt.toLocal();
  final time = '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  return '${formatAppDate(formatAd(local), format, calendar)} · $time';
}
