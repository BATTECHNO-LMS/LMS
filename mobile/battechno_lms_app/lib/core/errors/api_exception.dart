class ApiException implements Exception {
  ApiException({
    required this.message,
    this.code,
    this.statusCode,
    this.isNetwork = false,
  });

  final String message;
  final String? code;
  final int? statusCode;
  final bool isNetwork;

  bool get isUnauthorized =>
      statusCode == 401 || code == 'UNAUTHORIZED' || code == 'TOKEN_INVALID';

  bool get isForbidden => statusCode == 403 || code == 'FORBIDDEN';
  bool get isNotFound => statusCode == 404 || code == 'NOT_FOUND';
  bool get isConflict => statusCode == 409 || code == 'CONFLICT';

  bool get isEmailNotVerified => code == 'EMAIL_NOT_VERIFIED';
  bool get isAccountPending => code == 'ACCOUNT_PENDING_ACTIVATION';
  bool get isAccountInactive => code == 'ACCOUNT_INACTIVE';

  @override
  String toString() => message;
}

String mapApiErrorMessage({required String? code, required String fallback}) {
  switch (code) {
    case 'EMAIL_NOT_VERIFIED':
      return 'EMAIL_NOT_VERIFIED';
    case 'ACCOUNT_PENDING_ACTIVATION':
      return 'ACCOUNT_PENDING_ACTIVATION';
    case 'ACCOUNT_INACTIVE':
      return 'ACCOUNT_INACTIVE';
    case 'OTP_RESEND_COOLDOWN':
      return 'OTP_RESEND_COOLDOWN';
    case 'VALIDATION_ERROR':
      return 'VALIDATION_ERROR';
    default:
      return fallback;
  }
}
