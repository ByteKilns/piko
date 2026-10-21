import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:piko/models/expense_draft.dart';
import 'package:piko/services/api_client.dart';

void main() {
  group('ApiClient', () {
    test('login posts credentials and returns the token on 200', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.toString(), 'https://example.com/api/mobile/login');
        expect(jsonDecode(request.body), {'email': 'a@b.com', 'password': 'secret'});
        return http.Response(jsonEncode({'token': 'jwt-123'}), 200);
      });
      final client = ApiClient(
        getBaseUrl: () => 'https://example.com',
        getToken: () => null,
        onUnauthorized: () {},
        client: mockClient,
      );

      final token = await client.login('https://example.com', 'a@b.com', 'secret');

      expect(token, 'jwt-123');
    });

    test('login throws ApiException with the server message on 401', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': {'message': 'Invalid email or password'},
          }),
          401,
        );
      });
      final client = ApiClient(
        getBaseUrl: () => 'https://example.com',
        getToken: () => null,
        onUnauthorized: () {},
        client: mockClient,
      );

      await expectLater(
        client.login('https://example.com', 'a@b.com', 'wrong'),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Invalid email or password')),
      );
    });

    test('fetchCategories sends the bearer token and parses the result', () async {
      final mockClient = MockClient((request) async {
        expect(request.headers['Authorization'], 'Bearer jwt-123');
        return http.Response(
          jsonEncode({
            'categories': [
              {'id': 'cat-1', 'name': 'Groceries'},
            ],
            'members': [
              {'id': 'mem-1', 'name': 'Nirjal'},
            ],
          }),
          200,
        );
      });
      final client = ApiClient(
        getBaseUrl: () => 'https://example.com',
        getToken: () => 'jwt-123',
        onUnauthorized: () {},
        client: mockClient,
      );

      final result = await client.fetchCategories();

      expect(result.categories.single.name, 'Groceries');
      expect(result.members.single.name, 'Nirjal');
    });

    test('an authorized call triggers onUnauthorized and throws on 401', () async {
      var unauthorizedCalled = false;
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': {'message': 'Invalid or expired token'},
          }),
          401,
        );
      });
      final client = ApiClient(
        getBaseUrl: () => 'https://example.com',
        getToken: () => 'stale-token',
        onUnauthorized: () => unauthorizedCalled = true,
        client: mockClient,
      );

      await expectLater(client.fetchCategories(), throwsA(isA<ApiException>()));
      expect(unauthorizedCalled, isTrue);
    });

    test('login does NOT trigger onUnauthorized on its own 401 (wrong password is not a session expiry)', () async {
      var unauthorizedCalled = false;
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': {'message': 'Invalid email or password'},
          }),
          401,
        );
      });
      final client = ApiClient(
        getBaseUrl: () => 'https://example.com',
        getToken: () => null,
        onUnauthorized: () => unauthorizedCalled = true,
        client: mockClient,
      );

      await expectLater(client.login('https://example.com', 'a@b.com', 'wrong'), throwsA(isA<ApiException>()));
      expect(unauthorizedCalled, isFalse);
    });

    test('fetchPacing sends the bearer token and reads Safe to spend', () async {
      final mockClient = MockClient((request) async {
        expect(request.method, 'GET');
        expect(request.url.toString(), 'https://example.com/api/mobile/pacing');
        expect(request.headers['Authorization'], 'Bearer jwt-123');
        return http.Response(
          jsonEncode({
            'pacing': {
              'carryIn': 0,
              'nextWeekAllowance': 490,
              'nextWeekday': 'Wednesday',
              'over': false,
              'overrunNote': null,
              'safeToday': 78,
              'weekLeft': 390,
              'weeklyAllowance': 490,
            },
          }),
          200,
        );
      });
      final client = ApiClient(
        getBaseUrl: () => 'https://example.com',
        getToken: () => 'jwt-123',
        onUnauthorized: () {},
        client: mockClient,
      );

      final pacing = await client.fetchPacing();

      expect(pacing!.safeToday, 78);
      expect(pacing.over, isFalse);
      expect(pacing.nextWeekday, 'Wednesday');
    });

    test('fetchPacing is null without can-cut lines, and throws when the server fails', () async {
      var fail = false;
      final mockClient = MockClient((request) async => fail
          ? http.Response(jsonEncode({'error': {'message': 'Boom'}}), 500)
          : http.Response(jsonEncode({'pacing': null}), 200));
      final client = ApiClient(
        getBaseUrl: () => 'https://example.com',
        getToken: () => 'jwt-123',
        onUnauthorized: () {},
        client: mockClient,
      );

      expect(await client.fetchPacing(), isNull);
      fail = true;
      await expectLater(client.fetchPacing(), throwsA(isA<ApiException>()));
    });

    test('createExpense posts the draft and returns the created expense', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.toString(), 'https://example.com/api/mobile/expenses');
        return http.Response(
          jsonEncode({
            'expense': {
              'id': 'exp-1',
              'amount': 500,
              'categoryId': 'cat-1',
              'ownerMemberId': null,
              'paidByMemberId': 'mem-1',
              'date': '2026-09-03',
              'note': 'test',
            },
          }),
          201,
        );
      });
      final client = ApiClient(
        getBaseUrl: () => 'https://example.com',
        getToken: () => 'jwt-123',
        onUnauthorized: () {},
        client: mockClient,
      );

      final expense = await client.createExpense(
        ExpenseDraft(
          amount: 500,
          categoryId: 'cat-1',
          ownerMemberId: null,
          paidByMemberId: 'mem-1',
          date: '2026-09-03',
          note: 'test',
        ),
      );

      expect(expense.id, 'exp-1');
      expect(expense.amount, 500.0);
    });
  });
}
