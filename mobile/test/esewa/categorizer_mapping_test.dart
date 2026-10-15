import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/categorizer.dart';
import 'package:piko/esewa/models.dart';

// The starting guesses land in the household's own categories (agreed 2026-10-14).
void main() {
  String guess(String counterparty, {TxnKind kind = TxnKind.payment, String? raw}) {
    final t = Txn(
      amount: 100,
      direction: TxnDirection.debit,
      kind: kind,
      occurredAt: DateTime(2026, 10, 14),
      source: 'notification',
      rawText: raw ?? 'You have paid Rs. 100 to $counterparty',
      counterparty: counterparty,
    );
    Categorizer().categorize(t);
    return t.category;
  }

  test('bills and phones', () {
    expect(guess('NEA'), 'Electricity');
    expect(guess('KUKL'), 'Water');
    expect(guess('Ncell'), 'Mobile/Telephone');
    expect(guess('Worldlink'), 'Internet');
    expect(guess('Someone', kind: TxnKind.topup, raw: 'Topup of Rs 100 is successful'), 'Mobile/Telephone');
    expect(guess('Someone', kind: TxnKind.billPay, raw: 'Bill payment of Rs 100 successful'), 'Bills');
  });

  test('food, rides and shops', () {
    expect(guess('Momo Center'), 'Lunch');
    expect(guess('Foodmandu'), 'Dining Out');
    expect(guess('Yango'), 'Transportation');
    expect(guess('Buddha Air'), 'Transportation');
    expect(guess('Nepal Oil'), 'Petrol');
    expect(guess('Bhatbhateni Supermarket'), 'Groceries');
    expect(guess('Daraz'), 'Shopping');
    expect(guess('City Pharmacy'), 'Medicine');
  });

  test('loans by keyword', () {
    expect(guess('Bank', raw: 'You have paid Rs. 100 for EMI'), 'EMI');
  });

  test("leaves a name the household doesn't have, so the draft waits for a pick", () {
    expect(guess('Hari Shrestha', kind: TxnKind.transfer, raw: 'You have sent Rs. 100 to Hari Shrestha'), 'Transfers');
    expect(guess('Kathmandu Academy'), 'Education');
  });
}
