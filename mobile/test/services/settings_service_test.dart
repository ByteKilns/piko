import 'package:flutter_test/flutter_test.dart';
import 'package:piko/services/bs_calendar.dart';
import 'package:piko/services/settings_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

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

    test('readDateFormat defaults to BS', () async {
      SharedPreferences.setMockInitialValues({});

      expect(await SettingsService().readDateFormat(), AppDateFormat.nepali);
    });

    test('writeDateFormat persists AD', () async {
      SharedPreferences.setMockInitialValues({});
      final service = SettingsService();

      await service.writeDateFormat(AppDateFormat.english);

      expect(await service.readDateFormat(), AppDateFormat.english);
    });
  });
}
