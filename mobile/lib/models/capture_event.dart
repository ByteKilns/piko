// One eSewa notification as the phone saw it (OTP digits masked), for the
// Captured notifications screen.
class CaptureEvent {
  final String title;
  final String text;
  final DateTime postedAt; // local time

  CaptureEvent({required this.title, required this.text, required this.postedAt});

  factory CaptureEvent.fromJson(Map<String, dynamic> json) => CaptureEvent(
        title: json['title'] as String,
        text: json['text'] as String,
        postedAt: DateTime.parse(json['postedAt'] as String).toLocal(),
      );

  // What to paste back to tune the parser: the title and the text, as sent.
  String get copyText => '$title\n$text';
}
