import 'package:flutter/material.dart';

import '../services/bs_calendar.dart';
import '../theme/app_theme.dart';

const _weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Bikram Sambat counterpart of showDatePicker. Takes and returns "YYYY-MM-DD"
// AD strings — the API only ever sees AD — so BS is purely what the user sees.
Future<String?> showBsDatePicker(
  BuildContext context, {
  required BsCalendar calendar,
  required String initialAd,
  required String todayAd,
}) {
  return showDialog<String>(
    context: context,
    // Width capped so the square day cells stay phone-sized and the grid fits
    // vertically; scrollable for landscape.
    builder: (_) => Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: SingleChildScrollView(
          child: _BsDatePicker(calendar: calendar, initialAd: initialAd, todayAd: todayAd),
        ),
      ),
    ),
  );
}

class _BsDatePicker extends StatefulWidget {
  final BsCalendar calendar;
  final String initialAd;
  final String todayAd;

  const _BsDatePicker({required this.calendar, required this.initialAd, required this.todayAd});

  @override
  State<_BsDatePicker> createState() => _BsDatePickerState();
}

class _BsDatePickerState extends State<_BsDatePicker> {
  late BsDate _selected;
  late int _year;
  late int _month;

  @override
  void initState() {
    super.initState();
    _selected = widget.calendar.adToBs(widget.initialAd);
    _year = _selected.year;
    _month = _selected.month;
  }

  bool get _canGoBack => _year > widget.calendar.firstYear || _month > 1;
  bool get _canGoForward => _year < widget.calendar.lastYear || _month < 12;

  void _shiftMonth(int delta) {
    setState(() {
      final index = _year * 12 + (_month - 1) + delta;
      _year = index ~/ 12;
      _month = index % 12 + 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    final calendar = widget.calendar;
    final today = calendar.adToBs(widget.todayAd);
    final firstAd = calendar.bsToAd(BsDate(_year, _month, 1)).split('-').map(int.parse).toList();
    // DateTime.weekday is 1 (Mon)..7 (Sun); the grid starts on Sunday.
    final leadingBlanks = DateTime.utc(firstAd[0], firstAd[1], firstAd[2]).weekday % 7;
    final dayCount = calendar.daysInMonth(_year, _month);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              IconButton(
                key: const Key('bs-prev-month'),
                onPressed: _canGoBack ? () => _shiftMonth(-1) : null,
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Text(
                  '${nepaliMonths[_month - 1]} $_year',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: AppColors.textPrimary),
                ),
              ),
              IconButton(
                key: const Key('bs-next-month'),
                onPressed: _canGoForward ? () => _shiftMonth(1) : null,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 7,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              for (final d in _weekdays)
                Center(child: Text(d, style: const TextStyle(color: AppColors.textMuted, fontSize: 12))),
              for (var i = 0; i < leadingBlanks; i++) const SizedBox.shrink(),
              for (var day = 1; day <= dayCount; day++) _dayCell(BsDate(_year, _month, day), today),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(widget.todayAd),
                child: const Text('Today'),
              ),
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _dayCell(BsDate date, BsDate today) {
    final isSelected = date == _selected;
    final isToday = date == today;
    return Padding(
      padding: const EdgeInsets.all(2),
      child: Material(
        color: isSelected ? AppColors.primary : Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: () => Navigator.of(context).pop(widget.calendar.bsToAd(date)),
          child: Center(
            child: Text(
              '${date.day}',
              style: TextStyle(
                color: isSelected ? Colors.white : (isToday ? AppColors.primary : AppColors.textPrimary),
                fontWeight: isToday || isSelected ? FontWeight.w700 : FontWeight.w400,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
