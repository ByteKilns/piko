// The person's "Safe to spend today" from /api/mobile/pacing: the website's
// Home hero figure (weekly pacing over their can-cut budget lines).
class Pacing {
  const Pacing({
    required this.nextWeekAllowance,
    required this.nextWeekday,
    required this.over,
    required this.overrunNote,
    required this.safeToday,
  });

  // The weekly allowance that starts next, and on which weekday.
  final double nextWeekAllowance;
  final String? nextWeekday;

  // This week's allowance is spent.
  final bool over;

  // Set when another line went over and was taken from the can-cut money.
  final String? overrunNote;

  final double safeToday;

  factory Pacing.fromJson(Map<String, dynamic> json) => Pacing(
        nextWeekAllowance: (json['nextWeekAllowance'] as num).toDouble(),
        nextWeekday: json['nextWeekday'] as String?,
        over: json['over'] as bool,
        overrunNote: json['overrunNote'] as String?,
        safeToday: (json['safeToday'] as num).toDouble(),
      );
}
