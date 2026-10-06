import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/bs_calendar.dart';
import '../services/settings_service.dart';

final settingsServiceProvider = Provider<SettingsService>((ref) => SettingsService());

class ServerUrlNotifier extends StateNotifier<AsyncValue<String>> {
  final SettingsService _service;

  ServerUrlNotifier(this._service) : super(const AsyncValue.loading()) {
    _load();
  }

  Future<void> _load() async {
    try {
      state = AsyncValue.data(await _service.readServerUrl());
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> setUrl(String url) async {
    await _service.writeServerUrl(url);
    state = AsyncValue.data(url);
  }
}

final serverUrlProvider = StateNotifierProvider<ServerUrlNotifier, AsyncValue<String>>(
  (ref) => ServerUrlNotifier(ref.watch(settingsServiceProvider)),
);

class DateFormatNotifier extends StateNotifier<AppDateFormat> {
  final SettingsService _service;

  // BS until the stored choice loads — the same default the website uses.
  DateFormatNotifier(this._service) : super(AppDateFormat.nepali) {
    _load();
  }

  Future<void> _load() async {
    state = await _service.readDateFormat();
  }

  Future<void> setFormat(AppDateFormat format) async {
    state = format;
    await _service.writeDateFormat(format);
  }
}

final dateFormatProvider = StateNotifierProvider<DateFormatNotifier, AppDateFormat>(
  (ref) => DateFormatNotifier(ref.watch(settingsServiceProvider)),
);
