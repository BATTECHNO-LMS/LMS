import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
  ];

  /// No description provided for @appName.
  ///
  /// In ar, this message translates to:
  /// **'BATTECHNO LMS'**
  String get appName;

  /// No description provided for @appTagline.
  ///
  /// In ar, this message translates to:
  /// **'منصة التعلّم الجامعي والتدريب الميداني'**
  String get appTagline;

  /// No description provided for @welcomeTitle.
  ///
  /// In ar, this message translates to:
  /// **'مرحبًا بك في رحلتك التعليمية'**
  String get welcomeTitle;

  /// No description provided for @welcomeSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'تابع تدريبك الميداني، مهامك، وتقدّمك الأكاديمي من هاتفك.'**
  String get welcomeSubtitle;

  /// No description provided for @email.
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get email;

  /// No description provided for @password.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور'**
  String get password;

  /// No description provided for @login.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول'**
  String get login;

  /// No description provided for @register.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء حساب'**
  String get register;

  /// No description provided for @forgotPassword.
  ///
  /// In ar, this message translates to:
  /// **'نسيت كلمة المرور؟'**
  String get forgotPassword;

  /// No description provided for @fullName.
  ///
  /// In ar, this message translates to:
  /// **'الاسم الكامل'**
  String get fullName;

  /// No description provided for @phoneOptional.
  ///
  /// In ar, this message translates to:
  /// **'رقم الهاتف (اختياري)'**
  String get phoneOptional;

  /// No description provided for @university.
  ///
  /// In ar, this message translates to:
  /// **'الجامعة'**
  String get university;

  /// No description provided for @specialty.
  ///
  /// In ar, this message translates to:
  /// **'التخصص'**
  String get specialty;

  /// No description provided for @verifyEmail.
  ///
  /// In ar, this message translates to:
  /// **'توثيق البريد الإلكتروني'**
  String get verifyEmail;

  /// No description provided for @otpHint.
  ///
  /// In ar, this message translates to:
  /// **'أدخل الرمز المكوّن من 6 أرقام'**
  String get otpHint;

  /// No description provided for @resendCode.
  ///
  /// In ar, this message translates to:
  /// **'إعادة إرسال الرمز'**
  String get resendCode;

  /// No description provided for @resetPassword.
  ///
  /// In ar, this message translates to:
  /// **'إعادة تعيين كلمة المرور'**
  String get resetPassword;

  /// No description provided for @newPassword.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور الجديدة'**
  String get newPassword;

  /// No description provided for @confirmPassword.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد كلمة المرور'**
  String get confirmPassword;

  /// No description provided for @continueAction.
  ///
  /// In ar, this message translates to:
  /// **'متابعة'**
  String get continueAction;

  /// No description provided for @retry.
  ///
  /// In ar, this message translates to:
  /// **'إعادة المحاولة'**
  String get retry;

  /// No description provided for @logout.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج'**
  String get logout;

  /// No description provided for @profile.
  ///
  /// In ar, this message translates to:
  /// **'حسابي'**
  String get profile;

  /// No description provided for @home.
  ///
  /// In ar, this message translates to:
  /// **'الرئيسية'**
  String get home;

  /// No description provided for @training.
  ///
  /// In ar, this message translates to:
  /// **'التدريب'**
  String get training;

  /// No description provided for @tasks.
  ///
  /// In ar, this message translates to:
  /// **'المهام'**
  String get tasks;

  /// No description provided for @students.
  ///
  /// In ar, this message translates to:
  /// **'الطلاب'**
  String get students;

  /// No description provided for @grading.
  ///
  /// In ar, this message translates to:
  /// **'التقييم'**
  String get grading;

  /// No description provided for @opportunities.
  ///
  /// In ar, this message translates to:
  /// **'الفرص'**
  String get opportunities;

  /// No description provided for @users.
  ///
  /// In ar, this message translates to:
  /// **'المستخدمون'**
  String get users;

  /// No description provided for @reports.
  ///
  /// In ar, this message translates to:
  /// **'التقارير'**
  String get reports;

  /// No description provided for @reviews.
  ///
  /// In ar, this message translates to:
  /// **'المراجعات'**
  String get reviews;

  /// No description provided for @universities.
  ///
  /// In ar, this message translates to:
  /// **'الجامعات'**
  String get universities;

  /// No description provided for @administration.
  ///
  /// In ar, this message translates to:
  /// **'الإدارة'**
  String get administration;

  /// No description provided for @notifications.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات'**
  String get notifications;

  /// No description provided for @accountPendingTitle.
  ///
  /// In ar, this message translates to:
  /// **'حسابك قيد المراجعة'**
  String get accountPendingTitle;

  /// No description provided for @accountPendingBody.
  ///
  /// In ar, this message translates to:
  /// **'تم توثيق بريدك الإلكتروني. ينتظر حسابك موافقة إدارة الجامعة للتفعيل.'**
  String get accountPendingBody;

  /// No description provided for @accountInactiveTitle.
  ///
  /// In ar, this message translates to:
  /// **'الحساب غير نشط'**
  String get accountInactiveTitle;

  /// No description provided for @accountInactiveBody.
  ///
  /// In ar, this message translates to:
  /// **'لا يمكن الوصول إلى المنصة حاليًا. تواصل مع إدارة الجامعة للمساعدة.'**
  String get accountInactiveBody;

  /// No description provided for @unsupportedRoleTitle.
  ///
  /// In ar, this message translates to:
  /// **'حساب غير مدعوم'**
  String get unsupportedRoleTitle;

  /// No description provided for @unsupportedRoleBody.
  ///
  /// In ar, this message translates to:
  /// **'دور حسابك لم يعد مدعومًا في تطبيق الجوال. تواصل مع الدعم الفني.'**
  String get unsupportedRoleBody;

  /// No description provided for @networkErrorTitle.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الاتصال'**
  String get networkErrorTitle;

  /// No description provided for @networkErrorBody.
  ///
  /// In ar, this message translates to:
  /// **'تحقق من اتصال الإنترنت ثم حاول مجددًا.'**
  String get networkErrorBody;

  /// No description provided for @sessionExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت الجلسة. يرجى تسجيل الدخول مجددًا.'**
  String get sessionExpired;

  /// No description provided for @loading.
  ///
  /// In ar, this message translates to:
  /// **'جاري التحميل…'**
  String get loading;

  /// No description provided for @emptyDashboard.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد بيانات لعرضها حاليًا'**
  String get emptyDashboard;

  /// No description provided for @nextAction.
  ///
  /// In ar, this message translates to:
  /// **'الإجراء التالي'**
  String get nextAction;

  /// No description provided for @trainingProgress.
  ///
  /// In ar, this message translates to:
  /// **'تقدّم التدريب'**
  String get trainingProgress;

  /// No description provided for @completedHours.
  ///
  /// In ar, this message translates to:
  /// **'الساعات المنجزة'**
  String get completedHours;

  /// No description provided for @requiredHours.
  ///
  /// In ar, this message translates to:
  /// **'الساعات المطلوبة'**
  String get requiredHours;

  /// No description provided for @quickActions.
  ///
  /// In ar, this message translates to:
  /// **'إجراءات سريعة'**
  String get quickActions;

  /// No description provided for @eligibleOpportunities.
  ///
  /// In ar, this message translates to:
  /// **'فرص متاحة'**
  String get eligibleOpportunities;

  /// No description provided for @recentActivity.
  ///
  /// In ar, this message translates to:
  /// **'آخر النشاط'**
  String get recentActivity;

  /// No description provided for @greetingMorning.
  ///
  /// In ar, this message translates to:
  /// **'صباح الخير'**
  String get greetingMorning;

  /// No description provided for @greetingEvening.
  ///
  /// In ar, this message translates to:
  /// **'مساء الخير'**
  String get greetingEvening;

  /// No description provided for @fieldTrainingStatus.
  ///
  /// In ar, this message translates to:
  /// **'حالة التدريب الميداني'**
  String get fieldTrainingStatus;

  /// No description provided for @noActiveTraining.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد تدريب ميداني نشط حاليًا'**
  String get noActiveTraining;

  /// No description provided for @emailRequired.
  ///
  /// In ar, this message translates to:
  /// **'يرجى إدخال البريد الإلكتروني'**
  String get emailRequired;

  /// No description provided for @emailInvalid.
  ///
  /// In ar, this message translates to:
  /// **'صيغة البريد الإلكتروني غير صحيحة'**
  String get emailInvalid;

  /// No description provided for @passwordRequired.
  ///
  /// In ar, this message translates to:
  /// **'يرجى إدخال كلمة المرور'**
  String get passwordRequired;

  /// No description provided for @passwordMinRegister.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور يجب أن تكون 6 أحرف على الأقل'**
  String get passwordMinRegister;

  /// No description provided for @passwordMinReset.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور يجب أن تكون 8 أحرف على الأقل'**
  String get passwordMinReset;

  /// No description provided for @passwordMismatch.
  ///
  /// In ar, this message translates to:
  /// **'كلمتا المرور غير متطابقتين'**
  String get passwordMismatch;

  /// No description provided for @nameRequired.
  ///
  /// In ar, this message translates to:
  /// **'يرجى إدخال الاسم الكامل'**
  String get nameRequired;

  /// No description provided for @otpRequired.
  ///
  /// In ar, this message translates to:
  /// **'يرجى إدخال رمز التحقق'**
  String get otpRequired;

  /// No description provided for @otpInvalid.
  ///
  /// In ar, this message translates to:
  /// **'رمز التحقق يجب أن يكون 6 أرقام'**
  String get otpInvalid;

  /// No description provided for @loginFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تسجيل الدخول. تحقق من البيانات وحاول مجددًا.'**
  String get loginFailed;

  /// No description provided for @emailNotVerified.
  ///
  /// In ar, this message translates to:
  /// **'يرجى توثيق بريدك الإلكتروني أولًا.'**
  String get emailNotVerified;

  /// No description provided for @settings.
  ///
  /// In ar, this message translates to:
  /// **'الإعدادات'**
  String get settings;

  /// No description provided for @trainingDetails.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل التدريب'**
  String get trainingDetails;

  /// No description provided for @description.
  ///
  /// In ar, this message translates to:
  /// **'الوصف'**
  String get description;

  /// No description provided for @trainingDates.
  ///
  /// In ar, this message translates to:
  /// **'تواريخ التدريب'**
  String get trainingDates;

  /// No description provided for @requiredHoursNotSet.
  ///
  /// In ar, this message translates to:
  /// **'لم يتم تحديد عدد الساعات المطلوبة بعد'**
  String get requiredHoursNotSet;

  /// No description provided for @remainingHours.
  ///
  /// In ar, this message translates to:
  /// **'الساعات المتبقية'**
  String get remainingHours;

  /// No description provided for @noTasksCurrently.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مهام مطلوبة حاليًا'**
  String get noTasksCurrently;

  /// No description provided for @taskUntitled.
  ///
  /// In ar, this message translates to:
  /// **'مهمة بدون عنوان'**
  String get taskUntitled;

  /// No description provided for @dueDate.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ الاستحقاق'**
  String get dueDate;

  /// No description provided for @tasksProgressLabel.
  ///
  /// In ar, this message translates to:
  /// **'{submitted} من {total} مهام'**
  String tasksProgressLabel(int submitted, int total);

  /// No description provided for @taskDetails.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل المهمة'**
  String get taskDetails;

  /// No description provided for @taskNotFound.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر العثور على المهمة'**
  String get taskNotFound;

  /// No description provided for @previousSubmission.
  ///
  /// In ar, this message translates to:
  /// **'التسليم السابق'**
  String get previousSubmission;

  /// No description provided for @submittedAt.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ التسليم'**
  String get submittedAt;

  /// No description provided for @submitTask.
  ///
  /// In ar, this message translates to:
  /// **'تسليم المهمة'**
  String get submitTask;

  /// No description provided for @projectUrl.
  ///
  /// In ar, this message translates to:
  /// **'رابط المشروع'**
  String get projectUrl;

  /// No description provided for @submissionNotes.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظاتك (اختياري)'**
  String get submissionNotes;

  /// No description provided for @attachFileOptional.
  ///
  /// In ar, this message translates to:
  /// **'إرفاق ملف (اختياري)'**
  String get attachFileOptional;

  /// No description provided for @fileUploadHint.
  ///
  /// In ar, this message translates to:
  /// **'يمكنك إرفاق PDF أو صورة. في بيئة R2 قد يلزم الرفع عبر الويب لاحقًا.'**
  String get fileUploadHint;

  /// No description provided for @taskSubmitSuccess.
  ///
  /// In ar, this message translates to:
  /// **'تم تسليم المهمة بنجاح'**
  String get taskSubmitSuccess;

  /// No description provided for @aiTaskMobileLimited.
  ///
  /// In ar, this message translates to:
  /// **'هذه المهمة تتطلب التقييم الذاتي بالذكاء الاصطناعي. أكملها من منصة الويب حاليًا.'**
  String get aiTaskMobileLimited;

  /// No description provided for @assessmentsTitle.
  ///
  /// In ar, this message translates to:
  /// **'الاختبارات'**
  String get assessmentsTitle;

  /// No description provided for @preAssessment.
  ///
  /// In ar, this message translates to:
  /// **'الاختبار القبلي'**
  String get preAssessment;

  /// No description provided for @postAssessment.
  ///
  /// In ar, this message translates to:
  /// **'الاختبار البعدي'**
  String get postAssessment;

  /// No description provided for @assessmentAvailable.
  ///
  /// In ar, this message translates to:
  /// **'متاح الآن'**
  String get assessmentAvailable;

  /// No description provided for @assessmentCompleted.
  ///
  /// In ar, this message translates to:
  /// **'مكتمل'**
  String get assessmentCompleted;

  /// No description provided for @assessmentNotPublished.
  ///
  /// In ar, this message translates to:
  /// **'غير منشور بعد'**
  String get assessmentNotPublished;

  /// No description provided for @assessmentLocked.
  ///
  /// In ar, this message translates to:
  /// **'غير متاح حاليًا'**
  String get assessmentLocked;

  /// No description provided for @assessmentUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'غير متاح حاليًا'**
  String get assessmentUnavailable;

  /// No description provided for @startAssessment.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ الاختبار'**
  String get startAssessment;

  /// No description provided for @viewAssessmentResult.
  ///
  /// In ar, this message translates to:
  /// **'عرض النتيجة'**
  String get viewAssessmentResult;

  /// No description provided for @assessmentScoreLabel.
  ///
  /// In ar, this message translates to:
  /// **'النتيجة: {score}%'**
  String assessmentScoreLabel(int score);

  /// No description provided for @assessmentPassScoreLabel.
  ///
  /// In ar, this message translates to:
  /// **'درجة النجاح: {score}%'**
  String assessmentPassScoreLabel(int score);

  /// No description provided for @assessmentInstructions.
  ///
  /// In ar, this message translates to:
  /// **'تعليمات الاختبار'**
  String get assessmentInstructions;

  /// No description provided for @assessmentDefaultInstructions.
  ///
  /// In ar, this message translates to:
  /// **'اقرأ الأسئلة بعناية واختر الإجابة الأنسب. لا يمكن إعادة الاختبار بعد التسليم.'**
  String get assessmentDefaultInstructions;

  /// No description provided for @assessmentQuestionCountLabel.
  ///
  /// In ar, this message translates to:
  /// **'عدد الأسئلة: {count}'**
  String assessmentQuestionCountLabel(int count);

  /// No description provided for @assessmentStartWarning.
  ///
  /// In ar, this message translates to:
  /// **'تأكد من اتصالك بالإنترنت قبل البدء. لن تتمكن من تعديل إجاباتك بعد التسليم.'**
  String get assessmentStartWarning;

  /// No description provided for @assessmentQuestionProgress.
  ///
  /// In ar, this message translates to:
  /// **'السؤال {current} من {total}'**
  String assessmentQuestionProgress(int current, int total);

  /// No description provided for @assessmentAttempt.
  ///
  /// In ar, this message translates to:
  /// **'أداء الاختبار'**
  String get assessmentAttempt;

  /// No description provided for @previousQuestion.
  ///
  /// In ar, this message translates to:
  /// **'السابق'**
  String get previousQuestion;

  /// No description provided for @nextQuestion.
  ///
  /// In ar, this message translates to:
  /// **'التالي'**
  String get nextQuestion;

  /// No description provided for @submitAssessment.
  ///
  /// In ar, this message translates to:
  /// **'تسليم الاختبار'**
  String get submitAssessment;

  /// No description provided for @submitAssessmentConfirmTitle.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد التسليم'**
  String get submitAssessmentConfirmTitle;

  /// No description provided for @submitAssessmentConfirmBody.
  ///
  /// In ar, this message translates to:
  /// **'هل أنت متأكد من تسليم إجاباتك؟ لا يمكن التراجع بعد التسليم.'**
  String get submitAssessmentConfirmBody;

  /// No description provided for @leaveAssessmentTitle.
  ///
  /// In ar, this message translates to:
  /// **'مغادرة الاختبار؟'**
  String get leaveAssessmentTitle;

  /// No description provided for @leaveAssessmentBody.
  ///
  /// In ar, this message translates to:
  /// **'قد تفقد إجاباتك غير المحفوظة على الخادم. هل تريد المغادرة؟'**
  String get leaveAssessmentBody;

  /// No description provided for @leaveAssessmentConfirm.
  ///
  /// In ar, this message translates to:
  /// **'مغادرة'**
  String get leaveAssessmentConfirm;

  /// No description provided for @assessmentResult.
  ///
  /// In ar, this message translates to:
  /// **'نتيجة الاختبار'**
  String get assessmentResult;

  /// No description provided for @assessmentPassed.
  ///
  /// In ar, this message translates to:
  /// **'ناجح'**
  String get assessmentPassed;

  /// No description provided for @assessmentNotPassed.
  ///
  /// In ar, this message translates to:
  /// **'غير ناجح'**
  String get assessmentNotPassed;

  /// No description provided for @assessmentResultPending.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار التقييم'**
  String get assessmentResultPending;

  /// No description provided for @assessmentPendingManual.
  ///
  /// In ar, this message translates to:
  /// **'بعض الإجابات تحتاج تقييمًا يدويًا من المُدرِّب.'**
  String get assessmentPendingManual;

  /// No description provided for @backToTraining.
  ///
  /// In ar, this message translates to:
  /// **'العودة إلى التدريب'**
  String get backToTraining;

  /// No description provided for @trueAnswer.
  ///
  /// In ar, this message translates to:
  /// **'صح'**
  String get trueAnswer;

  /// No description provided for @falseAnswer.
  ///
  /// In ar, this message translates to:
  /// **'خطأ'**
  String get falseAnswer;

  /// No description provided for @yourAnswer.
  ///
  /// In ar, this message translates to:
  /// **'إجابتك'**
  String get yourAnswer;

  /// No description provided for @unsupportedQuestionType.
  ///
  /// In ar, this message translates to:
  /// **'نوع السؤال غير مدعوم على الجوال حاليًا.'**
  String get unsupportedQuestionType;

  /// No description provided for @noAssessmentsRequired.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد اختبارات مطلوبة لهذا التدريب.'**
  String get noAssessmentsRequired;

  /// No description provided for @assessmentNotReady.
  ///
  /// In ar, this message translates to:
  /// **'الاختبار غير جاهز بعد.'**
  String get assessmentNotReady;

  /// No description provided for @trainingJourney.
  ///
  /// In ar, this message translates to:
  /// **'مسار التدريب'**
  String get trainingJourney;

  /// No description provided for @upcomingSession.
  ///
  /// In ar, this message translates to:
  /// **'الجلسة القادمة'**
  String get upcomingSession;

  /// No description provided for @viewAssessments.
  ///
  /// In ar, this message translates to:
  /// **'عرض الاختبارات'**
  String get viewAssessments;

  /// No description provided for @attendanceSummary.
  ///
  /// In ar, this message translates to:
  /// **'ملخص الحضور'**
  String get attendanceSummary;

  /// No description provided for @viewAllSessions.
  ///
  /// In ar, this message translates to:
  /// **'كل الجلسات'**
  String get viewAllSessions;

  /// No description provided for @attendancePercentageLabel.
  ///
  /// In ar, this message translates to:
  /// **'نسبة الحضور: {percent}%'**
  String attendancePercentageLabel(int percent);

  /// No description provided for @sessionsAttendedLabel.
  ///
  /// In ar, this message translates to:
  /// **'{attended} من {required} جلسات'**
  String sessionsAttendedLabel(int attended, int required);

  /// No description provided for @attendanceSummaryUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'ملخص الحضور غير متوفر بعد.'**
  String get attendanceSummaryUnavailable;

  /// No description provided for @trainingSessions.
  ///
  /// In ar, this message translates to:
  /// **'جلسات التدريب'**
  String get trainingSessions;

  /// No description provided for @noSessionsCurrently.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد جلسات مجدولة حاليًا.'**
  String get noSessionsCurrently;

  /// No description provided for @upcomingSessions.
  ///
  /// In ar, this message translates to:
  /// **'الجلسات القادمة'**
  String get upcomingSessions;

  /// No description provided for @pastSessions.
  ///
  /// In ar, this message translates to:
  /// **'الجلسات السابقة'**
  String get pastSessions;

  /// No description provided for @sessionDetails.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل الجلسة'**
  String get sessionDetails;

  /// No description provided for @sessionNotFound.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر العثور على الجلسة'**
  String get sessionNotFound;

  /// No description provided for @sessionTime.
  ///
  /// In ar, this message translates to:
  /// **'وقت الجلسة'**
  String get sessionTime;

  /// No description provided for @sessionRequired.
  ///
  /// In ar, this message translates to:
  /// **'جلسة إلزامية'**
  String get sessionRequired;

  /// No description provided for @attendanceStatus.
  ///
  /// In ar, this message translates to:
  /// **'حالة الحضور'**
  String get attendanceStatus;

  /// No description provided for @yes.
  ///
  /// In ar, this message translates to:
  /// **'نعم'**
  String get yes;

  /// No description provided for @no.
  ///
  /// In ar, this message translates to:
  /// **'لا'**
  String get no;

  /// No description provided for @joinSession.
  ///
  /// In ar, this message translates to:
  /// **'انضم إلى الجلسة'**
  String get joinSession;

  /// No description provided for @noMeetingLink.
  ///
  /// In ar, this message translates to:
  /// **'رابط الاجتماع غير متوفر بعد.'**
  String get noMeetingLink;

  /// No description provided for @openMeetingLinkTitle.
  ///
  /// In ar, this message translates to:
  /// **'فتح رابط الاجتماع'**
  String get openMeetingLinkTitle;

  /// No description provided for @openMeetingLinkBody.
  ///
  /// In ar, this message translates to:
  /// **'سيتم فتح الرابط في تطبيق خارجي. هل تريد المتابعة؟'**
  String get openMeetingLinkBody;

  /// No description provided for @openLink.
  ///
  /// In ar, this message translates to:
  /// **'فتح الرابط'**
  String get openLink;

  /// No description provided for @invalidMeetingLink.
  ///
  /// In ar, this message translates to:
  /// **'رابط الاجتماع غير صالح.'**
  String get invalidMeetingLink;

  /// No description provided for @pendingPreAssessment.
  ///
  /// In ar, this message translates to:
  /// **'اختبار قبلي مطلوب'**
  String get pendingPreAssessment;

  /// No description provided for @pendingPostAssessment.
  ///
  /// In ar, this message translates to:
  /// **'اختبار بعدي مطلوب'**
  String get pendingPostAssessment;

  /// No description provided for @applyToTrainingTitle.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد التقديم'**
  String get applyToTrainingTitle;

  /// No description provided for @applyToTrainingBody.
  ///
  /// In ar, this message translates to:
  /// **'هل تريد التقديم على هذه الفرصة التدريبية؟'**
  String get applyToTrainingBody;

  /// No description provided for @applyNow.
  ///
  /// In ar, this message translates to:
  /// **'قدّم الآن'**
  String get applyNow;

  /// No description provided for @applicationSubmitted.
  ///
  /// In ar, this message translates to:
  /// **'تم إرسال طلبك بنجاح'**
  String get applicationSubmitted;

  /// No description provided for @searchTraining.
  ///
  /// In ar, this message translates to:
  /// **'ابحث في التدريب'**
  String get searchTraining;

  /// No description provided for @noTrainingInSection.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد عناصر في هذا القسم'**
  String get noTrainingInSection;

  /// No description provided for @viewTrainingDetails.
  ///
  /// In ar, this message translates to:
  /// **'عرض التفاصيل'**
  String get viewTrainingDetails;

  /// No description provided for @profileIncompleteForTraining.
  ///
  /// In ar, this message translates to:
  /// **'أكمل ملفك الجامعي من منصة الويب للتقديم على التدريب.'**
  String get profileIncompleteForTraining;

  /// No description provided for @lastUpdatedAt.
  ///
  /// In ar, this message translates to:
  /// **'آخر تحديث: {time}'**
  String lastUpdatedAt(String time);

  /// No description provided for @offlineCachedBanner.
  ///
  /// In ar, this message translates to:
  /// **'يتم عرض بيانات محفوظة مؤقتًا'**
  String get offlineCachedBanner;

  /// No description provided for @notificationsUnreadCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} غير مقروء'**
  String notificationsUnreadCount(int count);

  /// No description provided for @markAllRead.
  ///
  /// In ar, this message translates to:
  /// **'تعليم الكل كمقروء'**
  String get markAllRead;

  /// No description provided for @unreadOnly.
  ///
  /// In ar, this message translates to:
  /// **'غير المقروء فقط'**
  String get unreadOnly;

  /// No description provided for @noNotifications.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد إشعارات حاليًا'**
  String get noNotifications;

  /// No description provided for @notificationTargetUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'لا يمكن فتح هذا الإشعار على الجوال حاليًا'**
  String get notificationTargetUnavailable;

  /// No description provided for @certificatesAndDocuments.
  ///
  /// In ar, this message translates to:
  /// **'الشهادات والوثائق'**
  String get certificatesAndDocuments;

  /// No description provided for @certificatesTitle.
  ///
  /// In ar, this message translates to:
  /// **'الشهادات'**
  String get certificatesTitle;

  /// No description provided for @officialLetters.
  ///
  /// In ar, this message translates to:
  /// **'الخطابات الرسمية'**
  String get officialLetters;

  /// No description provided for @completionLetter.
  ///
  /// In ar, this message translates to:
  /// **'خطاب إتمام التدريب'**
  String get completionLetter;

  /// No description provided for @noCertificatesOrDocuments.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد شهادات أو وثائق متاحة بعد'**
  String get noCertificatesOrDocuments;

  /// No description provided for @certificateDetails.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل الشهادة'**
  String get certificateDetails;

  /// No description provided for @certificateNotFound.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر العثور على الشهادة'**
  String get certificateNotFound;

  /// No description provided for @certificateNumber.
  ///
  /// In ar, this message translates to:
  /// **'رقم الشهادة'**
  String get certificateNumber;

  /// No description provided for @issuedAt.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ الإصدار'**
  String get issuedAt;

  /// No description provided for @certificateStatus.
  ///
  /// In ar, this message translates to:
  /// **'حالة الشهادة'**
  String get certificateStatus;

  /// No description provided for @verificationCode.
  ///
  /// In ar, this message translates to:
  /// **'رمز التحقق'**
  String get verificationCode;

  /// No description provided for @certificateDownloadUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'تنزيل ملف الشهادة غير متوفر حاليًا. يمكنك التحقق عبر الرابط الرسمي.'**
  String get certificateDownloadUnavailable;

  /// No description provided for @verifyCertificate.
  ///
  /// In ar, this message translates to:
  /// **'التحقق من الشهادة'**
  String get verifyCertificate;

  /// No description provided for @documentDownloadFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تنزيل الوثيقة'**
  String get documentDownloadFailed;

  /// No description provided for @profileReadOnlyNotice.
  ///
  /// In ar, this message translates to:
  /// **'تحديث الملف الشخصي غير متاح حاليًا من التطبيق. تواصل مع إدارة الجامعة عند الحاجة.'**
  String get profileReadOnlyNotice;

  /// No description provided for @accountStatus.
  ///
  /// In ar, this message translates to:
  /// **'حالة الحساب'**
  String get accountStatus;

  /// No description provided for @language.
  ///
  /// In ar, this message translates to:
  /// **'اللغة'**
  String get language;

  /// No description provided for @languageArabic.
  ///
  /// In ar, this message translates to:
  /// **'العربية'**
  String get languageArabic;

  /// No description provided for @languageEnglish.
  ///
  /// In ar, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @changePasswordUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'تغيير كلمة المرور'**
  String get changePasswordUnavailable;

  /// No description provided for @useForgotPasswordFlow.
  ///
  /// In ar, this message translates to:
  /// **'استخدم استعادة كلمة المرور من شاشة الدخول'**
  String get useForgotPasswordFlow;

  /// No description provided for @privacyNotice.
  ///
  /// In ar, this message translates to:
  /// **'الخصوصية'**
  String get privacyNotice;

  /// No description provided for @privacyNoticeBody.
  ///
  /// In ar, this message translates to:
  /// **'لا يتم تخزين كلمات المرور أو بيانات التقييم على الجهاز.'**
  String get privacyNoticeBody;

  /// No description provided for @appVersion.
  ///
  /// In ar, this message translates to:
  /// **'إصدار التطبيق'**
  String get appVersion;

  /// No description provided for @logoutServerLimitation.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج يمسح الجلسة محليًا فقط. رموز الخادم قد تبقى نشطة مؤقتًا (QA-AUTH-001).'**
  String get logoutServerLimitation;

  /// No description provided for @certificateReady.
  ///
  /// In ar, this message translates to:
  /// **'وثيقة إتمام جاهزة'**
  String get certificateReady;

  /// No description provided for @viewCertificatesHint.
  ///
  /// In ar, this message translates to:
  /// **'يمكنك عرض أو تنزيل خطاب الإتمام'**
  String get viewCertificatesHint;

  /// No description provided for @myTrainings.
  ///
  /// In ar, this message translates to:
  /// **'تدريباتي'**
  String get myTrainings;

  /// No description provided for @instructorGreeting.
  ///
  /// In ar, this message translates to:
  /// **'مرحباً، {name}'**
  String instructorGreeting(String name);

  /// No description provided for @activeTrainingsCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} تدريب نشط'**
  String activeTrainingsCount(int count);

  /// No description provided for @activeStudentsCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} طالب نشط'**
  String activeStudentsCount(int count);

  /// No description provided for @pendingSubmissionsCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} تسليم بانتظار المراجعة'**
  String pendingSubmissionsCount(int count);

  /// No description provided for @atRiskStudentsCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} طالب يحتاج متابعة'**
  String atRiskStudentsCount(int count);

  /// No description provided for @instructorPriorityReviewSubmissions.
  ///
  /// In ar, this message translates to:
  /// **'راجع {count} تسليمات'**
  String instructorPriorityReviewSubmissions(int count);

  /// No description provided for @instructorPriorityUpcomingSession.
  ///
  /// In ar, this message translates to:
  /// **'افتح التدريب القادم'**
  String get instructorPriorityUpcomingSession;

  /// No description provided for @instructorPriorityRecordAttendance.
  ///
  /// In ar, this message translates to:
  /// **'سجّل حضور جلسة اليوم'**
  String get instructorPriorityRecordAttendance;

  /// No description provided for @instructorPriorityFollowUp.
  ///
  /// In ar, this message translates to:
  /// **'تابع {count} طلاب'**
  String instructorPriorityFollowUp(int count);

  /// No description provided for @instructorPriorityOpenTraining.
  ///
  /// In ar, this message translates to:
  /// **'افتح تدريبك'**
  String get instructorPriorityOpenTraining;

  /// No description provided for @noAssignedTrainings.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد تدريبات معيّنة لك حالياً'**
  String get noAssignedTrainings;

  /// No description provided for @searchAssignedTrainings.
  ///
  /// In ar, this message translates to:
  /// **'ابحث في تدريباتك'**
  String get searchAssignedTrainings;

  /// No description provided for @hours.
  ///
  /// In ar, this message translates to:
  /// **'ساعة'**
  String get hours;

  /// No description provided for @hoursNotSpecified.
  ///
  /// In ar, this message translates to:
  /// **'الساعات غير محددة'**
  String get hoursNotSpecified;

  /// No description provided for @sessions.
  ///
  /// In ar, this message translates to:
  /// **'جلسات'**
  String get sessions;

  /// No description provided for @attendance.
  ///
  /// In ar, this message translates to:
  /// **'الحضور'**
  String get attendance;

  /// No description provided for @participants.
  ///
  /// In ar, this message translates to:
  /// **'المشاركون'**
  String get participants;

  /// No description provided for @viewParticipants.
  ///
  /// In ar, this message translates to:
  /// **'عرض الطلاب'**
  String get viewParticipants;

  /// No description provided for @viewSessions.
  ///
  /// In ar, this message translates to:
  /// **'عرض الجلسات'**
  String get viewSessions;

  /// No description provided for @viewSubmissions.
  ///
  /// In ar, this message translates to:
  /// **'مراجعة التسليمات'**
  String get viewSubmissions;

  /// No description provided for @viewAssessmentResults.
  ///
  /// In ar, this message translates to:
  /// **'نتائج التقييمات'**
  String get viewAssessmentResults;

  /// No description provided for @recordAttendance.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الحضور'**
  String get recordAttendance;

  /// No description provided for @createSession.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء جلسة'**
  String get createSession;

  /// No description provided for @editSession.
  ///
  /// In ar, this message translates to:
  /// **'تعديل الجلسة'**
  String get editSession;

  /// No description provided for @sessionTitle.
  ///
  /// In ar, this message translates to:
  /// **'عنوان الجلسة'**
  String get sessionTitle;

  /// No description provided for @sessionDate.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ الجلسة'**
  String get sessionDate;

  /// No description provided for @startTime.
  ///
  /// In ar, this message translates to:
  /// **'وقت البداية'**
  String get startTime;

  /// No description provided for @endTime.
  ///
  /// In ar, this message translates to:
  /// **'وقت النهاية'**
  String get endTime;

  /// No description provided for @meetingLink.
  ///
  /// In ar, this message translates to:
  /// **'رابط الاجتماع'**
  String get meetingLink;

  /// No description provided for @sessionSaved.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ الجلسة'**
  String get sessionSaved;

  /// No description provided for @invalidSessionTimes.
  ///
  /// In ar, this message translates to:
  /// **'وقت النهاية يجب أن يكون بعد وقت البداية'**
  String get invalidSessionTimes;

  /// No description provided for @invalidMeetingUrl.
  ///
  /// In ar, this message translates to:
  /// **'رابط الاجتماع غير صالح'**
  String get invalidMeetingUrl;

  /// No description provided for @markAllPresent.
  ///
  /// In ar, this message translates to:
  /// **'تعليم الكل حاضرين'**
  String get markAllPresent;

  /// No description provided for @unsavedAttendanceTitle.
  ///
  /// In ar, this message translates to:
  /// **'تغييرات غير محفوظة'**
  String get unsavedAttendanceTitle;

  /// No description provided for @unsavedAttendanceBody.
  ///
  /// In ar, this message translates to:
  /// **'لديك تغييرات حضور لم تُحفظ. هل تريد المغادرة؟'**
  String get unsavedAttendanceBody;

  /// No description provided for @discardChanges.
  ///
  /// In ar, this message translates to:
  /// **'تجاهل'**
  String get discardChanges;

  /// No description provided for @saveAttendance.
  ///
  /// In ar, this message translates to:
  /// **'حفظ الحضور'**
  String get saveAttendance;

  /// No description provided for @attendanceSaved.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ الحضور'**
  String get attendanceSaved;

  /// No description provided for @attendanceSaveFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر حفظ الحضور'**
  String get attendanceSaveFailed;

  /// No description provided for @confirmAttendanceSave.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد حفظ الحضور'**
  String get confirmAttendanceSave;

  /// No description provided for @confirmAttendanceSaveBody.
  ///
  /// In ar, this message translates to:
  /// **'سيتم حفظ حالة الحضور لجميع الطلاب المحددين.'**
  String get confirmAttendanceSaveBody;

  /// No description provided for @hoursReadOnlyNotice.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل ساعات التدريب المكتملة غير متاح عبر واجهة الجوال حالياً. تُعرض الساعات عند توفرها من الخادم فقط.'**
  String get hoursReadOnlyNotice;

  /// No description provided for @requiredHoursLabel.
  ///
  /// In ar, this message translates to:
  /// **'الساعات المطلوبة'**
  String get requiredHoursLabel;

  /// No description provided for @completedHoursLabel.
  ///
  /// In ar, this message translates to:
  /// **'الساعات المكتملة'**
  String get completedHoursLabel;

  /// No description provided for @remainingHoursLabel.
  ///
  /// In ar, this message translates to:
  /// **'الساعات المتبقية'**
  String get remainingHoursLabel;

  /// No description provided for @hoursProgressLabel.
  ///
  /// In ar, this message translates to:
  /// **'تقدم الساعات'**
  String get hoursProgressLabel;

  /// No description provided for @recordHours.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل ساعات'**
  String get recordHours;

  /// No description provided for @updateHours.
  ///
  /// In ar, this message translates to:
  /// **'تحديث الساعات'**
  String get updateHours;

  /// No description provided for @hoursNoteOptional.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظة (اختياري)'**
  String get hoursNoteOptional;

  /// No description provided for @hoursSaved.
  ///
  /// In ar, this message translates to:
  /// **'تم تحديث الساعات'**
  String get hoursSaved;

  /// No description provided for @hoursConflict.
  ///
  /// In ar, this message translates to:
  /// **'تم تحديث الساعات من مستخدم آخر. حدّث البيانات وحاول مجدداً.'**
  String get hoursConflict;

  /// No description provided for @hoursExceedRequired.
  ///
  /// In ar, this message translates to:
  /// **'لا يمكن أن تتجاوز الساعات المكتملة الساعات المطلوبة.'**
  String get hoursExceedRequired;

  /// No description provided for @hoursValidationInvalid.
  ///
  /// In ar, this message translates to:
  /// **'أدخل عدداً صحيحاً غير سالب.'**
  String get hoursValidationInvalid;

  /// No description provided for @hoursNotRecorded.
  ///
  /// In ar, this message translates to:
  /// **'لم تُسجَّل بعد'**
  String get hoursNotRecorded;

  /// No description provided for @hoursRecordedPerStudentHint.
  ///
  /// In ar, this message translates to:
  /// **'تُسجَّل الساعات المكتملة لكل طالب من شاشة تقدم المشارك.'**
  String get hoursRecordedPerStudentHint;

  /// No description provided for @reviewSubmission.
  ///
  /// In ar, this message translates to:
  /// **'مراجعة التسليم'**
  String get reviewSubmission;

  /// No description provided for @approveSubmission.
  ///
  /// In ar, this message translates to:
  /// **'اعتماد'**
  String get approveSubmission;

  /// No description provided for @rejectSubmission.
  ///
  /// In ar, this message translates to:
  /// **'رفض'**
  String get rejectSubmission;

  /// No description provided for @requestRevision.
  ///
  /// In ar, this message translates to:
  /// **'طلب تعديل'**
  String get requestRevision;

  /// No description provided for @instructorFeedback.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظات المدرب'**
  String get instructorFeedback;

  /// No description provided for @feedbackRequired.
  ///
  /// In ar, this message translates to:
  /// **'أدخل ملاحظات عند طلب التعديل أو الرفض'**
  String get feedbackRequired;

  /// No description provided for @reviewSaved.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ المراجعة'**
  String get reviewSaved;

  /// No description provided for @downloadAttachment.
  ///
  /// In ar, this message translates to:
  /// **'تنزيل المرفق'**
  String get downloadAttachment;

  /// No description provided for @noSubmissions.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد تسليمات بعد'**
  String get noSubmissions;

  /// No description provided for @noParticipants.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد مشاركون بعد'**
  String get noParticipants;

  /// No description provided for @noSessions.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد جلسات بعد'**
  String get noSessions;

  /// No description provided for @assessmentResults.
  ///
  /// In ar, this message translates to:
  /// **'نتائج التقييمات'**
  String get assessmentResults;

  /// No description provided for @score.
  ///
  /// In ar, this message translates to:
  /// **'الدرجة'**
  String get score;

  /// No description provided for @passed.
  ///
  /// In ar, this message translates to:
  /// **'ناجح'**
  String get passed;

  /// No description provided for @failed.
  ///
  /// In ar, this message translates to:
  /// **'راسب'**
  String get failed;

  /// No description provided for @noAssessmentResults.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد نتائج تقييمات بعد'**
  String get noAssessmentResults;

  /// No description provided for @forbiddenAccess.
  ///
  /// In ar, this message translates to:
  /// **'ليس لديك صلاحية للوصول إلى هذا التدريب'**
  String get forbiddenAccess;

  /// No description provided for @resourceNotFound.
  ///
  /// In ar, this message translates to:
  /// **'العنصر غير موجود أو تمت إزالته'**
  String get resourceNotFound;

  /// No description provided for @conflictError.
  ///
  /// In ar, this message translates to:
  /// **'تعارض في التحديث. حدّث الصفحة وحاول مجدداً'**
  String get conflictError;

  /// No description provided for @validationError.
  ///
  /// In ar, this message translates to:
  /// **'تحقق من صحة البيانات المدخلة'**
  String get validationError;

  /// No description provided for @instructorStudentsHub.
  ///
  /// In ar, this message translates to:
  /// **'طلاب تدريباتي'**
  String get instructorStudentsHub;

  /// No description provided for @selectTrainingForStudents.
  ///
  /// In ar, this message translates to:
  /// **'اختر تدريباً لعرض طلابه'**
  String get selectTrainingForStudents;

  /// No description provided for @opportunityInfo.
  ///
  /// In ar, this message translates to:
  /// **'معلومات الفرصة'**
  String get opportunityInfo;

  /// No description provided for @leaveWithoutSaving.
  ///
  /// In ar, this message translates to:
  /// **'مغادرة'**
  String get leaveWithoutSaving;

  /// No description provided for @stayAndEdit.
  ///
  /// In ar, this message translates to:
  /// **'البقاء'**
  String get stayAndEdit;

  /// No description provided for @save.
  ///
  /// In ar, this message translates to:
  /// **'حفظ'**
  String get save;

  /// No description provided for @instructorRole.
  ///
  /// In ar, this message translates to:
  /// **'مدرب'**
  String get instructorRole;

  /// No description provided for @trainees.
  ///
  /// In ar, this message translates to:
  /// **'المتدربون'**
  String get trainees;

  /// No description provided for @universityAdminRole.
  ///
  /// In ar, this message translates to:
  /// **'مدير الجامعة'**
  String get universityAdminRole;

  /// No description provided for @academicAdminRole.
  ///
  /// In ar, this message translates to:
  /// **'مدير أكاديمي'**
  String get academicAdminRole;

  /// No description provided for @adminOpportunitiesCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} فرصة تدريب'**
  String adminOpportunitiesCount(int count);

  /// No description provided for @adminPublishedOpportunitiesCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} فرصة منشورة'**
  String adminPublishedOpportunitiesCount(int count);

  /// No description provided for @adminPendingApplicationsCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} طلب بانتظار المراجعة'**
  String adminPendingApplicationsCount(int count);

  /// No description provided for @adminPendingUsersCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} حساب بانتظار التفعيل'**
  String adminPendingUsersCount(int count);

  /// No description provided for @adminPriorityCompleteSetup.
  ///
  /// In ar, this message translates to:
  /// **'أكمل إعداد فرصة تدريب'**
  String get adminPriorityCompleteSetup;

  /// No description provided for @createOpportunity.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء فرصة تدريب'**
  String get createOpportunity;

  /// No description provided for @noOpportunities.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد فرص تدريب حالياً'**
  String get noOpportunities;

  /// No description provided for @editOpportunity.
  ///
  /// In ar, this message translates to:
  /// **'تعديل الفرصة'**
  String get editOpportunity;

  /// No description provided for @publishOpportunity.
  ///
  /// In ar, this message translates to:
  /// **'نشر الفرصة'**
  String get publishOpportunity;

  /// No description provided for @archiveOpportunity.
  ///
  /// In ar, this message translates to:
  /// **'أرشفة الفرصة'**
  String get archiveOpportunity;

  /// No description provided for @confirmPublishBody.
  ///
  /// In ar, this message translates to:
  /// **'سيتم نشر الفرصة وإتاحتها للتقديم من الطلاب المؤهلين.'**
  String get confirmPublishBody;

  /// No description provided for @confirmArchiveBody.
  ///
  /// In ar, this message translates to:
  /// **'سيتم أرشفة الفرصة ولن تكون متاحة للتقديم بعد الآن.'**
  String get confirmArchiveBody;

  /// No description provided for @opportunityPublished.
  ///
  /// In ar, this message translates to:
  /// **'تم نشر الفرصة'**
  String get opportunityPublished;

  /// No description provided for @opportunityArchived.
  ///
  /// In ar, this message translates to:
  /// **'تم أرشفة الفرصة'**
  String get opportunityArchived;

  /// No description provided for @needsEligibilitySetupNotice.
  ///
  /// In ar, this message translates to:
  /// **'يجب ضبط الجامعات والتخصصات المؤهلة قبل النشر'**
  String get needsEligibilitySetupNotice;

  /// No description provided for @assignedInstructorLabel.
  ///
  /// In ar, this message translates to:
  /// **'المدرب المسؤول'**
  String get assignedInstructorLabel;

  /// No description provided for @reviewApplications.
  ///
  /// In ar, this message translates to:
  /// **'مراجعة الطلبات'**
  String get reviewApplications;

  /// No description provided for @rejectApplication.
  ///
  /// In ar, this message translates to:
  /// **'رفض'**
  String get rejectApplication;

  /// No description provided for @approveApplication.
  ///
  /// In ar, this message translates to:
  /// **'قبول'**
  String get approveApplication;

  /// No description provided for @confirmApproveTitle.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد قبول الطلب'**
  String get confirmApproveTitle;

  /// No description provided for @confirmRejectTitle.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد رفض الطلب'**
  String get confirmRejectTitle;

  /// No description provided for @adminNoteOptional.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظة الإدارة (اختياري)'**
  String get adminNoteOptional;

  /// No description provided for @opportunityTitleLabel.
  ///
  /// In ar, this message translates to:
  /// **'عنوان الفرصة'**
  String get opportunityTitleLabel;

  /// No description provided for @locationLabel.
  ///
  /// In ar, this message translates to:
  /// **'الموقع'**
  String get locationLabel;

  /// No description provided for @trainingModeLabel.
  ///
  /// In ar, this message translates to:
  /// **'نوع التدريب'**
  String get trainingModeLabel;

  /// No description provided for @startDateLabel.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ البداية'**
  String get startDateLabel;

  /// No description provided for @endDateLabel.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ النهاية'**
  String get endDateLabel;

  /// No description provided for @invalidRequiredHours.
  ///
  /// In ar, this message translates to:
  /// **'أدخل عدداً صحيحاً موجباً للساعات المطلوبة'**
  String get invalidRequiredHours;

  /// No description provided for @specialtyRequired.
  ///
  /// In ar, this message translates to:
  /// **'يرجى اختيار التخصص'**
  String get specialtyRequired;

  /// No description provided for @specialtyCatalogUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل قائمة التخصصات المؤهلة لجامعتك'**
  String get specialtyCatalogUnavailable;

  /// No description provided for @opportunitySaved.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ فرصة التدريب'**
  String get opportunitySaved;

  /// No description provided for @adminReportEligibleOpportunities.
  ///
  /// In ar, this message translates to:
  /// **'الفرص المؤهلة'**
  String get adminReportEligibleOpportunities;

  /// No description provided for @adminReportTotalApplicants.
  ///
  /// In ar, this message translates to:
  /// **'إجمالي المتقدمين'**
  String get adminReportTotalApplicants;

  /// No description provided for @adminReportAcceptedStudents.
  ///
  /// In ar, this message translates to:
  /// **'الطلاب المقبولون'**
  String get adminReportAcceptedStudents;

  /// No description provided for @adminReportInTraining.
  ///
  /// In ar, this message translates to:
  /// **'قيد التدريب'**
  String get adminReportInTraining;

  /// No description provided for @adminReportCompletedStudents.
  ///
  /// In ar, this message translates to:
  /// **'الطلاب المكتملون'**
  String get adminReportCompletedStudents;

  /// No description provided for @adminReportCompletionLetters.
  ///
  /// In ar, this message translates to:
  /// **'خطابات الإتمام المصدرة'**
  String get adminReportCompletionLetters;

  /// No description provided for @approveRecognition.
  ///
  /// In ar, this message translates to:
  /// **'اعتماد الطلب'**
  String get approveRecognition;

  /// No description provided for @assignedReviewerLabel.
  ///
  /// In ar, this message translates to:
  /// **'المراجع المسؤول'**
  String get assignedReviewerLabel;

  /// No description provided for @certificatesUnavailableForRole.
  ///
  /// In ar, this message translates to:
  /// **'قائمة الشهادات غير متاحة لهذا الدور حالياً'**
  String get certificatesUnavailableForRole;

  /// No description provided for @changeStatus.
  ///
  /// In ar, this message translates to:
  /// **'تغيير الحالة'**
  String get changeStatus;

  /// No description provided for @cohortLabel.
  ///
  /// In ar, this message translates to:
  /// **'الدفعة'**
  String get cohortLabel;

  /// No description provided for @confirmEnrollmentApproveTitle.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد قبول التسجيل'**
  String get confirmEnrollmentApproveTitle;

  /// No description provided for @confirmEnrollmentRejectTitle.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد رفض التسجيل'**
  String get confirmEnrollmentRejectTitle;

  /// No description provided for @confirmRecognitionDecisionBody.
  ///
  /// In ar, this message translates to:
  /// **'سيتم تحديث حالة الطلب إلى: {status}'**
  String confirmRecognitionDecisionBody(String status);

  /// No description provided for @confirmRecognitionDecisionTitle.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد القرار'**
  String get confirmRecognitionDecisionTitle;

  /// No description provided for @confirmStatusChangeBody.
  ///
  /// In ar, this message translates to:
  /// **'سيتم تغيير الحالة إلى: {status}'**
  String confirmStatusChangeBody(String status);

  /// No description provided for @confirmStatusChangeTitle.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد تغيير الحالة'**
  String get confirmStatusChangeTitle;

  /// No description provided for @correctiveActionsTitle.
  ///
  /// In ar, this message translates to:
  /// **'الإجراءات التصحيحية'**
  String get correctiveActionsTitle;

  /// No description provided for @correctiveAssigneeLabel.
  ///
  /// In ar, this message translates to:
  /// **'الجهة المكلفة'**
  String get correctiveAssigneeLabel;

  /// No description provided for @decideRecognition.
  ///
  /// In ar, this message translates to:
  /// **'اتخاذ قرار'**
  String get decideRecognition;

  /// No description provided for @enrollmentApproveAction.
  ///
  /// In ar, this message translates to:
  /// **'قبول التسجيل'**
  String get enrollmentApproveAction;

  /// No description provided for @enrollmentApproved.
  ///
  /// In ar, this message translates to:
  /// **'تم قبول طلب التسجيل'**
  String get enrollmentApproved;

  /// No description provided for @enrollmentRejectAction.
  ///
  /// In ar, this message translates to:
  /// **'رفض التسجيل'**
  String get enrollmentRejectAction;

  /// No description provided for @enrollmentRejected.
  ///
  /// In ar, this message translates to:
  /// **'تم رفض طلب التسجيل'**
  String get enrollmentRejected;

  /// No description provided for @enrollmentRejectReasonOptional.
  ///
  /// In ar, this message translates to:
  /// **'سبب الرفض (اختياري)'**
  String get enrollmentRejectReasonOptional;

  /// No description provided for @evidenceTitle.
  ///
  /// In ar, this message translates to:
  /// **'الأدلة'**
  String get evidenceTitle;

  /// No description provided for @evidenceTypeLabel.
  ///
  /// In ar, this message translates to:
  /// **'نوع الدليل'**
  String get evidenceTypeLabel;

  /// No description provided for @integrityCasesTitle.
  ///
  /// In ar, this message translates to:
  /// **'حالات النزاهة'**
  String get integrityCasesTitle;

  /// No description provided for @integrityCaseTypeLabel.
  ///
  /// In ar, this message translates to:
  /// **'نوع المخالفة'**
  String get integrityCaseTypeLabel;

  /// No description provided for @integrityDecisionLabel.
  ///
  /// In ar, this message translates to:
  /// **'القرار'**
  String get integrityDecisionLabel;

  /// No description provided for @integrityEvidenceNotesLabel.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظات الأدلة'**
  String get integrityEvidenceNotesLabel;

  /// No description provided for @moveToUnderReview.
  ///
  /// In ar, this message translates to:
  /// **'بدء المراجعة'**
  String get moveToUnderReview;

  /// No description provided for @noCorrectiveActions.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد إجراءات تصحيحية حالياً'**
  String get noCorrectiveActions;

  /// No description provided for @noEvidence.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد أدلة حالياً'**
  String get noEvidence;

  /// No description provided for @noIntegrityCases.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد حالات نزاهة حالياً'**
  String get noIntegrityCases;

  /// No description provided for @noPendingEnrollments.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد طلبات تسجيل معلقة'**
  String get noPendingEnrollments;

  /// No description provided for @noQaReviews.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مراجعات جودة حالياً'**
  String get noQaReviews;

  /// No description provided for @noRecognitionDocuments.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد وثائق مرفقة بعد'**
  String get noRecognitionDocuments;

  /// No description provided for @noRecognitionRequests.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد طلبات اعتماد حالياً'**
  String get noRecognitionRequests;

  /// No description provided for @noRiskCases.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد حالات خطر حالياً'**
  String get noRiskCases;

  /// No description provided for @noStatusActionsAvailable.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد إجراءات حالة متاحة من الحالة الحالية'**
  String get noStatusActionsAvailable;

  /// No description provided for @offlineWriteBlocked.
  ///
  /// In ar, this message translates to:
  /// **'هذا الإجراء غير متاح بدون اتصال بالإنترنت. تحقق من الاتصال وحاول مجدداً.'**
  String get offlineWriteBlocked;

  /// No description provided for @openCorrectiveActionsCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} إجراء تصحيحي مفتوح'**
  String openCorrectiveActionsCount(int count);

  /// No description provided for @openDocument.
  ///
  /// In ar, this message translates to:
  /// **'فتح الوثيقة'**
  String get openDocument;

  /// No description provided for @openEvidenceFile.
  ///
  /// In ar, this message translates to:
  /// **'فتح الملف'**
  String get openEvidenceFile;

  /// No description provided for @openQaReviewsCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} مراجعة جودة مفتوحة'**
  String openQaReviewsCount(int count);

  /// No description provided for @openRiskCasesCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} حالة خطر مفتوحة'**
  String openRiskCasesCount(int count);

  /// No description provided for @pendingEnrollmentsCountLabel.
  ///
  /// In ar, this message translates to:
  /// **'{count} طلب تسجيل بانتظار القرار'**
  String pendingEnrollmentsCountLabel(int count);

  /// No description provided for @pendingEnrollmentsTitle.
  ///
  /// In ar, this message translates to:
  /// **'طلبات التسجيل المعلقة'**
  String get pendingEnrollmentsTitle;

  /// No description provided for @pendingRecognitionCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} طلب اعتماد بانتظار القرار'**
  String pendingRecognitionCount(int count);

  /// No description provided for @qaActionRequiredLabel.
  ///
  /// In ar, this message translates to:
  /// **'الإجراء المطلوب'**
  String get qaActionRequiredLabel;

  /// No description provided for @qaFindingsLabel.
  ///
  /// In ar, this message translates to:
  /// **'النتائج'**
  String get qaFindingsLabel;

  /// No description provided for @qaOfficerRoleLabel.
  ///
  /// In ar, this message translates to:
  /// **'مسؤول الجودة'**
  String get qaOfficerRoleLabel;

  /// No description provided for @qaPriorityOpenReview.
  ///
  /// In ar, this message translates to:
  /// **'راجع أقدم مراجعة جودة مفتوحة'**
  String get qaPriorityOpenReview;

  /// No description provided for @qaReviewDateLabel.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ المراجعة'**
  String get qaReviewDateLabel;

  /// No description provided for @qaReviewsTitle.
  ///
  /// In ar, this message translates to:
  /// **'مراجعات الجودة'**
  String get qaReviewsTitle;

  /// No description provided for @qaReviewTypeLabel.
  ///
  /// In ar, this message translates to:
  /// **'نوع المراجعة'**
  String get qaReviewTypeLabel;

  /// No description provided for @qaStatusClosed.
  ///
  /// In ar, this message translates to:
  /// **'مغلقة'**
  String get qaStatusClosed;

  /// No description provided for @qaStatusInProgress.
  ///
  /// In ar, this message translates to:
  /// **'قيد التنفيذ'**
  String get qaStatusInProgress;

  /// No description provided for @qaStatusOpen.
  ///
  /// In ar, this message translates to:
  /// **'مفتوحة'**
  String get qaStatusOpen;

  /// No description provided for @qaStatusResolved.
  ///
  /// In ar, this message translates to:
  /// **'محلولة'**
  String get qaStatusResolved;

  /// No description provided for @recognitionDocumentsTitle.
  ///
  /// In ar, this message translates to:
  /// **'وثائق الطلب'**
  String get recognitionDocumentsTitle;

  /// No description provided for @recognitionMicroCredentialLabel.
  ///
  /// In ar, this message translates to:
  /// **'الشهادة المصغّرة'**
  String get recognitionMicroCredentialLabel;

  /// No description provided for @recognitionRequestsTitle.
  ///
  /// In ar, this message translates to:
  /// **'طلبات الاعتماد'**
  String get recognitionRequestsTitle;

  /// No description provided for @recognitionStatusApproved.
  ///
  /// In ar, this message translates to:
  /// **'مُعتمد'**
  String get recognitionStatusApproved;

  /// No description provided for @recognitionStatusDraft.
  ///
  /// In ar, this message translates to:
  /// **'مسودة'**
  String get recognitionStatusDraft;

  /// No description provided for @recognitionStatusInPreparation.
  ///
  /// In ar, this message translates to:
  /// **'قيد التحضير'**
  String get recognitionStatusInPreparation;

  /// No description provided for @recognitionStatusNeedsRevision.
  ///
  /// In ar, this message translates to:
  /// **'يحتاج مراجعة'**
  String get recognitionStatusNeedsRevision;

  /// No description provided for @recognitionStatusReadyForSubmission.
  ///
  /// In ar, this message translates to:
  /// **'جاهز للتقديم'**
  String get recognitionStatusReadyForSubmission;

  /// No description provided for @recognitionStatusRejected.
  ///
  /// In ar, this message translates to:
  /// **'مرفوض'**
  String get recognitionStatusRejected;

  /// No description provided for @recognitionStatusSubmitted.
  ///
  /// In ar, this message translates to:
  /// **'مُقدَّم'**
  String get recognitionStatusSubmitted;

  /// No description provided for @recognitionStatusUnderReview.
  ///
  /// In ar, this message translates to:
  /// **'قيد المراجعة'**
  String get recognitionStatusUnderReview;

  /// No description provided for @recognitionStatusUpdated.
  ///
  /// In ar, this message translates to:
  /// **'تم تحديث حالة طلب الاعتماد'**
  String get recognitionStatusUpdated;

  /// No description provided for @rejectRecognition.
  ///
  /// In ar, this message translates to:
  /// **'رفض الطلب'**
  String get rejectRecognition;

  /// No description provided for @relatedCorrectiveActions.
  ///
  /// In ar, this message translates to:
  /// **'الإجراءات التصحيحية المرتبطة'**
  String get relatedCorrectiveActions;

  /// No description provided for @requestChangesRecognition.
  ///
  /// In ar, this message translates to:
  /// **'طلب تعديلات'**
  String get requestChangesRecognition;

  /// No description provided for @reviewerPriorityDecideEnrollment.
  ///
  /// In ar, this message translates to:
  /// **'راجع طلبات التسجيل المعلقة'**
  String get reviewerPriorityDecideEnrollment;

  /// No description provided for @reviewerPriorityDecideRecognition.
  ///
  /// In ar, this message translates to:
  /// **'اتخذ قرارًا بشأن طلب الاعتماد'**
  String get reviewerPriorityDecideRecognition;

  /// No description provided for @reviewerSearchStudents.
  ///
  /// In ar, this message translates to:
  /// **'ابحث عن طالب'**
  String get reviewerSearchStudents;

  /// No description provided for @reviewTypePeriodic.
  ///
  /// In ar, this message translates to:
  /// **'دورية'**
  String get reviewTypePeriodic;

  /// No description provided for @reviewTypePreClosure.
  ///
  /// In ar, this message translates to:
  /// **'ما قبل الإغلاق'**
  String get reviewTypePreClosure;

  /// No description provided for @reviewTypeScheduled.
  ///
  /// In ar, this message translates to:
  /// **'مجدولة'**
  String get reviewTypeScheduled;

  /// No description provided for @reviewTypeSpecial.
  ///
  /// In ar, this message translates to:
  /// **'خاصة'**
  String get reviewTypeSpecial;

  /// No description provided for @riskActionPlanLabel.
  ///
  /// In ar, this message translates to:
  /// **'خطة العمل'**
  String get riskActionPlanLabel;

  /// No description provided for @riskCasesTitle.
  ///
  /// In ar, this message translates to:
  /// **'حالات الخطر'**
  String get riskCasesTitle;

  /// No description provided for @riskLevelLabel.
  ///
  /// In ar, this message translates to:
  /// **'مستوى الخطر'**
  String get riskLevelLabel;

  /// No description provided for @riskTypeLabel.
  ///
  /// In ar, this message translates to:
  /// **'نوع الخطر'**
  String get riskTypeLabel;

  /// No description provided for @searchEvidence.
  ///
  /// In ar, this message translates to:
  /// **'ابحث في الأدلة'**
  String get searchEvidence;

  /// No description provided for @searchRecognitionRequests.
  ///
  /// In ar, this message translates to:
  /// **'ابحث في طلبات الاعتماد'**
  String get searchRecognitionRequests;

  /// No description provided for @searchReviews.
  ///
  /// In ar, this message translates to:
  /// **'ابحث في المراجعات'**
  String get searchReviews;

  /// No description provided for @statusChangeSaved.
  ///
  /// In ar, this message translates to:
  /// **'تم تحديث الحالة'**
  String get statusChangeSaved;

  /// No description provided for @statusConflictRefresh.
  ///
  /// In ar, this message translates to:
  /// **'تم تعديل هذا العنصر من مستخدم آخر. تم تحديث البيانات.'**
  String get statusConflictRefresh;

  /// No description provided for @statusEscalatedLabel.
  ///
  /// In ar, this message translates to:
  /// **'مصعّدة'**
  String get statusEscalatedLabel;

  /// No description provided for @statusLabel.
  ///
  /// In ar, this message translates to:
  /// **'الحالة'**
  String get statusLabel;

  /// No description provided for @statusOverdueLabel.
  ///
  /// In ar, this message translates to:
  /// **'متأخرة'**
  String get statusOverdueLabel;

  /// No description provided for @statusReportedLabel.
  ///
  /// In ar, this message translates to:
  /// **'مُبلَّغ عنها'**
  String get statusReportedLabel;

  /// No description provided for @statusUnderInvestigationLabel.
  ///
  /// In ar, this message translates to:
  /// **'تحت التحقيق'**
  String get statusUnderInvestigationLabel;

  /// No description provided for @universityReviewerRoleLabel.
  ///
  /// In ar, this message translates to:
  /// **'مراجع الجامعة'**
  String get universityReviewerRoleLabel;

  /// No description provided for @superAdminRoleLabel.
  ///
  /// In ar, this message translates to:
  /// **'مشرف عام'**
  String get superAdminRoleLabel;

  /// No description provided for @isGlobalBadge.
  ///
  /// In ar, this message translates to:
  /// **'صلاحية عامة (Global)'**
  String get isGlobalBadge;

  /// No description provided for @superAdminGlobalScopeNotice.
  ///
  /// In ar, this message translates to:
  /// **'لديك صلاحية عامة على جميع الجامعات والمستخدمين في النظام.'**
  String get superAdminGlobalScopeNotice;

  /// No description provided for @superAdminLostPrivilegeMessage.
  ///
  /// In ar, this message translates to:
  /// **'لم تعد صلاحية المشرف العام مفعّلة لحسابك. تواصل مع مشرف عام آخر إذا كان هذا غير متوقع.'**
  String get superAdminLostPrivilegeMessage;

  /// No description provided for @superAdminCohortsLabel.
  ///
  /// In ar, this message translates to:
  /// **'الدفعات'**
  String get superAdminCohortsLabel;

  /// No description provided for @superAdminPendingEnrollmentsLabel.
  ///
  /// In ar, this message translates to:
  /// **'تسجيلات معلقة'**
  String get superAdminPendingEnrollmentsLabel;

  /// No description provided for @superAdminFieldTrainingOversight.
  ///
  /// In ar, this message translates to:
  /// **'متابعة التدريب الميداني'**
  String get superAdminFieldTrainingOversight;

  /// No description provided for @superAdminQaOversight.
  ///
  /// In ar, this message translates to:
  /// **'متابعة الجودة والاعتماد'**
  String get superAdminQaOversight;

  /// No description provided for @superAdminGlobalReportTitle.
  ///
  /// In ar, this message translates to:
  /// **'التقرير الشامل للتدريب الميداني'**
  String get superAdminGlobalReportTitle;

  /// No description provided for @superAdminUniversityComparisonTitle.
  ///
  /// In ar, this message translates to:
  /// **'مقارنة الجامعات'**
  String get superAdminUniversityComparisonTitle;

  /// No description provided for @superAdminExpelledLabel.
  ///
  /// In ar, this message translates to:
  /// **'حالات الفصل'**
  String get superAdminExpelledLabel;

  /// No description provided for @superAdminReportExportWebOnlyNotice.
  ///
  /// In ar, this message translates to:
  /// **'تصدير التقرير (PDF/Excel) متاح حاليًا من منصة الويب فقط.'**
  String get superAdminReportExportWebOnlyNotice;

  /// No description provided for @auditLogsTitle.
  ///
  /// In ar, this message translates to:
  /// **'سجل التدقيق'**
  String get auditLogsTitle;

  /// No description provided for @searchAuditLogs.
  ///
  /// In ar, this message translates to:
  /// **'ابحث في سجل التدقيق'**
  String get searchAuditLogs;

  /// No description provided for @noAuditLogs.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد سجلات تدقيق حالياً'**
  String get noAuditLogs;

  /// No description provided for @systemStatusTitle.
  ///
  /// In ar, this message translates to:
  /// **'حالة النظام'**
  String get systemStatusTitle;

  /// No description provided for @systemStatusApiOnlyNotice.
  ///
  /// In ar, this message translates to:
  /// **'يعرض هذا الفحص توفر الخادم فقط، دون أي تفاصيل بيئة أو قاعدة بيانات.'**
  String get systemStatusApiOnlyNotice;

  /// No description provided for @apiAvailable.
  ///
  /// In ar, this message translates to:
  /// **'الخادم متاح'**
  String get apiAvailable;

  /// No description provided for @apiUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الاتصال بالخادم'**
  String get apiUnavailable;

  /// No description provided for @searchUniversities.
  ///
  /// In ar, this message translates to:
  /// **'ابحث عن جامعة'**
  String get searchUniversities;

  /// No description provided for @noUniversitiesFound.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد جامعات مطابقة'**
  String get noUniversitiesFound;

  /// No description provided for @createUniversity.
  ///
  /// In ar, this message translates to:
  /// **'إضافة جامعة'**
  String get createUniversity;

  /// No description provided for @editUniversity.
  ///
  /// In ar, this message translates to:
  /// **'تعديل الجامعة'**
  String get editUniversity;

  /// No description provided for @universityDetail.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل الجامعة'**
  String get universityDetail;

  /// No description provided for @universityNameLabel.
  ///
  /// In ar, this message translates to:
  /// **'اسم الجامعة'**
  String get universityNameLabel;

  /// No description provided for @contactPersonLabel.
  ///
  /// In ar, this message translates to:
  /// **'المسؤول عن التواصل'**
  String get contactPersonLabel;

  /// No description provided for @universitySaved.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ بيانات الجامعة'**
  String get universitySaved;

  /// No description provided for @universityNameTaken.
  ///
  /// In ar, this message translates to:
  /// **'اسم الجامعة مستخدم من قبل'**
  String get universityNameTaken;

  /// No description provided for @searchUsers.
  ///
  /// In ar, this message translates to:
  /// **'ابحث عن مستخدم'**
  String get searchUsers;

  /// No description provided for @noUsersFound.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد مستخدمون مطابقون'**
  String get noUsersFound;

  /// No description provided for @userDetail.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل المستخدم'**
  String get userDetail;

  /// No description provided for @userActivated.
  ///
  /// In ar, this message translates to:
  /// **'تم تفعيل المستخدم'**
  String get userActivated;

  /// No description provided for @activateUserAction.
  ///
  /// In ar, this message translates to:
  /// **'تفعيل المستخدم'**
  String get activateUserAction;

  /// No description provided for @roleAssignmentLabel.
  ///
  /// In ar, this message translates to:
  /// **'الأدوار المعيّنة'**
  String get roleAssignmentLabel;

  /// No description provided for @assignRolesTitle.
  ///
  /// In ar, this message translates to:
  /// **'تعيين الأدوار'**
  String get assignRolesTitle;

  /// No description provided for @superAdminRoleWarning.
  ///
  /// In ar, this message translates to:
  /// **'تحذير: هذا الدور يمنح صلاحية مشرف عام كاملة على النظام'**
  String get superAdminRoleWarning;

  /// No description provided for @superAdminBadge.
  ///
  /// In ar, this message translates to:
  /// **'مشرف عام'**
  String get superAdminBadge;

  /// No description provided for @rolesUpdated.
  ///
  /// In ar, this message translates to:
  /// **'تم تحديث أدوار المستخدم'**
  String get rolesUpdated;

  /// No description provided for @confirmGrantSuperAdminTitle.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد منح صلاحية مشرف عام'**
  String get confirmGrantSuperAdminTitle;

  /// No description provided for @confirmGrantSuperAdminBody.
  ///
  /// In ar, this message translates to:
  /// **'سيحصل هذا المستخدم على صلاحية مشرف عام كاملة تشمل جميع الجامعات والمستخدمين. هل أنت متأكد؟'**
  String get confirmGrantSuperAdminBody;

  /// No description provided for @confirmRevokeSuperAdminTitle.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد إزالة صلاحية مشرف عام'**
  String get confirmRevokeSuperAdminTitle;

  /// No description provided for @confirmRevokeSuperAdminBody.
  ///
  /// In ar, this message translates to:
  /// **'سيتم إزالة صلاحية المشرف العام من هذا المستخدم فوراً. هل أنت متأكد؟'**
  String get confirmRevokeSuperAdminBody;

  /// No description provided for @pushPermissionSheetTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا تفوّت أي تحديث'**
  String get pushPermissionSheetTitle;

  /// No description provided for @pushPermissionSheetBody.
  ///
  /// In ar, this message translates to:
  /// **'فعّل الإشعارات لتصلك تنبيهات فورية عند قبول التسجيل، مراجعة المهام، وتحديثات التدريب الميداني — حتى عندما يكون التطبيق مغلقًا.'**
  String get pushPermissionSheetBody;

  /// No description provided for @pushPermissionEnableAction.
  ///
  /// In ar, this message translates to:
  /// **'تفعيل الإشعارات'**
  String get pushPermissionEnableAction;

  /// No description provided for @pushPermissionSkipAction.
  ///
  /// In ar, this message translates to:
  /// **'ليس الآن'**
  String get pushPermissionSkipAction;

  /// No description provided for @pushNotificationChannelName.
  ///
  /// In ar, this message translates to:
  /// **'إشعارات BATTECHNO LMS'**
  String get pushNotificationChannelName;

  /// No description provided for @pushNotificationChannelDescription.
  ///
  /// In ar, this message translates to:
  /// **'التنبيهات الفورية لتحديثات الحساب والتدريب الميداني والمهام'**
  String get pushNotificationChannelDescription;

  /// No description provided for @pushPermissionSettingsTitle.
  ///
  /// In ar, this message translates to:
  /// **'إشعارات الجهاز'**
  String get pushPermissionSettingsTitle;

  /// No description provided for @pushPermissionStatusGranted.
  ///
  /// In ar, this message translates to:
  /// **'مفعّلة'**
  String get pushPermissionStatusGranted;

  /// No description provided for @pushPermissionStatusDenied.
  ///
  /// In ar, this message translates to:
  /// **'غير مفعّلة'**
  String get pushPermissionStatusDenied;

  /// No description provided for @pushPermissionStatusProvisional.
  ///
  /// In ar, this message translates to:
  /// **'مفعّلة (مؤقتة)'**
  String get pushPermissionStatusProvisional;

  /// No description provided for @pushPermissionStatusNotDetermined.
  ///
  /// In ar, this message translates to:
  /// **'لم يتم السؤال بعد'**
  String get pushPermissionStatusNotDetermined;

  /// No description provided for @pushPermissionStatusUnsupported.
  ///
  /// In ar, this message translates to:
  /// **'غير متاحة في هذا الإصدار'**
  String get pushPermissionStatusUnsupported;

  /// No description provided for @pushPermissionSettingsAction.
  ///
  /// In ar, this message translates to:
  /// **'تفعيل الإشعارات'**
  String get pushPermissionSettingsAction;

  /// No description provided for @pushPermissionOpenSystemSettingsHint.
  ///
  /// In ar, this message translates to:
  /// **'لتغيير هذا الإذن يجب فتح إعدادات النظام لهذا التطبيق.'**
  String get pushPermissionOpenSystemSettingsHint;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
