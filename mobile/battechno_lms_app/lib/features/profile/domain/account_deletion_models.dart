class AccountDeletionRequest {
  const AccountDeletionRequest({
    required this.id,
    required this.status,
    this.reason,
    this.requestedAt,
    this.processedAt,
    this.cancelledAt,
  });

  final String id;
  final String status;
  final String? reason;
  final DateTime? requestedAt;
  final DateTime? processedAt;
  final DateTime? cancelledAt;

  bool get isPending => status == 'pending';
  bool get isProcessing => status == 'processing';
  bool get isCompleted => status == 'completed';
  bool get isRejected => status == 'rejected';
  bool get isCancelled => status == 'cancelled';
  bool get isActive => isPending || isProcessing;
  bool get canCancel => isPending;

  factory AccountDeletionRequest.fromJson(Map<String, dynamic> json) {
    DateTime? parseDt(Object? v) {
      if (v == null) return null;
      return DateTime.tryParse(v.toString());
    }

    return AccountDeletionRequest(
      id: json['id']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      reason: json['reason']?.toString(),
      requestedAt: parseDt(json['requested_at']),
      processedAt: parseDt(json['processed_at']),
      cancelledAt: parseDt(json['cancelled_at']),
    );
  }
}

class AccountDeletionStatusPayload {
  const AccountDeletionStatusPayload({
    required this.hasActiveRequest,
    this.request,
  });

  final bool hasActiveRequest;
  final AccountDeletionRequest? request;

  factory AccountDeletionStatusPayload.fromJson(Map<String, dynamic> json) {
    final raw = json['request'];
    return AccountDeletionStatusPayload(
      hasActiveRequest: json['has_active_request'] == true,
      request: raw is Map<String, dynamic>
          ? AccountDeletionRequest.fromJson(raw)
          : null,
    );
  }
}
