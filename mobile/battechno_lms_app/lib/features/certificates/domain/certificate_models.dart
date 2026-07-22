class StudentCertificate {
  const StudentCertificate({
    required this.id,
    required this.certificateNo,
    required this.status,
    required this.issuedAt,
    required this.verificationCode,
    this.qrCodeUrl,
    this.microCredentialTitle,
    this.cohortTitle,
  });

  final String id;
  final String certificateNo;
  final String status;
  final String issuedAt;
  final String verificationCode;
  final String? qrCodeUrl;
  final String? microCredentialTitle;
  final String? cohortTitle;

  factory StudentCertificate.fromMap(Map<String, dynamic> map) {
    final micro = map['micro_credential'] is Map<String, dynamic>
        ? map['micro_credential'] as Map<String, dynamic>
        : null;
    final cohort = map['cohort'] is Map<String, dynamic>
        ? map['cohort'] as Map<String, dynamic>
        : null;
    return StudentCertificate(
      id: map['id']?.toString() ?? '',
      certificateNo: map['certificate_no']?.toString() ?? '',
      status: map['status']?.toString() ?? '',
      issuedAt: map['issued_at']?.toString() ?? '',
      verificationCode: map['verification_code']?.toString() ?? '',
      qrCodeUrl: map['qr_code_url']?.toString(),
      microCredentialTitle: micro?['title']?.toString(),
      cohortTitle: cohort?['title']?.toString(),
    );
  }

  String get displayTitle =>
      microCredentialTitle ?? cohortTitle ?? certificateNo;
}

class CompletionLetterItem {
  const CompletionLetterItem({
    required this.applicationId,
    required this.opportunityTitle,
    required this.issuedAt,
  });

  final String applicationId;
  final String opportunityTitle;
  final String? issuedAt;
}

class CertificateLabels {
  static String statusAr(String? status) {
    switch (status) {
      case 'issued':
        return 'صادرة';
      case 'revoked':
        return 'ملغاة';
      case 'superseded':
        return 'مستبدلة';
      default:
        return status?.isNotEmpty == true ? status! : 'غير محدد';
    }
  }
}
