import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:piko/esewa/background.dart';
import 'package:piko/services/settings_service.dart';
import 'package:piko/services/token_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Tokens implements TokenStorage {
  _Tokens(this.token);

  final String? token;

  @override
  Future<String?> readToken() async => token;

  @override
  Future<void> writeToken(String token) async {}

  @override
  Future<void> clearToken() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const method = MethodChannel('finance/esewa');
  const events = EventChannel('finance/esewa/events');
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  // Native side: the queue, and every call Dart made, in order.
  late List<Map<String, Object>> queue;
  late List<String> calls;
  late List<http.Request> requests;
  late int serverStatus;

  setUp(() {
    SharedPreferences.setMockInitialValues({'piko_server_url': 'https://piko.test'});
    queue = [
      {
        'id': 'k@1',
        'key': 'k',
        'postedAt': DateTime(2026, 10, 17, 12).millisecondsSinceEpoch,
        'source': 'notification',
        'text': 'You have paid Rs. 500 to Daraz.',
        'title': 'eSewa',
      },
    ];
    calls = [];
    requests = [];
    serverStatus = 200;
    messenger.setMockMethodCallHandler(method, (call) async {
      calls.add(call.method);
      switch (call.method) {
        case 'pending':
          return jsonEncode(queue);
        case 'ack':
          final ids = (call.arguments as List).cast<String>();
          queue.removeWhere((e) => ids.contains(e['id']));
      }
      return null;
    });
    messenger.setMockStreamHandler(events, MockStreamHandler.inline(onListen: (_, _) {}));
  });

  tearDown(() {
    messenger.setMockMethodCallHandler(method, null);
    messenger.setMockStreamHandler(events, null);
  });

  http.Client server() => MockClient((request) async {
        requests.add(request);
        if (serverStatus != 200) return http.Response('{}', serverStatus);
        final body = switch (request.url.path) {
          '/api/mobile/captures' => {
              'capture': {'id': 'cap-1'},
              'created': true,
            },
          '/api/mobile/captures/around' => {'captures': <Object>[]},
          '/api/mobile/capture-rules' => {'rules': <Object>[]},
          '/api/mobile/categories' => {'categories': <Object>[], 'members': <Object>[], 'currentMemberId': 'mem-1'},
          _ => <String, Object>{},
        };
        return http.Response(jsonEncode(body), 200);
      });

  test('signed in: stores the queue on the saved server, alerts, then says it is finished', () async {
    await runEsewaBackground(tokens: _Tokens('jwt'), settings: SettingsService(), client: server(), supported: true);

    expect(queue, isEmpty);
    expect(requests.map((r) => r.url.host).toSet(), {'piko.test'});
    expect(requests.every((r) => r.headers['Authorization'] == 'Bearer jwt'), isTrue);
    expect(calls, containsAllInOrder(['pending', 'ack', 'notify', 'finished']));
    expect(calls.last, 'finished');
  });

  test('signed out: stores nothing, leaves the queue, and still says it is finished', () async {
    await runEsewaBackground(tokens: _Tokens(null), settings: SettingsService(), client: server(), supported: true);

    expect(requests, isEmpty);
    expect(queue, hasLength(1));
    expect(calls, ['finished']);
  });

  test('server down: leaves the queue for next time and still says it is finished', () async {
    serverStatus = 500;

    await runEsewaBackground(tokens: _Tokens('jwt'), settings: SettingsService(), client: server(), supported: true);

    expect(queue, hasLength(1));
    expect(calls, isNot(contains('notify')));
    expect(calls.last, 'finished');
  });
}
