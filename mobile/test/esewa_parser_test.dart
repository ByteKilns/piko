// Run with: flutter test test/esewa_parser_test.dart
//
// NOTE: These sample strings are ILLUSTRATIVE, not copied from real eSewa
// notifications. Replace/extend them with real (anonymized) samples you
// capture on devices — this file becomes your regression suite.
import 'package:flutter_test/flutter_test.dart';

import 'package:piko/esewa/categorizer.dart';
import 'package:piko/esewa/deduplicator.dart';
import 'package:piko/esewa/models.dart';
import 'package:piko/esewa/parser.dart';

RawEvent ev(String text, {String title = 'eSewa', DateTime? at, String key = 'k'}) =>
    RawEvent(source: 'notification', key: key, title: title, text: text, postedAt: at ?? DateTime(2026, 10, 14, 12));

void main() {
  final parser = EsewaParser();
  final cat = Categorizer();

  group('isUnreadable', () {
    test('a message with no payment in it, not on the ignore list', () {
      expect(parser.isUnreadable(ev('Your eSewa balance is low. Load fund now.')), isTrue);
    });

    test('not a payment it can read', () {
      expect(parser.isUnreadable(ev('You have paid Rs. 500 to Daraz.')), isFalse);
    });

    test('not an OTP, login or promo message', () {
      expect(parser.isUnreadable(ev('Your OTP for payment of Rs. 500 is 123456')), isFalse);
      expect(parser.isUnreadable(ev('New login to your eSewa account')), isFalse);
      expect(parser.isUnreadable(ev('Congratulations! Big offer this Dashain')), isFalse);
    });
  });

  group('parser', () {
    test('a payment from the phone queue keeps the notification id', () {
      final e = RawEvent(
        source: 'notification',
        key: 'k',
        title: 'eSewa',
        text: 'You have paid Rs. 500 to Daraz.',
        postedAt: DateTime(2026, 10, 14, 12),
        id: 'k@1792036530250',
      );
      expect(parser.parse(e)!.eventId, 'k@1792036530250');
      expect(parser.parse(ev('You have paid Rs. 500 to Daraz.'))!.eventId, isNull);
    });

    test('merchant payment', () {
      final t = parser.parse(ev('You have paid Rs. 1,250.50 to Bhatbhateni Supermarket on 14-10-2026. Ref ID: 0ABC12345'))!;
      expect(t.amount, 1250.50);
      expect(t.direction, TxnDirection.debit);
      expect(t.kind, TxnKind.payment);
      expect(t.counterparty, 'Bhatbhateni Supermarket');
      expect(t.refId, '0ABC12345');
      expect(t.status, TxnStatus.draft, reason: 'captures must start as drafts');
    });

    test('received money is credit', () {
      final t = parser.parse(ev('You have received NPR 2000 from Ram Bahadur.'))!;
      expect(t.direction, TxnDirection.credit);
      expect(t.kind, TxnKind.transfer);
      expect(t.counterparty, 'Ram Bahadur');
    });

    test('topup', () {
      final t = parser.parse(ev('Ncell topup of Rs 200 is successful.'))!;
      expect(t.kind, TxnKind.topup);
      expect(t.amount, 200);
    });

    test('bill payment', () {
      final t = parser.parse(ev('NEA electricity bill payment of Rs. 845 successful.'))!;
      expect(t.kind, TxnKind.billPay);
    });

    test('cashback is credit', () {
      final t = parser.parse(ev('Congrats! Cashback of Rs. 10 received.', title: 'Cashback'));
      // "congratulations" is in ignore list but "Congrats!" is not; cashback should parse.
      expect(t!.kind, TxnKind.cashback);
      expect(t.direction, TxnDirection.credit);
    });

    test('ignores OTP', () {
      expect(parser.parse(ev('Your OTP for payment of Rs. 500 is 123456')), isNull);
    });

    test('ignores text without money verb', () {
      expect(parser.parse(ev('Get Rs. 100 off with code XYZ')), isNull);
    });
  });

  group('categorizer', () {
    test('known merchant', () {
      final t = parser.parse(ev('You have paid Rs. 500 to Bhatbhateni Supermarket.'))!;
      cat.categorize(t);
      expect(t.category, 'Groceries');
      expect(t.categoryConfidence, greaterThanOrEqualTo(Categorizer.reviewThreshold));
    });

    test('learns from correction', () {
      final c = Categorizer();
      final t1 = parser.parse(ev('You have paid Rs. 300 to Hari Shrestha.'))!;
      c.categorize(t1);
      expect(t1.categoryConfidence, lessThan(Categorizer.reviewThreshold));
      c.learn(t1, 'Rent');

      final t2 = parser.parse(ev('You have paid Rs. 15000 to Hari Shrestha.'))!;
      c.categorize(t2);
      expect(t2.category, 'Rent');
      expect(t2.categoryConfidence, 1.0);
    });
  });

  group('dedup', () {
    final d = Deduplicator();
    test('same ref id is duplicate', () {
      final a = parser.parse(ev('Paid Rs. 500 to Daraz. Ref ID: ABC123456'))!;
      final b = parser.parse(ev('Payment Rs 500 to DARAZ Ref: ABC123456', at: DateTime(2026, 10, 14, 18)))!;
      expect(d.isDuplicate(b, [a]), isTrue);
    });

    test('amount + time window without ref', () {
      final a = parser.parse(ev('Paid Rs. 500 to Daraz.'))!;
      final b = parser.parse(ev('Paid Rs. 500 to Daraz Nepal.', at: DateTime(2026, 10, 14, 12, 2)))!;
      expect(d.isDuplicate(b, [a]), isTrue);
    });

    test('rejected draft still blocks re-drafting', () {
      final a = parser.parse(ev('Paid Rs. 500 to Daraz.'))!..status = TxnStatus.rejected;
      final b = parser.parse(ev('Paid Rs. 500 to Daraz.', at: DateTime(2026, 10, 14, 12, 1)))!;
      expect(d.isDuplicate(b, [a]), isTrue);
    });

    test('same amount far apart is not duplicate', () {
      final a = parser.parse(ev('Paid Rs. 500 to Daraz.'))!;
      final b = parser.parse(ev('Paid Rs. 500 to Daraz.', at: DateTime(2026, 10, 14, 15)))!;
      expect(d.isDuplicate(b, [a]), isFalse);
    });
  });
}
