# Flutter Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Android-only Flutter app ("Piko") that consumes the `/api/mobile/*` REST API already merged to `main`, letting either of two household members log in, record an expense by voice (confirm/edit before saving), or add one manually, and see a short recent-expenses list.

**Architecture:** A `mobile/` Flutter project at the repo root, independent of the Next.js toolchain. Riverpod holds three small pieces of state (server URL, auth token, and the recent-expenses/categories lists); a plain `ApiClient` class wraps `http` and centralizes bearer-header injection and 401 handling; screens are thin and read providers, while the one non-trivial widget (the expense confirm/edit sheet) is built decoupled from Riverpod so it's directly widget-testable.

**Tech Stack:** Flutter 3.44 / Dart 3.12 (already installed locally), `flutter_riverpod`, `http`, `speech_to_text`, `flutter_secure_storage`, `shared_preferences`, `flutter_launcher_icons` (dev).

**Scope note:** This plan covers the mobile app only. It depends on the already-implemented and merged `/api/mobile/*` API — see
[docs/superpowers/plans/2026-09-03-mobile-api.md](2026-09-03-mobile-api.md) and the design doc at
[docs/superpowers/specs/2026-09-03-flutter-mobile-app-design.md](../specs/2026-09-03-flutter-mobile-app-design.md).

---

## Task 1: Scaffold the Flutter project and add dependencies

**Files:**
- Create: `mobile/` (via `flutter create`)
- Modify: `mobile/pubspec.yaml`

- [ ] **Step 1: Create the project**

Run, from the repo root:

```bash
flutter create --platforms=android --org com.nirjal --project-name piko mobile
```

Expected: a `mobile/` directory appears with the standard Flutter project layout (`lib/main.dart`, `android/`, `pubspec.yaml`, etc.), and `mobile/lib/main.dart` contains Flutter's default counter-app boilerplate — this gets fully replaced in later tasks.

- [ ] **Step 2: Set the app display name**

In `mobile/android/app/src/main/AndroidManifest.xml`, find the `<application>` tag's `android:label` attribute and change it from `"mobile"` to `"Piko"`:

```xml
<application
    android:label="Piko"
    android:name="${applicationName}"
    android:icon="@mipmap/ic_launcher">
```

- [ ] **Step 3: Add dependencies**

Edit `mobile/pubspec.yaml`'s `dependencies:` section (keep the existing `flutter:` / `cupertino_icons:` entries that `flutter create` generated) to add:

```yaml
  flutter_riverpod: ^2.5.0
  http: ^1.2.0
  speech_to_text: ^7.0.0
  flutter_secure_storage: ^9.0.0
  shared_preferences: ^2.2.0
```

And its `dev_dependencies:` section to add:

```yaml
  flutter_launcher_icons: ^0.14.0
```

- [ ] **Step 4: Install and verify**

Run:

```bash
cd mobile
flutter pub get
```

Expected: resolves cleanly (no version conflicts). If any package's `^` constraint doesn't resolve against Flutter 3.44's SDK constraints, bump that one package's version in `pubspec.yaml` to whatever `flutter pub get` reports as compatible, then re-run.

Run:

```bash
flutter analyze
```

Expected: no errors (the default `flutter create` boilerplate is analyzer-clean).

