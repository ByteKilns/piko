import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/models.dart';
import 'package:piko/esewa/review_rows.dart';
import 'package:piko/services/bs_calendar.dart';

void main() {
  final calendar = BsCalendar.fromJson(
    jsonDecode(File('assets/bs_calendar.json').readAsStringSync()) as Map<String, dynamic>,
  );

  Txn txn({String? counterparty, TxnKind kind = TxnKind.payment}) => Txn(
        amount: 100,
        direction: TxnDirection.debit,
        kind: kind,
        occurredAt: DateTime(2026, 10, 14, 9, 5),
        source: 'notification',
        rawText: '',
        counterparty: counterparty,
      );

  test('a row is called by who was paid', () {
    expect(draftTitle(txn(counterparty: 'Bhatbhateni Supermarket')), 'Bhatbhateni Supermarket');
  });

  test('without a payee, by the kind of payment', () {
    expect(draftTitle(txn(kind: TxnKind.topup)), 'Top-up');
    expect(draftTitle(txn(kind: TxnKind.billPay)), 'Bill payment');
    expect(draftTitle(txn(counterparty: '  ')), 'Payment');
  });

  test('shows the date the way the app shows dates, and the time', () {
    expect(draftWhen(txn(), AppDateFormat.english, calendar), '14 Oct 2026 · 09:05');
    expect(draftWhen(txn(), AppDateFormat.nepali, calendar), '28 Ashwin 2083 · 09:05');
  });
}
