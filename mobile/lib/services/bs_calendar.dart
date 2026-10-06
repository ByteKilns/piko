// Dart port of the web's src/lib/nepali-date.ts converter, driven by the same
// month-length table. The table comes from /api/mobile/calendar when it can be
// fetched, else from the bundled assets/bs_calendar.json (kept identical to
// the web's copy by a web unit test), so the app and website always agree.

enum AppDateFormat { nepali, english }

const nepaliMonths = [
  'Baisakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
];

const _englishMonthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

class BsDate {
  final int year;
  final int month;
  final int day;

  const BsDate(this.year, this.month, this.day);

  @override
  bool operator ==(Object other) =>
      other is BsDate && other.year == year && other.month == month && other.day == day;

  @override
  int get hashCode => Object.hash(year, month, day);

  @override
  String toString() => 'BsDate($year-$month-$day)';
}

class BsCalendar {
  final int firstYear;
  final DateTime _firstDayAd;
  final List<List<int>> _monthDays;
  final List<int> _yearStart;

  BsCalendar._(this.firstYear, this._firstDayAd, this._monthDays) : _yearStart = [0] {
    for (final months in _monthDays) {
      _yearStart.add(_yearStart.last + months.reduce((a, b) => a + b));
    }
  }

  factory BsCalendar.fromJson(Map<String, dynamic> json) {
    final monthDays = (json['monthDays'] as List<dynamic>)
        .map((year) => (year as List<dynamic>).map((d) => d as int).toList())
        .toList();
    if (monthDays.isEmpty || monthDays.any((m) => m.length != 12)) {
      throw const FormatException('BS calendar table must have 12 months per year');
    }
    return BsCalendar._(json['firstYear'] as int, _parseAd(json['firstDayAd'] as String), monthDays);
  }

  int get lastYear => firstYear + _monthDays.length - 1;

  int daysInMonth(int year, int month) => _monthsOf(year)[month - 1];

  // ad is a "YYYY-MM-DD" AD string — the format the API stores and sends.
  BsDate adToBs(String ad) {
    var offset = _parseAd(ad).difference(_firstDayAd).inDays;
    if (offset < 0 || offset >= _yearStart.last) {
      throw RangeError('$ad is outside BS $firstYear-$lastYear');
    }
    var index = 0;
    while (_yearStart[index + 1] <= offset) {
      index++;
    }
    offset -= _yearStart[index];
    final months = _monthDays[index];
    var month = 0;
    while (offset >= months[month]) {
      offset -= months[month++];
    }
    return BsDate(firstYear + index, month + 1, offset + 1);
  }

  String bsToAd(BsDate bs) {
    final months = _monthsOf(bs.year);
    if (bs.month < 1 || bs.month > 12 || bs.day < 1 || bs.day > months[bs.month - 1]) {
      throw RangeError('$bs is not a valid BS date');
    }
    var offset = _yearStart[bs.year - firstYear] + bs.day - 1;
    for (var i = 0; i < bs.month - 1; i++) {
      offset += months[i];
    }
    return formatAd(_firstDayAd.add(Duration(days: offset)));
  }

  List<int> _monthsOf(int year) {
    if (year < firstYear || year > lastYear) {
      throw RangeError('BS year $year is outside $firstYear-$lastYear');
    }
    return _monthDays[year - firstYear];
  }
}

// UTC so day arithmetic never crosses a DST or timezone boundary.
DateTime _parseAd(String ad) {
  final parts = ad.split('-').map(int.parse).toList();
  return DateTime.utc(parts[0], parts[1], parts[2]);
}

String formatAd(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

// "19 Ashwin 2083" / "5 Oct 2026"
String formatAppDate(String ad, AppDateFormat format, BsCalendar calendar) {
  if (format == AppDateFormat.nepali) {
    final bs = calendar.adToBs(ad);
    return '${bs.day} ${nepaliMonths[bs.month - 1]} ${bs.year}';
  }
  final d = _parseAd(ad);
  return '${d.day} ${_englishMonthsShort[d.month - 1]} ${d.year}';
}