- [ ] **Step 5: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): scaffold Flutter project with core dependencies"
```

---

## Task 2: Data models with JSON parsing, unit tested

**Files:**
- Create: `mobile/lib/models/expense.dart`
- Create: `mobile/lib/models/expense_draft.dart`
- Create: `mobile/lib/models/category_option.dart`
- Create: `mobile/lib/models/member_option.dart`
- Create: `mobile/lib/models/categories_result.dart`
- Create: `mobile/lib/models/voice_parse_result.dart`
- Test: `mobile/test/models/expense_test.dart`
- Test: `mobile/test/models/categories_result_test.dart`
- Test: `mobile/test/models/voice_parse_result_test.dart`

These mirror the JSON shapes returned by the already-built API (see `src/app/api/mobile/*/route.ts` on `main`): `GET /api/mobile/expenses` returns `{expenses: [{id, amount, categoryId, ownerMemberId, paidByMemberId, date, note, ...}]}`; `GET /api/mobile/categories` returns `{categories: [{id,name}], members: [{id,name}]}`; `POST /api/mobile/voice/parse` returns `{ok:true, draft:{amount,categoryId,date,note,ownerMemberId,paidByMemberId}}` or `{ok:false, reason:"not_understood"}`.

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/models/expense_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/expense.dart';
import 'package:piko/models/expense_draft.dart';

void main() {
  group('Expense.fromJson', () {
    test('parses a full expense row, converting amount to double', () {
      final expense = Expense.fromJson({
        'id': 'exp-1',
        'amount': 500,
        'categoryId': 'cat-1',
        'ownerMemberId': 'mem-1',
        'paidByMemberId': 'mem-1',
        'date': '2026-09-03',
        'note': 'groceries',
      });

      expect(expense.id, 'exp-1');
      expect(expense.amount, 500.0);
      expect(expense.categoryId, 'cat-1');
      expect(expense.ownerMemberId, 'mem-1');
      expect(expense.paidByMemberId, 'mem-1');
      expect(expense.date, '2026-09-03');
      expect(expense.note, 'groceries');
    });

    test('treats a null ownerMemberId as shared and a null note as no note', () {
      final expense = Expense.fromJson({
        'id': 'exp-2',
        'amount': 250,
        'categoryId': 'cat-2',
        'ownerMemberId': null,
        'paidByMemberId': 'mem-2',
        'date': '2026-09-01',
        'note': null,
      });

      expect(expense.ownerMemberId, isNull);
      expect(expense.note, isNull);
    });
  });

  group('ExpenseDraft.toJson', () {
    test('serializes every field, including a null ownerMemberId', () {
      final draft = ExpenseDraft(
        amount: 500,
        categoryId: 'cat-1',
        ownerMemberId: null,
        paidByMemberId: 'mem-1',
        date: '2026-09-03',
        note: 'curl test',
      );

      expect(draft.toJson(), {
        'amount': 500,
        'categoryId': 'cat-1',
        'ownerMemberId': null,
        'paidByMemberId': 'mem-1',
        'date': '2026-09-03',
        'note': 'curl test',
      });
    });

    test('copyWith replaces only the given fields and can set ownerMemberId to null', () {
      final draft = ExpenseDraft(
        amount: 500,
        categoryId: 'cat-1',
        ownerMemberId: 'mem-1',
        paidByMemberId: 'mem-1',
        date: '2026-09-03',
        note: null,
      );

      final updated = draft.copyWith(amount: 750, ownerMemberId: null, ownerMemberIdSet: true);

      expect(updated.amount, 750);
      expect(updated.ownerMemberId, isNull);
      expect(updated.categoryId, 'cat-1');
      expect(updated.date, '2026-09-03');
    });
  });
}
```

```dart
// mobile/test/models/categories_result_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/categories_result.dart';

void main() {
  test('CategoriesResult.fromJson parses categories and members', () {
    final result = CategoriesResult.fromJson({
      'categories': [
        {'id': 'cat-1', 'name': 'Groceries'},
        {'id': 'cat-2', 'name': 'Transport'},
      ],
      'members': [
        {'id': 'mem-1', 'name': 'Nirjal'},
        {'id': 'mem-2', 'name': 'Karuna'},
      ],
    });

    expect(result.categories, hasLength(2));
    expect(result.categories.first.id, 'cat-1');
    expect(result.categories.first.name, 'Groceries');
    expect(result.members, hasLength(2));
    expect(result.members.last.name, 'Karuna');
  });
}
```

```dart
// mobile/test/models/voice_parse_result_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/voice_parse_result.dart';

void main() {
  group('VoiceParseResult.fromJson', () {
    test('parses a successful result into a draft', () {
      final result = VoiceParseResult.fromJson({
        'ok': true,
        'draft': {
          'amount': 500,
          'categoryId': 'cat-1',
          'date': '2026-09-03',
          'note': 'groceries',
          'ownerMemberId': 'mem-1',
          'paidByMemberId': 'mem-1',
        },
      });

      expect(result.ok, isTrue);
      expect(result.draft, isNotNull);
      expect(result.draft!.amount, 500.0);
      expect(result.draft!.categoryId, 'cat-1');
    });

    test('parses a not-understood result with no draft', () {
      final result = VoiceParseResult.fromJson({'ok': false, 'reason': 'not_understood'});

      expect(result.ok, isFalse);
      expect(result.draft, isNull);
    });
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && flutter test test/models/`

Expected: FAIL — `Target of URI doesn't exist: 'package:piko/models/expense.dart'` (and similarly for the other two files) since none of the model files exist yet.

- [ ] **Step 3: Implement the models**

```dart
// mobile/lib/models/expense_draft.dart
class ExpenseDraft {
  final double amount;
  final String categoryId;
  final String? ownerMemberId;
  final String paidByMemberId;
  final String date;
  final String? note;

  ExpenseDraft({
    required this.amount,
    required this.categoryId,
    required this.ownerMemberId,
    required this.paidByMemberId,
    required this.date,
    this.note,
  });

  Map<String, dynamic> toJson() => {
        'amount': amount,
        'categoryId': categoryId,
        'ownerMemberId': ownerMemberId,
        'paidByMemberId': paidByMemberId,
        'date': date,
        'note': note,
      };

  ExpenseDraft copyWith({
    double? amount,
    String? categoryId,
    String? ownerMemberId,
    bool ownerMemberIdSet = false,
    String? paidByMemberId,
    String? date,
    String? note,
    bool noteSet = false,
  }) {
    return ExpenseDraft(
      amount: amount ?? this.amount,
      categoryId: categoryId ?? this.categoryId,
      ownerMemberId: ownerMemberIdSet ? ownerMemberId : this.ownerMemberId,
      paidByMemberId: paidByMemberId ?? this.paidByMemberId,
      date: date ?? this.date,
      note: noteSet ? note : (note ?? this.note),
    );
  }
}
```

```dart
// mobile/lib/models/expense.dart
class Expense {
  final String id;
  final double amount;
  final String categoryId;
  final String? ownerMemberId;
  final String paidByMemberId;
  final String date;
  final String? note;

  Expense({
    required this.id,
    required this.amount,
    required this.categoryId,
    required this.ownerMemberId,
    required this.paidByMemberId,
    required this.date,
    required this.note,
  });

  factory Expense.fromJson(Map<String, dynamic> json) {
    return Expense(
      id: json['id'] as String,
      amount: (json['amount'] as num).toDouble(),
      categoryId: json['categoryId'] as String,
      ownerMemberId: json['ownerMemberId'] as String?,
      paidByMemberId: json['paidByMemberId'] as String,
      date: json['date'] as String,
      note: json['note'] as String?,
    );
  }
}
```

```dart
// mobile/lib/models/category_option.dart
class CategoryOption {
  final String id;
  final String name;

  CategoryOption({required this.id, required this.name});

  factory CategoryOption.fromJson(Map<String, dynamic> json) {
    return CategoryOption(id: json['id'] as String, name: json['name'] as String);
  }
}
```

```dart
// mobile/lib/models/member_option.dart
class MemberOption {
  final String id;
  final String name;

  MemberOption({required this.id, required this.name});

  factory MemberOption.fromJson(Map<String, dynamic> json) {
    return MemberOption(id: json['id'] as String, name: json['name'] as String);
  }
}
```

```dart
// mobile/lib/models/categories_result.dart
import 'category_option.dart';
import 'member_option.dart';

class CategoriesResult {
  final List<CategoryOption> categories;
  final List<MemberOption> members;

  CategoriesResult({required this.categories, required this.members});

  factory CategoriesResult.fromJson(Map<String, dynamic> json) {
    return CategoriesResult(
      categories: (json['categories'] as List<dynamic>)
          .map((c) => CategoryOption.fromJson(c as Map<String, dynamic>))
          .toList(),
      members: (json['members'] as List<dynamic>)
          .map((m) => MemberOption.fromJson(m as Map<String, dynamic>))
          .toList(),
    );
  }
}
```

```dart
// mobile/lib/models/voice_parse_result.dart
import 'expense_draft.dart';

class VoiceParseResult {
  final bool ok;
  final ExpenseDraft? draft;

  VoiceParseResult({required this.ok, this.draft});

  factory VoiceParseResult.fromJson(Map<String, dynamic> json) {
    final ok = json['ok'] as bool;
    if (!ok) return VoiceParseResult(ok: false);

    final draftJson = json['draft'] as Map<String, dynamic>;
    return VoiceParseResult(
      ok: true,
      draft: ExpenseDraft(
        amount: (draftJson['amount'] as num).toDouble(),
        categoryId: draftJson['categoryId'] as String,
        ownerMemberId: draftJson['ownerMemberId'] as String?,
        paidByMemberId: draftJson['paidByMemberId'] as String,
        date: draftJson['date'] as String,
        note: draftJson['note'] as String?,
      ),
    );
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `flutter test test/models/`

Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/models mobile/test/models
git commit -m "feat(mobile): add data models with JSON parsing and unit tests"
```

---

## Task 3: Token storage abstraction

A small interface plus a real `flutter_secure_storage`-backed implementation, so later tests can inject an in-memory fake instead of depending on a platform channel.

**Files:**
- Create: `mobile/lib/services/token_storage.dart`

- [ ] **Step 1: Implement it**

```dart
// mobile/lib/services/token_storage.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class TokenStorage {
  Future<String?> readToken();
  Future<void> writeToken(String token);
  Future<void> clearToken();
}

class SecureTokenStorage implements TokenStorage {
  static const _tokenKey = 'piko_auth_token';
  final FlutterSecureStorage _storage;

  SecureTokenStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  @override
  Future<String?> readToken() => _storage.read(key: _tokenKey);

  @override
  Future<void> writeToken(String token) => _storage.write(key: _tokenKey, value: token);

  @override
  Future<void> clearToken() => _storage.delete(key: _tokenKey);
}
```

No test file for this task — `SecureTokenStorage` is a 3-line pass-through to a platform plugin (nothing to unit test without a real device/emulator), and the `TokenStorage` interface it implements is what later tasks' tests exercise via an in-memory fake they define themselves.

- [ ] **Step 2: Analyze**

Run: `flutter analyze`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/services/token_storage.dart
git commit -m "feat(mobile): add TokenStorage interface and secure-storage implementation"
```

---

## Task 4: Settings service (server URL persistence), unit tested

**Files:**
- Create: `mobile/lib/services/settings_service.dart`
- Test: `mobile/test/services/settings_service_test.dart`

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/services/settings_service_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:piko/services/settings_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('SettingsService', () {
    test('readServerUrl returns the default when nothing is stored', () async {
      SharedPreferences.setMockInitialValues({});
      final service = SettingsService();

      expect(await service.readServerUrl(), SettingsService.defaultUrl);
    });

    test('writeServerUrl persists a value that readServerUrl then returns', () async {
      SharedPreferences.setMockInitialValues({});
      final service = SettingsService();

      await service.writeServerUrl('https://example.com');

      expect(await service.readServerUrl(), 'https://example.com');
    });
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `flutter test test/services/settings_service_test.dart`

Expected: FAIL — `Target of URI doesn't exist: 'package:piko/services/settings_service.dart'`.

- [ ] **Step 3: Implement it**

```dart
// mobile/lib/services/settings_service.dart
import 'package:shared_preferences/shared_preferences.dart';

class SettingsService {
  static const _urlKey = 'piko_server_url';
  static const defaultUrl = 'https://piko-kn.vercel.app';

  Future<String> readServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_urlKey) ?? defaultUrl;
  }

  Future<void> writeServerUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_urlKey, url);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `flutter test test/services/settings_service_test.dart`

Expected: PASS — 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/services/settings_service.dart mobile/test/services/settings_service_test.dart
git commit -m "feat(mobile): add SettingsService for persisting the server URL"
```

---

## Task 5: Riverpod providers for settings and auth

**Files:**
- Create: `mobile/lib/providers/settings_provider.dart`
- Create: `mobile/lib/providers/auth_provider.dart`

These wrap Task 3/4's services in Riverpod `StateNotifierProvider`s so the rest of the app reads/writes them reactively. No dedicated unit test file — the logic being added here is a thin `AsyncValue` wrapper around already-tested services; it's exercised indirectly by every later widget/manual test that touches Settings or Login.

- [ ] **Step 1: Settings provider**

```dart
// mobile/lib/providers/settings_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/settings_service.dart';

final settingsServiceProvider = Provider<SettingsService>((ref) => SettingsService());

class ServerUrlNotifier extends StateNotifier<AsyncValue<String>> {
  final SettingsService _service;

  ServerUrlNotifier(this._service) : super(const AsyncValue.loading()) {
    _load();
  }

  Future<void> _load() async {
    state = AsyncValue.data(await _service.readServerUrl());
  }

  Future<void> setUrl(String url) async {
    await _service.writeServerUrl(url);
    state = AsyncValue.data(url);
  }
}

final serverUrlProvider = StateNotifierProvider<ServerUrlNotifier, AsyncValue<String>>(
  (ref) => ServerUrlNotifier(ref.watch(settingsServiceProvider)),
);
```

- [ ] **Step 2: Auth provider**

```dart
// mobile/lib/providers/auth_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/token_storage.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) => SecureTokenStorage());

class AuthNotifier extends StateNotifier<AsyncValue<String?>> {
  final TokenStorage _storage;

  AuthNotifier(this._storage) : super(const AsyncValue.loading()) {
    _load();
  }

  Future<void> _load() async {
    state = AsyncValue.data(await _storage.readToken());
  }

  Future<void> setToken(String token) async {
    await _storage.writeToken(token);
    state = AsyncValue.data(token);
  }

  Future<void> logout() async {
    await _storage.clearToken();
    state = const AsyncValue.data(null);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AsyncValue<String?>>(
  (ref) => AuthNotifier(ref.watch(tokenStorageProvider)),
);
```

- [ ] **Step 3: Analyze**

Run: `flutter analyze`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/providers/settings_provider.dart mobile/lib/providers/auth_provider.dart
git commit -m "feat(mobile): add Riverpod providers for server URL and auth token"
```

---

## Task 6: ApiClient, unit tested with a mocked HTTP client

**Files:**
- Create: `mobile/lib/services/api_client.dart`
- Test: `mobile/test/services/api_client_test.dart`

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/services/api_client_test.dart
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `flutter test test/services/api_client_test.dart`

Expected: FAIL — `Target of URI doesn't exist: 'package:piko/services/api_client.dart'`.

- [ ] **Step 3: Implement it**

```dart
// mobile/lib/services/api_client.dart
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/categories_result.dart';
import '../models/expense.dart';
import '../models/expense_draft.dart';
import '../models/voice_parse_result.dart';

class ApiException implements Exception {
  final String message;
  final int statusCode;

  ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}

class ApiClient {
  final http.Client _client;
  final String Function() getBaseUrl;
  final String? Function() getToken;
  final void Function() onUnauthorized;

  ApiClient({
    required this.getBaseUrl,
    required this.getToken,
    required this.onUnauthorized,
    http.Client? client,
  }) : _client = client ?? http.Client();

  Map<String, dynamic> _decode(http.Response response) {
    if (response.body.isEmpty) return {};
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  String _errorMessage(Map<String, dynamic> body, String fallback) {
    final error = body['error'];
    if (error is Map<String, dynamic> && error['message'] is String) {
      return error['message'] as String;
    }
    return fallback;
  }

  Map<String, dynamic> _parseSuccess(http.Response response, {bool isAuthorized = false}) {
    final body = _decode(response);
    if (response.statusCode == 401 && isAuthorized) {
      onUnauthorized();
    }
    if (response.statusCode >= 400) {
      throw ApiException(_errorMessage(body, 'Request failed'), response.statusCode);
    }
    return body;
  }

  Future<String> login(String baseUrl, String email, String password) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/api/mobile/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    final body = _parseSuccess(response);
    return body['token'] as String;
  }

  Future<Map<String, dynamic>> _authorizedGet(String path) async {
    final response = await _client.get(
      Uri.parse('${getBaseUrl()}$path'),
      headers: {'Authorization': 'Bearer ${getToken()}'},
    );
    return _parseSuccess(response, isAuthorized: true);
  }

  Future<Map<String, dynamic>> _authorizedPost(String path, Map<String, dynamic> body) async {
    final response = await _client.post(
      Uri.parse('${getBaseUrl()}$path'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${getToken()}',
      },
      body: jsonEncode(body),
    );
    return _parseSuccess(response, isAuthorized: true);
  }

  Future<CategoriesResult> fetchCategories() async {
    final body = await _authorizedGet('/api/mobile/categories');
    return CategoriesResult.fromJson(body);
  }

  Future<VoiceParseResult> parseVoiceTranscript(String transcript) async {
    final body = await _authorizedPost('/api/mobile/voice/parse', {'transcript': transcript});
    return VoiceParseResult.fromJson(body);
  }

  Future<List<Expense>> fetchRecentExpenses({int limit = 20}) async {
    final body = await _authorizedGet('/api/mobile/expenses?limit=$limit');
    final rows = body['expenses'] as List<dynamic>;
    return rows.map((e) => Expense.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Expense> createExpense(ExpenseDraft draft) async {
    final body = await _authorizedPost('/api/mobile/expenses', draft.toJson());
    return Expense.fromJson(body['expense'] as Map<String, dynamic>);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `flutter test test/services/api_client_test.dart`

Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/services/api_client.dart mobile/test/services/api_client_test.dart
git commit -m "feat(mobile): add ApiClient with centralized 401 handling, unit tested"
```

---

## Task 7: API client and data providers

**Files:**
- Create: `mobile/lib/providers/api_client_provider.dart`
- Create: `mobile/lib/providers/expenses_provider.dart`
- Create: `mobile/lib/providers/categories_provider.dart`

- [ ] **Step 1: API client provider**

```dart
// mobile/lib/providers/api_client_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/api_client.dart';
import '../services/settings_service.dart';
import 'auth_provider.dart';
import 'settings_provider.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    getBaseUrl: () => ref.read(serverUrlProvider).value ?? SettingsService.defaultUrl,
    getToken: () => ref.read(authProvider).value,
    onUnauthorized: () => ref.read(authProvider.notifier).logout(),
  );
});
```

- [ ] **Step 2: Expenses provider**

```dart
// mobile/lib/providers/expenses_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/expense.dart';
import 'api_client_provider.dart';

final recentExpensesProvider = FutureProvider.autoDispose<List<Expense>>((ref) async {
  final client = ref.watch(apiClientProvider);
  return client.fetchRecentExpenses();
});
```

- [ ] **Step 3: Categories provider**

```dart
// mobile/lib/providers/categories_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/categories_result.dart';
import 'api_client_provider.dart';

final categoriesProvider = FutureProvider<CategoriesResult>((ref) async {
  final client = ref.watch(apiClientProvider);
  return client.fetchCategories();
});
```

No dedicated test file — each of these three providers is a one-line composition of already-tested pieces (`ApiClient`, `serverUrlProvider`, `authProvider`); they're exercised by the Home/Settings/Login screens' manual verification in later tasks.

- [ ] **Step 4: Analyze**

Run: `flutter analyze`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/providers/api_client_provider.dart mobile/lib/providers/expenses_provider.dart mobile/lib/providers/categories_provider.dart
git commit -m "feat(mobile): add ApiClient, recent-expenses, and categories providers"
```

---

## Task 8: App shell — main.dart, routing, and the splash/bootstrap screen

**Files:**
- Modify: `mobile/lib/main.dart`
- Create: `mobile/lib/screens/splash_screen.dart`

- [ ] **Step 1: Replace `main.dart`**

```dart
// mobile/lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'screens/splash_screen.dart';

void main() {
  runApp(const ProviderScope(child: PikoApp()));
}

class PikoApp extends StatelessWidget {
  const PikoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Piko',
      theme: ThemeData(colorSchemeSeed: Colors.deepPurple, useMaterial3: true),
      home: const SplashScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}
```

- [ ] **Step 2: Splash/bootstrap screen**

Reads both providers; once neither is `AsyncLoading`, decides where to go. `serverUrlProvider` always resolves to a value (default or stored — see Task 4), so the routing decision only really depends on whether a token is present.

```dart
// mobile/lib/screens/splash_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import 'home_screen.dart';
import 'login_screen.dart';
import 'settings_screen.dart';

class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final serverUrl = ref.watch(serverUrlProvider);
    final auth = ref.watch(authProvider);

    if (serverUrl.isLoading || auth.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final token = auth.value;
    if (token == null || token.isEmpty) {
      return const LoginScreen();
    }
    return const HomeScreen();
  }
}
```

Note: `serverUrlProvider` already falls back to `SettingsService.defaultUrl` when nothing is stored (Task 4), so there is no "URL missing" branch to route to Settings from here — Settings is reachable from Home's app bar (Task 9) for editing it, not gating first launch. This is a deliberate simplification over the original design note ("no URL saved → Settings"): since a sensible default is always present, gating the very first launch behind Settings would add a screen most users skip past unchanged. If you want the strict "Settings first if nothing was ever explicitly saved" behavior instead, that would need `SettingsService` to distinguish "never set" from "set to the default", which the current boolean-return design doesn't do — flag this to the plan's author if you want that instead of the simplification just described.

- [ ] **Step 3: Analyze**

Run: `flutter analyze`

Expected: errors about `home_screen.dart`, `login_screen.dart`, `settings_screen.dart` not existing yet — expected, they're built in Tasks 9-11. This step is just confirming the *shape* of what you wrote compiles once those exist; don't try to make analyze pass yet. Move on.

- [ ] **Step 4: Commit**

Don't commit yet — this task's files reference screens that don't exist. Commit happens at the end of Task 11 once Settings, Login, and Home all exist and `flutter analyze` is clean end to end. Proceed directly to Task 9.

---

## Task 9: Settings screen

**Files:**
- Create: `mobile/lib/screens/settings_screen.dart`

- [ ] **Step 1: Implement it**

```dart
// mobile/lib/screens/settings_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _urlController;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController();
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final serverUrl = ref.watch(serverUrlProvider);
    final isLoggedIn = ref.watch(authProvider).value != null;

    if (!_initialized && serverUrl.hasValue) {
      _urlController.text = serverUrl.value!;
      _initialized = true;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _urlController,
              decoration: const InputDecoration(labelText: 'Server URL'),
              keyboardType: TextInputType.url,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () async {
                final url = _urlController.text.trim();
                if (url.isEmpty) return;
                await ref.read(serverUrlProvider.notifier).setUrl(url);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Server URL saved')),
                  );
                }
              },
              child: const Text('Save'),
            ),
            if (isLoggedIn) ...[
              const SizedBox(height: 32),
              OutlinedButton(
                onPressed: () async {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) Navigator.of(context).popUntil((route) => route.isFirst);
                },
                child: const Text('Log out'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/screens/settings_screen.dart
git commit -m "feat(mobile): add Settings screen for server URL and logout"
```

(No `flutter analyze`/test run yet — `main.dart` still references `home_screen.dart`/`login_screen.dart`, which don't exist until Tasks 10-11. Analyze and test runs happen at the end of Task 11.)

---

## Task 10: Login screen

**Files:**
- Create: `mobile/lib/screens/login_screen.dart`

- [ ] **Step 1: Implement it**

```dart
// mobile/lib/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/api_client_provider.dart';
import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import '../services/api_client.dart';
import 'home_screen.dart';
import 'settings_screen.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final baseUrl = ref.read(serverUrlProvider).value!;
      final client = ref.read(apiClientProvider);
      final token = await client.login(baseUrl, _emailController.text.trim(), _passwordController.text);
      await ref.read(authProvider.notifier).setToken(token);
      if (mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not reach the server. Check your connection or the server URL.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Log in'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passwordController,
              decoration: const InputDecoration(labelText: 'Password'),
              obscureText: true,
              onSubmitted: (_) => _submitting ? null : _submit(),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Log in'),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/screens/login_screen.dart
git commit -m "feat(mobile): add Login screen"
```

(Analyze/test still deferred to the end of Task 11 — `home_screen.dart` doesn't exist yet.)

---

## Task 11: Home screen with the recent-expenses list

**Files:**
- Create: `mobile/lib/screens/home_screen.dart`
- Create: `mobile/lib/widgets/expense_list_tile.dart`

- [ ] **Step 1: A small list-row widget**

```dart
// mobile/lib/widgets/expense_list_tile.dart
import 'package:flutter/material.dart';

import '../models/category_option.dart';
import '../models/expense.dart';

class ExpenseListTile extends StatelessWidget {
  final Expense expense;
  final CategoryOption? category;

  const ExpenseListTile({super.key, required this.expense, required this.category});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(category?.name ?? 'Uncategorized'),
      subtitle: Text('${expense.date}${expense.note != null ? ' · ${expense.note}' : ''}'),
      trailing: Text(
        'NPR ${expense.amount.toStringAsFixed(0)}',
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
    );
  }
}
```

- [ ] **Step 2: Home screen**

```dart
// mobile/lib/screens/home_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/categories_provider.dart';
import '../providers/expenses_provider.dart';
import '../widgets/expense_list_tile.dart';
import 'settings_screen.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final expensesAsync = ref.watch(recentExpensesProvider);
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Piko'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(recentExpensesProvider),
        child: expensesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ListView(
            children: [
              const SizedBox(height: 80),
              Center(child: Text('Could not load expenses: $error')),
            ],
          ),
          data: (expenses) {
            if (expenses.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 80),
                  Center(child: Text('No expenses yet — tap the mic to add one.')),
                ],
              );
            }
            final categories = categoriesAsync.valueOrNull?.categories ?? [];
            return ListView.separated(
              itemCount: expenses.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final expense = expenses[index];
                final category = categories.where((c) => c.id == expense.categoryId).firstOrNull;
                return ExpenseListTile(expense: expense, category: category);
              },
            );
          },
        ),
      ),
      floatingActionButton: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.small(
            heroTag: 'manual-add',
            onPressed: () {
              // Wired up in Task 14 to open the confirm/edit sheet empty.
            },
            child: const Icon(Icons.add),
          ),
          const SizedBox(height: 12),
          FloatingActionButton.large(
            heroTag: 'voice-add',
            onPressed: () {
              // Wired up in Task 14 to push the voice capture flow.
            },
            child: const Icon(Icons.mic),
          ),
        ],
      ),
    );
  }
}
```

Note: `.firstOrNull` requires Dart's `collection` extensions, which are available on `Iterable` via the `dart:core`-adjacent `package:collection` — actually as of Dart 3, `firstOrNull` is NOT in core `Iterable` without importing `package:collection`. Add it as a dependency: in `mobile/pubspec.yaml`'s `dependencies:`, add `collection: ^1.18.0`, run `flutter pub get`, and add `import 'package:collection/collection.dart';` to the top of `home_screen.dart`.

- [ ] **Step 3: Add the `collection` dependency**

```yaml
  collection: ^1.18.0
```

Run: `flutter pub get`

- [ ] **Step 4: Add the missing import**

At the top of `mobile/lib/screens/home_screen.dart`, add:

```dart
import 'package:collection/collection.dart';
```

- [ ] **Step 5: Full analyze and test run (all screens now exist)**

Run:

```bash
flutter analyze
```

Expected: no errors. Fix any that appear (e.g. missing imports, unused variables) before proceeding — this is the first point where the whole app's shell (main → splash → login/home → settings) compiles together.

Run:

```bash
flutter test
```

Expected: all tests from Tasks 2, 4, and 6 still pass (the UI code added since then has no new test files, so the count shouldn't change).

- [ ] **Step 6: Commit everything from Tasks 8-11 together**

Since Tasks 8-10 were left uncommitted pending a working `flutter analyze`, commit all of it now:

```bash
git add mobile/
git commit -m "feat(mobile): add app shell, splash routing, and Home screen"
```

---

## Task 12: Voice capture flow (speech-to-text + listening/parsing/not-understood states)

**Files:**
- Create: `mobile/lib/screens/voice_capture_screen.dart`

This is a full-screen route pushed from Home's mic button. It manages its own local state machine (`listening` → `parsing` → success-and-pop, or → `notUnderstood`) and pops with an `ExpenseDraft?` result: non-null when there's a draft ready to hand to the confirm/edit sheet (either successfully parsed, or empty if the user chose "Add manually" from the not-understood state), null if the user backs out without producing anything.

- [ ] **Step 1: Implement it**

```dart
// mobile/lib/screens/voice_capture_screen.dart
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import '../models/expense_draft.dart';
import '../providers/api_client_provider.dart';
import '../providers/categories_provider.dart';
import '../services/api_client.dart';

enum _VoiceStage { listening, parsing, notUnderstood }

class VoiceCaptureScreen extends ConsumerStatefulWidget {
  const VoiceCaptureScreen({super.key});

  @override
  ConsumerState<VoiceCaptureScreen> createState() => _VoiceCaptureScreenState();
}

class _VoiceCaptureScreenState extends ConsumerState<VoiceCaptureScreen> {
  final stt.SpeechToText _speech = stt.SpeechToText();
  _VoiceStage _stage = _VoiceStage.listening;
  String _transcript = '';
  String? _notUnderstoodMessage;

  @override
  void initState() {
    super.initState();
    _startListening();
  }

  @override
  void dispose() {
    _speech.stop();
    super.dispose();
  }

  Future<void> _startListening() async {
    final available = await _speech.initialize(
      onError: (error) {
        if (!mounted) return;
        setState(() {
          _stage = _VoiceStage.notUnderstood;
          _notUnderstoodMessage = 'Microphone error: ${error.errorMsg}';
        });
      },
    );

    if (!available) {
      setState(() {
        _stage = _VoiceStage.notUnderstood;
        _notUnderstoodMessage = "Voice input isn't available on this device.";
      });
      return;
    }

    setState(() {
      _stage = _VoiceStage.listening;
      _transcript = '';
    });

    await _speech.listen(
      onResult: (result) {
        if (!mounted) return;
        setState(() => _transcript = result.recognizedWords);
      },
    );
  }

  Future<void> _stopAndParse() async {
    await _speech.stop();
    final transcript = _transcript.trim();
    if (transcript.isEmpty) {
      setState(() {
        _stage = _VoiceStage.notUnderstood;
        _notUnderstoodMessage = "Didn't catch anything — try again.";
      });
      return;
    }
    await _parse(transcript);
  }

  Future<void> _parse(String transcript) async {
    setState(() => _stage = _VoiceStage.parsing);

    try {
      final client = ref.read(apiClientProvider);
      final result = await client.parseVoiceTranscript(transcript);
      if (!mounted) return;

      if (result.ok && result.draft != null) {
        Navigator.of(context).pop(result.draft);
        return;
      }

      setState(() {
        _stage = _VoiceStage.notUnderstood;
        _notUnderstoodMessage = "Couldn't quite catch that as an expense — try rephrasing, or add it manually.";
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _stage = _VoiceStage.notUnderstood;
        _notUnderstoodMessage = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _stage = _VoiceStage.notUnderstood;
        _notUnderstoodMessage = 'Something went wrong — check your connection and try again.';
      });
    }
  }

  ExpenseDraft _emptyDraft() {
    final categories = ref.read(categoriesProvider).valueOrNull;
    final firstCategoryId = categories?.categories.firstOrNull?.id ?? '';
    final firstMemberId = categories?.members.firstOrNull?.id ?? '';
    final today = DateTime.now();
    final dateStr =
        '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    return ExpenseDraft(
      amount: 0,
      categoryId: firstCategoryId,
      ownerMemberId: null,
      paidByMemberId: firstMemberId,
      date: dateStr,
      note: null,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Add by voice')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Center(child: _buildBody()),
      ),
    );
  }

  Widget _buildBody() {
    switch (_stage) {
      case _VoiceStage.listening:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.mic, size: 64, color: Colors.deepPurple),
            const SizedBox(height: 16),
            Text(
              _transcript.isEmpty ? 'Listening… say what you spent.' : _transcript,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _stopAndParse,
              icon: const Icon(Icons.stop),
              label: const Text('Stop'),
            ),
          ],
        );
      case _VoiceStage.parsing:
        return const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Understanding…'),
          ],
        );
      case _VoiceStage.notUnderstood:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_notUnderstoodMessage ?? 'Not understood.', textAlign: TextAlign.center),
            const SizedBox(height: 24),
            Wrap(
              spacing: 8,
              alignment: WrapAlignment.center,
              children: [
                OutlinedButton(onPressed: _startListening, child: const Text('Try again')),
                if (_transcript.isNotEmpty)
                  OutlinedButton(
                    onPressed: () => _parse(_transcript),
                    child: const Text('Retry parsing'),
                  ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(_emptyDraft()),
                  child: const Text('Add manually'),
                ),
              ],
            ),
          ],
        );
    }
  }
}
```

- [ ] **Step 2: Android microphone permission**

Add the microphone permission to `mobile/android/app/src/main/AndroidManifest.xml`, above the `<application>` tag:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```

(`INTERNET` is required for any HTTP call — Flutter's Android template usually includes it by default via the manifest merger from plugins, but declare it explicitly since this app is network-dependent from screen one.)

- [ ] **Step 3: Analyze**

Run: `flutter analyze`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/screens/voice_capture_screen.dart mobile/android/app/src/main/AndroidManifest.xml
git commit -m "feat(mobile): add voice capture flow with listening/parsing/not-understood states"
```

---

## Task 13: Expense confirm/edit sheet, widget tested

Deliberately built as a plain `StatefulWidget` (not a `ConsumerWidget`) that receives its data and an `onSave` callback as constructor parameters — this keeps it directly widget-testable without wiring up a Riverpod `ProviderScope` in the test.

**Files:**
- Create: `mobile/lib/widgets/expense_confirm_sheet.dart`
- Test: `mobile/test/widgets/expense_confirm_sheet_test.dart`

- [ ] **Step 1: Write the failing tests**

```dart
// mobile/test/widgets/expense_confirm_sheet_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense_draft.dart';
import 'package:piko/models/member_option.dart';
import 'package:piko/widgets/expense_confirm_sheet.dart';

void main() {
  final categories = [CategoryOption(id: 'cat-1', name: 'Groceries'), CategoryOption(id: 'cat-2', name: 'Transport')];
  final members = [MemberOption(id: 'mem-1', name: 'Nirjal'), MemberOption(id: 'mem-2', name: 'Karuna')];

  ExpenseDraft draft({double amount = 500}) => ExpenseDraft(
        amount: amount,
        categoryId: 'cat-1',
        ownerMemberId: 'mem-1',
        paidByMemberId: 'mem-1',
        date: '2026-09-03',
        note: 'groceries',
      );

  Future<void> pumpSheet(
    WidgetTester tester, {
    required ExpenseDraft initialDraft,
    required void Function(ExpenseDraft) onSave,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ExpenseConfirmSheet(
            initialDraft: initialDraft,
            categories: categories,
            members: members,
            onSave: (d) async => onSave(d),
          ),
        ),
      ),
    );
  }

  testWidgets('shows the prefilled amount and note', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {});

    expect(find.text('500'), findsOneWidget);
    expect(find.text('groceries'), findsOneWidget);
  });

  testWidgets('Save is disabled when amount is zero or empty', (tester) async {
    await pumpSheet(tester, initialDraft: draft(amount: 0), onSave: (_) {});

    final saveButton = tester.widget<FilledButton>(find.byKey(const Key('save-button')));
    expect(saveButton.onPressed, isNull);
  });

  testWidgets('Save is enabled and calls onSave with the edited amount', (tester) async {
    ExpenseDraft? saved;
    await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d);

    await tester.enterText(find.byKey(const Key('amount-field')), '750');
    await tester.pump();

    final saveButton = tester.widget<FilledButton>(find.byKey(const Key('save-button')));
    expect(saveButton.onPressed, isNotNull);

    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pump();

    expect(saved, isNotNull);
    expect(saved!.amount, 750);
  });

  testWidgets('negative amount keeps Save disabled', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {});

    await tester.enterText(find.byKey(const Key('amount-field')), '-5');
    await tester.pump();

    final saveButton = tester.widget<FilledButton>(find.byKey(const Key('save-button')));
    expect(saveButton.onPressed, isNull);
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `flutter test test/widgets/expense_confirm_sheet_test.dart`

Expected: FAIL — `Target of URI doesn't exist: 'package:piko/widgets/expense_confirm_sheet.dart'`.

- [ ] **Step 3: Implement it**

```dart
// mobile/lib/widgets/expense_confirm_sheet.dart
import 'package:flutter/material.dart';

import '../models/category_option.dart';
import '../models/expense_draft.dart';
import '../models/member_option.dart';

class ExpenseConfirmSheet extends StatefulWidget {
  final ExpenseDraft initialDraft;
  final List<CategoryOption> categories;
  final List<MemberOption> members;
  final Future<void> Function(ExpenseDraft draft) onSave;

  const ExpenseConfirmSheet({
    super.key,
    required this.initialDraft,
    required this.categories,
    required this.members,
    required this.onSave,
  });

  @override
  State<ExpenseConfirmSheet> createState() => _ExpenseConfirmSheetState();
}

class _ExpenseConfirmSheetState extends State<ExpenseConfirmSheet> {
  late TextEditingController _amountController;
  late TextEditingController _noteController;
  late String _categoryId;
  late String _paidByMemberId;
  late String? _ownerMemberId; // null = shared
  late String _date;
  bool _saving = false;

  double get _amount => double.tryParse(_amountController.text) ?? -1;
  bool get _canSave =>
      _amount > 0 &&
      !_saving &&
      widget.categories.any((c) => c.id == _categoryId) &&
      widget.members.any((m) => m.id == _paidByMemberId);

  @override
  void initState() {
    super.initState();
    final d = widget.initialDraft;
    _amountController = TextEditingController(text: d.amount > 0 ? _formatAmount(d.amount) : '');
    _noteController = TextEditingController(text: d.note ?? '');
    _categoryId = d.categoryId;
    _paidByMemberId = d.paidByMemberId;
    _ownerMemberId = d.ownerMemberId;
    _date = d.date;
  }

  String _formatAmount(double amount) {
    return amount == amount.roundToDouble() ? amount.toStringAsFixed(0) : amount.toString();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final draft = ExpenseDraft(
      amount: _amount,
      categoryId: _categoryId,
      ownerMemberId: _ownerMemberId,
      paidByMemberId: _paidByMemberId,
      date: _date,
      note: _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
    );
    try {
      await widget.onSave(draft);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickDate() async {
    final initial = DateTime.tryParse(_date) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(initial.year - 5),
      lastDate: DateTime(initial.year + 1),
    );
    if (picked != null) {
      setState(() {
        _date =
            '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            key: const Key('amount-field'),
            controller: _amountController,
            decoration: const InputDecoration(labelText: 'Amount'),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            key: const Key('category-field'),
            value: widget.categories.any((c) => c.id == _categoryId) ? _categoryId : null,
            decoration: const InputDecoration(labelText: 'Category'),
            items: widget.categories
                .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                .toList(),
            onChanged: (value) => setState(() => _categoryId = value!),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            key: const Key('paid-by-field'),
            value: widget.members.any((m) => m.id == _paidByMemberId) ? _paidByMemberId : null,
            decoration: const InputDecoration(labelText: 'Paid by'),
            items: widget.members
                .map((m) => DropdownMenuItem(value: m.id, child: Text(m.name)))
                .toList(),
            onChanged: (value) => setState(() => _paidByMemberId = value!),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            key: const Key('owner-field'),
            value: _ownerMemberId == null || widget.members.any((m) => m.id == _ownerMemberId) ? _ownerMemberId : null,
            decoration: const InputDecoration(labelText: 'For'),
            items: [
              const DropdownMenuItem<String>(value: null, child: Text('Shared')),
              ...widget.members.map((m) => DropdownMenuItem(value: m.id, child: Text(m.name))),
            ],
            onChanged: (value) => setState(() => _ownerMemberId = value),
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: _pickDate,
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'Date'),
              child: Text(_date),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('note-field'),
            controller: _noteController,
            decoration: const InputDecoration(labelText: 'Note (optional)'),
          ),
          const SizedBox(height: 24),
          FilledButton(
            key: const Key('save-button'),
            onPressed: _canSave ? _save : null,
            child: _saving
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save'),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `flutter test test/widgets/expense_confirm_sheet_test.dart`

Expected: PASS — 4 tests green.

- [ ] **Step 5: Full analyze**

Run: `flutter analyze`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/widgets/expense_confirm_sheet.dart mobile/test/widgets/expense_confirm_sheet_test.dart
git commit -m "feat(mobile): add expense confirm/edit sheet, widget tested"
```

---

## Task 14: Wire Home's buttons to the voice flow and confirm sheet

**Files:**
- Modify: `mobile/lib/screens/home_screen.dart`

- [ ] **Step 1: Add the wiring**

Replace the two `FloatingActionButton`s' empty `onPressed` callbacks and add the two handler methods. The full updated file:

```dart
// mobile/lib/screens/home_screen.dart
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/expense_draft.dart';
import '../providers/api_client_provider.dart';
import '../providers/categories_provider.dart';
import '../providers/expenses_provider.dart';
import '../services/api_client.dart';
import '../widgets/expense_confirm_sheet.dart';
import '../widgets/expense_list_tile.dart';
import 'settings_screen.dart';
import 'voice_capture_screen.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _openVoiceFlow(BuildContext context, WidgetRef ref) async {
    final draft = await Navigator.of(context).push<ExpenseDraft?>(
      MaterialPageRoute(builder: (_) => const VoiceCaptureScreen()),
    );
    if (draft != null && context.mounted) {
      await _openConfirmSheet(context, ref, draft);
    }
  }

  Future<void> _openManualEntry(BuildContext context, WidgetRef ref) async {
    final categories = ref.read(categoriesProvider).valueOrNull;
    final firstCategoryId = categories?.categories.firstOrNull?.id ?? '';
    final firstMemberId = categories?.members.firstOrNull?.id ?? '';
    final today = DateTime.now();
    final dateStr =
        '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    final draft = ExpenseDraft(
      amount: 0,
      categoryId: firstCategoryId,
      ownerMemberId: null,
      paidByMemberId: firstMemberId,
      date: dateStr,
      note: null,
    );
    await _openConfirmSheet(context, ref, draft);
  }

  Future<void> _openConfirmSheet(BuildContext context, WidgetRef ref, ExpenseDraft draft) async {
    final categoriesResult = ref.read(categoriesProvider).valueOrNull;
    if (categoriesResult == null) return;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(sheetContext).viewInsets.bottom),
        child: ExpenseConfirmSheet(
          initialDraft: draft,
          categories: categoriesResult.categories,
          members: categoriesResult.members,
          onSave: (finalDraft) async {
            final client = ref.read(apiClientProvider);
            try {
              await client.createExpense(finalDraft);
              ref.invalidate(recentExpensesProvider);
              if (sheetContext.mounted) Navigator.of(sheetContext).pop();
            } on ApiException catch (e) {
              if (sheetContext.mounted) {
                ScaffoldMessenger.of(sheetContext).showSnackBar(SnackBar(content: Text(e.message)));
              }
            }
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final expensesAsync = ref.watch(recentExpensesProvider);
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Piko'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(recentExpensesProvider),
        child: expensesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ListView(
            children: [
              const SizedBox(height: 80),
              Center(child: Text('Could not load expenses: $error')),
            ],
          ),
          data: (expenses) {
            if (expenses.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 80),
                  Center(child: Text('No expenses yet — tap the mic to add one.')),
                ],
              );
            }
            final categories = categoriesAsync.valueOrNull?.categories ?? [];
            return ListView.separated(
              itemCount: expenses.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final expense = expenses[index];
                final category = categories.firstWhereOrNull((c) => c.id == expense.categoryId);
                return ExpenseListTile(expense: expense, category: category);
              },
            );
          },
        ),
      ),
      floatingActionButton: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.small(
            heroTag: 'manual-add',
            onPressed: () => _openManualEntry(context, ref),
            child: const Icon(Icons.add),
          ),
          const SizedBox(height: 12),
          FloatingActionButton.large(
            heroTag: 'voice-add',
            onPressed: () => _openVoiceFlow(context, ref),
            child: const Icon(Icons.mic),
          ),
        ],
      ),
    );
  }
}
```

Note this replaces the earlier `.firstOrNull` (a `List` extension that doesn't exist for a filtered predicate) with `package:collection`'s `firstWhereOrNull`, which is the correct extension for "find by predicate, or null."

- [ ] **Step 2: Analyze**

Run: `flutter analyze`

Expected: no errors.

- [ ] **Step 3: Manual verification (requires a device/emulator)**

Run: `flutter devices` to confirm at least one Android device or emulator is available, then:

```bash
flutter run
```

Walk through, against your real deployed server:
1. Log in with real credentials.
2. Tap the mic, say something like "I spent 200 rupees on transport", stop, confirm the parsed draft looks right, edit one field, save.
3. Confirm the new expense appears at the top of Home's list.
4. Tap "+", confirm the sheet opens empty with sensible defaults (first category/member, today's date), fill it in, save.
5. Pull to refresh, confirm the list still looks right.
6. Open Settings, confirm the URL field shows the current value, change it to something invalid, confirm login/data calls now fail gracefully, change it back.
7. Log out from Settings, confirm you're returned to Login.

Report back what worked and what didn't — this is the first real end-to-end run of the whole app.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/screens/home_screen.dart
git commit -m "feat(mobile): wire voice and manual entry flows into Home"
```

---

## Task 15: App icon (penguin on purple)

**Files:**
- Create: `mobile/assets/icon/icon.png` (generated, not hand-written)
- Modify: `mobile/pubspec.yaml`

- [ ] **Step 1: Generate the icon PNG with a small Python script**

This draws a simple, flat, minimalist penguin (no emoji-font dependency, so it renders identically regardless of what fonts are installed on the machine generating it) on a solid purple background, at 1024×1024.

Create a temporary script (not committed — delete it after running), e.g. `/tmp/make_icon.py` or your scratch directory:

```python
from PIL import Image, ImageDraw

SIZE = 1024
PURPLE = (103, 58, 183)  # Material deepPurple 500, matches the app's colorSchemeSeed
WHITE = (255, 255, 255)
BLACK = (33, 33, 33)
ORANGE = (255, 152, 0)

img = Image.new("RGB", (SIZE, SIZE), PURPLE)
draw = ImageDraw.Draw(img)

cx, cy = SIZE // 2, SIZE // 2 + 40

# Body (black, rounded)
draw.ellipse([cx - 260, cy - 340, cx + 260, cy + 260], fill=BLACK)
# Belly (white, smaller oval inset on the body)
draw.ellipse([cx - 170, cy - 220, cx + 170, cy + 220], fill=WHITE)
# Eyes (white ovals with black pupils)
draw.ellipse([cx - 110, cy - 260, cx - 40, cy - 180], fill=WHITE)
draw.ellipse([cx + 40, cy - 260, cx + 110, cy - 180], fill=WHITE)
draw.ellipse([cx - 90, cy - 240, cx - 60, cy - 210], fill=BLACK)
draw.ellipse([cx + 60, cy - 240, cx + 90, cy - 210], fill=BLACK)
# Beak (orange triangle)
draw.polygon([(cx - 30, cy - 195), (cx + 30, cy - 195), (cx, cy - 140)], fill=ORANGE)
# Feet (orange, two small ovals at the bottom)
draw.ellipse([cx - 150, cy + 220, cx - 60, cy + 270], fill=ORANGE)
draw.ellipse([cx + 60, cy + 220, cx + 150, cy + 270], fill=ORANGE)

img.save("mobile/assets/icon/icon.png")
print("wrote mobile/assets/icon/icon.png")
```

Run it (from the repo root, adjusting the script path to wherever you saved it):

```bash
mkdir -p mobile/assets/icon
python /tmp/make_icon.py
```

Expected: `mobile/assets/icon/icon.png` exists and is a 1024×1024 PNG.

- [ ] **Step 2: Look at it**

Open `mobile/assets/icon/icon.png` in an image viewer (or read it as an image if your tooling supports that) and confirm it reads as "a simple penguin on purple" at a glance, and still looks reasonable shrunk down to roughly 48×48 (launcher-icon size) — flat shapes with strong contrast (black/white/orange on purple) should hold up fine at small sizes. If it looks off (e.g. proportions wrong, shapes overlapping badly), adjust the coordinates in the script and regenerate before moving on — don't hand-edit the PNG.

- [ ] **Step 3: Wire up `flutter_launcher_icons`**

Add this section to `mobile/pubspec.yaml` (top level, alongside `flutter:`):

```yaml
flutter_launcher_icons:
  android: true
  ios: false
  image_path: "assets/icon/icon.png"
```

- [ ] **Step 4: Generate the launcher icons**

Run:

```bash
cd mobile
flutter pub get
dart run flutter_launcher_icons
```

Expected: output confirms Android icons were generated (files updated under `mobile/android/app/src/main/res/mipmap-*/`).

- [ ] **Step 5: Verify**

Run: `flutter analyze` — expected: no errors (icon generation doesn't touch Dart code).

- [ ] **Step 6: Commit**

```bash
git add mobile/assets/icon/icon.png mobile/pubspec.yaml mobile/android/app/src/main/res/
git commit -m "feat(mobile): add generated penguin app icon"
```

---

## Task 16: Release APK build and final end-to-end check

**Files:** none (build + verification only)

- [ ] **Step 1: Full test suite**

Run: `cd mobile && flutter test`

Expected: all tests from Tasks 2, 4, 6, and 13 pass (14 tests total: 6 model tests + 2 settings tests + 6 API client tests... — recount as you go, the exact number isn't load-bearing, "no failures" is).

- [ ] **Step 2: Full analyze**

Run: `flutter analyze`

Expected: no errors, no warnings worth ignoring.

- [ ] **Step 3: Build a release APK**

Run:

```bash
flutter build apk --release
```

Expected: succeeds, producing `mobile/build/app/outputs/flutter-apk/app-release.apk`.

- [ ] **Step 4: Install and do one final real-device pass**

Transfer `app-release.apk` to both phones (however you normally share files between them) and install it (Android will need "install from unknown sources" allowed for this app, since it's not from the Play Store). On each phone:
1. Open the app, confirm the penguin icon and "Piko" name show correctly.
2. Log in with each person's real credentials.
3. Add one real expense by voice, confirm it shows up correctly on the web app too (cross-check at your deployed URL's `/expenses` page).
4. Confirm both of you can see each other's household data (since you share a household) but nothing outside it.

- [ ] **Step 5: No commit needed** — this task is verification of what's already committed. If Step 4 surfaces a bug, fix it as a new small commit and re-run Steps 1-4.

---

## What's next

Once both of you have used it for a few days, revisit the "Out of scope" list in the design doc — the most likely first addition is probably editing/deleting a past expense from mobile, if that turns out to matter in practice.
