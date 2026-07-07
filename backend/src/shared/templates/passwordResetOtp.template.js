/**
 * Arabic-first HTML email templates for BATTECHNO LMS password reset OTP.
 */

function buildPasswordResetOtpHtml({ userName, otp, expiryMinutes }) {
  const safeName = escapeHtml(userName || 'عزيزي/عزيزتي المستخدم');
  const safeOtp = escapeHtml(otp);
  const safeExpiry = escapeHtml(String(expiryMinutes));

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>رمز إعادة تعيين كلمة المرور - BATTECHNO LMS</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f0e8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8dcc8;box-shadow:0 8px 24px rgba(15,35,65,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f2341 0%,#1a3a5c 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#d4af37;font-size:13px;letter-spacing:1px;font-weight:600;">BATTECHNO LMS</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">إعادة تعيين كلمة المرور</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#1a2332;font-size:15px;line-height:1.7;">
              <p style="margin:0 0 16px;">مرحبًا ${safeName}،</p>
              <p style="margin:0 0 16px;">لقد تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابك في BATTECHNO LMS.</p>
              <p style="margin:0 0 20px;">رمز التحقق الخاص بك هو:</p>
              <div style="text-align:center;margin:0 0 24px;">
                <div style="display:inline-block;background:#f5f0e8;border:2px solid #d4af37;border-radius:12px;padding:18px 36px;">
                  <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f2341;font-family:monospace;">${safeOtp}</span>
                </div>
              </div>
              <p style="margin:0 0 12px;color:#4a5568;">هذا الرمز صالح لمدة <strong>${safeExpiry} دقائق</strong> فقط.</p>
              <p style="margin:0;color:#718096;font-size:14px;">إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f5f0e8;padding:20px 32px;text-align:center;border-top:1px solid #e8dcc8;">
              <p style="margin:0 0 4px;color:#0f2341;font-weight:600;font-size:14px;">BATTECHNO LMS</p>
              <p style="margin:0;color:#718096;font-size:12px;">هذا البريد مرسل تلقائيًا، يرجى عدم الرد عليه.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPasswordResetOtpText({ userName, otp, expiryMinutes }) {
  const name = userName || 'عزيزي/عزيزتي المستخدم';
  return `مرحبًا ${name},

لقد تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابك في BATTECHNO LMS.

رمز التحقق الخاص بك هو: ${otp}

هذا الرمز صالح لمدة ${expiryMinutes} دقائق فقط.

إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة.

BATTECHNO LMS
هذا البريد مرسل تلقائيًا، يرجى عدم الرد عليه.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  buildPasswordResetOtpHtml,
  buildPasswordResetOtpText,
};
