import 'package:flutter_test/flutter_test.dart';

import 'package:battechno_lms_app/core/storage/secure_token_storage.dart';

void main() {
  test('secure storage keys are namespaced for auth token only', () {
    expect(SecureStorageKeys.accessToken, 'battechno_access_token');
  });
}
