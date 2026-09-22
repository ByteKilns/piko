import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/app_release.dart';
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

  Future<AppRelease?> fetchLatestRelease() async {
    final body = await _authorizedGet('/api/mobile/app-version');
    final latest = body['latest'];
    return latest == null ? null : AppRelease.fromJson(latest as Map<String, dynamic>);
  }
}
