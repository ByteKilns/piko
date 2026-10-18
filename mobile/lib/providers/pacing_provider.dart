import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/pacing.dart';
import 'api_client_provider.dart';

// Home's Safe to spend today. Home refreshes it when the app comes back,
// on pull to refresh, after saving an expense and after the Review screen.
final pacingProvider = FutureProvider.autoDispose<Pacing?>((ref) => ref.watch(apiClientProvider).fetchPacing());
