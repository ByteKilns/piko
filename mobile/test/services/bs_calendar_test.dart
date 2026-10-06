import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:piko/services/bs_calendar.dart';

void main() {
  final calendar = BsCalendar.fromJson(
    jsonDecode(File('assets/bs_calendar.json').readAsStringSync()) as Map<String, dynamic>,
  );

  group('BsCalendar', () {
    // Same published anchors the web pins in src/lib/nepali-date.test.ts.
    const anchors = {
      '2024-04-13': BsDate(2081, 1, 1),
      '2025-04-14': BsDate(2082, 1, 1),
      '2026-04-14': BsDate(2083, 1, 1),
      '2025-10-18': BsDate(2082, 7, 1),
      '2026-09-17': BsDate(2083, 6, 1),
      '2026-10-05': BsDate(2083, 6, 19),
      '2026-10-18': BsDate(2083, 7, 1),
    };

    anchors.forEach((ad, bs) {
      test('$ad is ${bs.year}-${bs.month}-${bs.day} BS', () {
        expect(calendar.adToBs(ad), bs);
        expect(calendar.bsToAd(bs), ad);
      });
    });

    test('Ashwin 2083 has 31 days', () {
      expect(calendar.daysInMonth(2083, 6), 31);
    });

    test('round-trips every day across the supported range', () {
      var day = DateTime.utc(1913, 4, 13);
      final end = DateTime.utc(2044, 4, 12);
      while (!day.isAfter(end)) {
        final ad = day.toIso8601String().substring(0, 10);
        expect(calendar.bsToAd(calendar.adToBs(ad)), ad);
        day = day.add(const Duration(days: 1));
      }
    });

    test('throws a RangeError outside the table', () {
      expect(() => calendar.adToBs('1913-04-12'), throwsRangeError);
      expect(() => calendar.bsToAd(const BsDate(2083, 6, 32)), throwsRangeError);
    });
  });

  group('formatAppDate', () {
    test('formats in BS or AD', () {
      expect(formatAppDate('2026-10-05', AppDateFormat.nepali, calendar), '19 Ashwin 2083');
      expect(formatAppDate('2026-10-05', AppDateFormat.english, calendar), '5 Oct 2026');
    });
  });
}
