import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/offline_cache.dart';

final offlineCacheProvider = FutureProvider<OfflineCache>((ref) async {
  return OfflineCache.open();
});
