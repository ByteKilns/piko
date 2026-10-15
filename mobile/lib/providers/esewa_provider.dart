import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../esewa/esewa_service.dart';
import '../esewa/piko_txn_repository.dart';
import 'api_client_provider.dart';
import 'auth_provider.dart';
import 'categories_provider.dart';

// eSewa auto-capture for the signed-in person. Null when signed out, so
// nothing is filed under nobody: notifications wait in the phone's queue.
final esewaRepositoryProvider = Provider<PikoTxnRepository?>((ref) {
  final token = ref.watch(authProvider).value;
  if (token == null || token.isEmpty) return null;
  return PikoTxnRepository(client: ref.watch(apiClientProvider), options: () => ref.read(categoriesProvider.future));
});

final esewaServiceProvider = Provider<EsewaService?>((ref) {
  final repo = ref.watch(esewaRepositoryProvider);
  if (repo == null) return null;
  final service = EsewaService(repo);
  ref.onDispose(service.dispose);
  return service;
});

// How many drafts wait for review, for Home's strip. 0 when it can't tell.
final esewaDraftCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final service = ref.watch(esewaServiceProvider);
  if (service == null) return 0;
  try {
    return (await service.pendingReview()).length;
  } catch (_) {
    return 0;
  }
});
