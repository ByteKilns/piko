import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/esewa_alerts.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('finance/esewa');
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  late List<String> calls;
  late Object? reply;

  setUp(() {
    calls = [];
    reply = null;
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call.method);
      return reply;
    });
  });

  tearDown(() => messenger.setMockMethodCallHandler(channel, null));

  const alerts = EsewaAlerts(supported: true);

  test('a tapped drafts alert opens the review screen', () async {
    reply = 'review';
    expect(await alerts.takeOpenTarget(), AlertTarget.review);
  });

  test('a tapped couldn\'t-read alert opens Captured notifications', () async {
    reply = 'captured';
    expect(await alerts.takeOpenTarget(), AlertTarget.captured);
  });

  test('opened normally, or with a target it does not know: nothing to open', () async {
    expect(await alerts.takeOpenTarget(), isNull);
    reply = 'somewhere-else';
    expect(await alerts.takeOpenTarget(), isNull);
  });

  test('passes the permission and clearing calls to Android', () async {
    reply = true;
    expect(await alerts.allowed(), isTrue);
    await alerts.askOnce();
    await alerts.request();
    await alerts.clearDrafts();

    expect(calls, ['notificationsAllowed', 'askNotificationsOnce', 'requestNotificationPermission', 'clearDraftAlerts']);
  });

  test('off Android it asks nothing and reports alerts off', () async {
    const off = EsewaAlerts(supported: false);

    expect(await off.allowed(), isFalse);
    expect(await off.takeOpenTarget(), isNull);
    await off.askOnce();
    await off.request();
    await off.clearDrafts();

    expect(calls, isEmpty);
  });
}
