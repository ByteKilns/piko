import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import '../models/categories_result.dart';
import '../services/api_client.dart';
import '../services/settings_service.dart';
import '../services/token_storage.dart';
import 'esewa_service.dart';
import 'piko_txn_repository.dart';

const _method = MethodChannel('finance/esewa');

/// What the background engine does when an eSewa notification arrives and no
/// Piko screen is running: drains the phone queue exactly as the app does
/// (the drain also asks the notifier to alert), keeps draining while new
/// notifications wake it, then tells Android it's done so the engine can go.
/// Signed out, it stores nothing: notifications wait in the queue for sign-in.
/// Never throws; whatever wasn't stored stays queued for the next try.
Future<void> runEsewaBackground({
  TokenStorage? tokens,
  SettingsService? settings,
  http.Client? client,
  bool? supported,
}) async {
  try {
    final token = await (tokens ?? SecureTokenStorage()).readToken();
    if (token == null || token.isEmpty) return;
    final baseUrl = await (settings ?? SettingsService()).readServerUrl();
    final api = ApiClient(getBaseUrl: () => baseUrl, getToken: () => token, onUnauthorized: () {}, client: client);
    // Fetched at most once per run, and only if a draft needs a category.
    Future<CategoriesResult>? categories;
    final repo = PikoTxnRepository(client: api, options: () => categories ??= api.fetchCategories());
    final service = EsewaService(repo, supported: supported);
    await service.start();
    await service.idle();
    await service.dispose();
  } catch (_) {
    // Left queued.
  } finally {
    try {
      await _method.invokeMethod('finished');
    } catch (_) {
      // The engine's 60-second limit ends it instead.
    }
  }
}
