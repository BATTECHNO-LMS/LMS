// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'BATTECHNO LMS';

  @override
  String get appTagline => 'University learning and field training platform';

  @override
  String get welcomeTitle => 'Welcome to your learning journey';

  @override
  String get welcomeSubtitle =>
      'Track field training, tasks, and academic progress from your phone.';

  @override
  String get email => 'Email';

  @override
  String get password => 'Password';

  @override
  String get login => 'Sign in';

  @override
  String get register => 'Create account';

  @override
  String get forgotPassword => 'Forgot password?';

  @override
  String get fullName => 'Full name';

  @override
  String get phoneOptional => 'Phone (optional)';

  @override
  String get university => 'University';

  @override
  String get specialty => 'Specialty';

  @override
  String get verifyEmail => 'Verify email';

  @override
  String get otpHint => 'Enter the 6-digit code';

  @override
  String get resendCode => 'Resend code';

  @override
  String get resetPassword => 'Reset password';

  @override
  String get newPassword => 'New password';

  @override
  String get confirmPassword => 'Confirm password';

  @override
  String get continueAction => 'Continue';

  @override
  String get retry => 'Retry';

  @override
  String get logout => 'Sign out';

  @override
  String get profile => 'Profile';

  @override
  String get home => 'Home';

  @override
  String get training => 'Training';

  @override
  String get tasks => 'Tasks';

  @override
  String get students => 'Students';

  @override
  String get grading => 'Grading';

  @override
  String get opportunities => 'Opportunities';

  @override
  String get users => 'Users';

  @override
  String get reports => 'Reports';

  @override
  String get reviews => 'Reviews';

  @override
  String get universities => 'Universities';

  @override
  String get administration => 'Administration';

  @override
  String get notifications => 'Notifications';

  @override
  String get accountPendingTitle => 'Account pending approval';

  @override
  String get accountPendingBody =>
      'Your email is verified. Your account awaits university administrator approval.';

  @override
  String get accountInactiveTitle => 'Account inactive';

  @override
  String get accountInactiveBody =>
      'You cannot access the platform right now. Contact your university administration.';

  @override
  String get unsupportedRoleTitle => 'Unsupported account';

  @override
  String get unsupportedRoleBody =>
      'Your account role is not supported in the mobile app. Contact support.';

  @override
  String get networkErrorTitle => 'Connection failed';

  @override
  String get networkErrorBody =>
      'Check your internet connection and try again.';

  @override
  String get sessionExpired => 'Session expired. Please sign in again.';

  @override
  String get loading => 'Loading…';

  @override
  String get emptyDashboard => 'Nothing to show yet';

  @override
  String get nextAction => 'Next action';

  @override
  String get trainingProgress => 'Training progress';

  @override
  String get completedHours => 'Completed hours';

  @override
  String get requiredHours => 'Required hours';

  @override
  String get quickActions => 'Quick actions';

  @override
  String get eligibleOpportunities => 'Eligible opportunities';

  @override
  String get recentActivity => 'Recent activity';

  @override
  String get greetingMorning => 'Good morning';

  @override
  String get greetingEvening => 'Good evening';

  @override
  String get fieldTrainingStatus => 'Field training status';

  @override
  String get noActiveTraining => 'No active field training right now';

  @override
  String get emailRequired => 'Email is required';

  @override
  String get emailInvalid => 'Enter a valid email address';

  @override
  String get passwordRequired => 'Password is required';

  @override
  String get passwordMinRegister => 'Password must be at least 6 characters';

  @override
  String get passwordMinReset => 'Password must be at least 8 characters';

  @override
  String get passwordMismatch => 'Passwords do not match';

  @override
  String get nameRequired => 'Full name is required';

  @override
  String get otpRequired => 'Verification code is required';

  @override
  String get otpInvalid => 'Code must be 6 digits';

  @override
  String get loginFailed =>
      'Sign in failed. Check your credentials and try again.';

  @override
  String get emailNotVerified => 'Please verify your email first.';

  @override
  String get settings => 'Settings';

  @override
  String get trainingDetails => 'Training details';

  @override
  String get description => 'Description';

  @override
  String get trainingDates => 'Training dates';

  @override
  String get requiredHoursNotSet =>
      'Required training hours have not been set yet';

  @override
  String get remainingHours => 'Remaining hours';

  @override
  String get noTasksCurrently => 'No required tasks at the moment';

  @override
  String get taskUntitled => 'Untitled task';

  @override
  String get dueDate => 'Due date';

  @override
  String tasksProgressLabel(int submitted, int total) {
    return '$submitted of $total tasks';
  }

  @override
  String get taskDetails => 'Task details';

  @override
  String get taskNotFound => 'Task not found';

  @override
  String get previousSubmission => 'Previous submission';

  @override
  String get submittedAt => 'Submitted at';

  @override
  String get submitTask => 'Submit task';

  @override
  String get projectUrl => 'Project URL';

  @override
  String get submissionNotes => 'Your notes (optional)';

  @override
  String get attachFileOptional => 'Attach file (optional)';

  @override
  String get fileUploadHint =>
      'You may attach a PDF or image. R2-hosted production may require web upload in a later phase.';

  @override
  String get taskSubmitSuccess => 'Task submitted successfully';

  @override
  String get aiTaskMobileLimited =>
      'This task requires AI self-evaluation. Complete it on the web platform for now.';

  @override
  String get assessmentsTitle => 'Assessments';

  @override
  String get preAssessment => 'Pre-training assessment';

  @override
  String get postAssessment => 'Post-training assessment';

  @override
  String get assessmentAvailable => 'Available now';

  @override
  String get assessmentCompleted => 'Completed';

  @override
  String get assessmentNotPublished => 'Not published yet';

  @override
  String get assessmentLocked => 'Currently unavailable';

  @override
  String get assessmentUnavailable => 'Currently unavailable';

  @override
  String get startAssessment => 'Start assessment';

  @override
  String get viewAssessmentResult => 'View result';

  @override
  String assessmentScoreLabel(int score) {
    return 'Score: $score%';
  }

  @override
  String assessmentPassScoreLabel(int score) {
    return 'Pass score: $score%';
  }

  @override
  String get assessmentInstructions => 'Assessment instructions';

  @override
  String get assessmentDefaultInstructions =>
      'Read each question carefully. You cannot retake the assessment after submission.';

  @override
  String assessmentQuestionCountLabel(int count) {
    return 'Questions: $count';
  }

  @override
  String get assessmentStartWarning =>
      'Ensure you have a stable connection before starting. Answers cannot be changed after submission.';

  @override
  String assessmentQuestionProgress(int current, int total) {
    return 'Question $current of $total';
  }

  @override
  String get assessmentAttempt => 'Take assessment';

  @override
  String get previousQuestion => 'Previous';

  @override
  String get nextQuestion => 'Next';

  @override
  String get submitAssessment => 'Submit assessment';

  @override
  String get submitAssessmentConfirmTitle => 'Confirm submission';

  @override
  String get submitAssessmentConfirmBody =>
      'Are you sure you want to submit? You cannot undo this action.';

  @override
  String get leaveAssessmentTitle => 'Leave assessment?';

  @override
  String get leaveAssessmentBody =>
      'Your answers are only saved locally until you submit. Leave anyway?';

  @override
  String get leaveAssessmentConfirm => 'Leave';

  @override
  String get assessmentResult => 'Assessment result';

  @override
  String get assessmentPassed => 'Passed';

  @override
  String get assessmentNotPassed => 'Not passed';

  @override
  String get assessmentResultPending => 'Pending evaluation';

  @override
  String get assessmentPendingManual =>
      'Some answers require manual grading by an instructor.';

  @override
  String get backToTraining => 'Back to training';

  @override
  String get trueAnswer => 'True';

  @override
  String get falseAnswer => 'False';

  @override
  String get yourAnswer => 'Your answer';

  @override
  String get unsupportedQuestionType =>
      'This question type is not supported on mobile yet.';

  @override
  String get noAssessmentsRequired =>
      'No assessments are required for this training.';

  @override
  String get assessmentNotReady => 'The assessment is not ready yet.';

  @override
  String get trainingJourney => 'Training journey';

  @override
  String get upcomingSession => 'Upcoming session';

  @override
  String get viewAssessments => 'View assessments';

  @override
  String get attendanceSummary => 'Attendance summary';

  @override
  String get viewAllSessions => 'All sessions';

  @override
  String attendancePercentageLabel(int percent) {
    return 'Attendance: $percent%';
  }

  @override
  String sessionsAttendedLabel(int attended, int required) {
    return '$attended of $required sessions';
  }

  @override
  String get attendanceSummaryUnavailable =>
      'Attendance summary is not available yet.';

  @override
  String get trainingSessions => 'Training sessions';

  @override
  String get noSessionsCurrently => 'No sessions scheduled at the moment.';

  @override
  String get upcomingSessions => 'Upcoming sessions';

  @override
  String get pastSessions => 'Past sessions';

  @override
  String get sessionDetails => 'Session details';

  @override
  String get sessionNotFound => 'Session not found';

  @override
  String get sessionTime => 'Session time';

  @override
  String get sessionRequired => 'Required session';

  @override
  String get attendanceStatus => 'Attendance status';

  @override
  String get yes => 'Yes';

  @override
  String get no => 'No';

  @override
  String get joinSession => 'Join session';

  @override
  String get noMeetingLink => 'Meeting link is not available yet.';

  @override
  String get openMeetingLinkTitle => 'Open meeting link';

  @override
  String get openMeetingLinkBody => 'This will open an external app. Continue?';

  @override
  String get openLink => 'Open link';

  @override
  String get invalidMeetingLink => 'Invalid meeting link.';

  @override
  String get pendingPreAssessment => 'Pre-assessment required';

  @override
  String get pendingPostAssessment => 'Post-assessment required';

  @override
  String get applyToTrainingTitle => 'Confirm application';

  @override
  String get applyToTrainingBody =>
      'Do you want to apply for this training opportunity?';

  @override
  String get applyNow => 'Apply now';

  @override
  String get applicationSubmitted => 'Your application was submitted';

  @override
  String get searchTraining => 'Search training';

  @override
  String get noTrainingInSection => 'Nothing in this section';

  @override
  String get viewTrainingDetails => 'View details';

  @override
  String get profileIncompleteForTraining =>
      'Complete your university profile on the web before applying.';

  @override
  String lastUpdatedAt(String time) {
    return 'Last updated: $time';
  }

  @override
  String get offlineCachedBanner => 'Showing temporarily cached data';

  @override
  String notificationsUnreadCount(int count) {
    return '$count unread';
  }

  @override
  String get markAllRead => 'Mark all read';

  @override
  String get unreadOnly => 'Unread only';

  @override
  String get noNotifications => 'No notifications right now';

  @override
  String get notificationTargetUnavailable =>
      'This notification cannot be opened on mobile yet';

  @override
  String get certificatesAndDocuments => 'Certificates & documents';

  @override
  String get certificatesTitle => 'Certificates';

  @override
  String get officialLetters => 'Official letters';

  @override
  String get completionLetter => 'Completion letter';

  @override
  String get noCertificatesOrDocuments => 'No certificates or documents yet';

  @override
  String get certificateDetails => 'Certificate details';

  @override
  String get certificateNotFound => 'Certificate not found';

  @override
  String get certificateNumber => 'Certificate number';

  @override
  String get issuedAt => 'Issued at';

  @override
  String get certificateStatus => 'Certificate status';

  @override
  String get verificationCode => 'Verification code';

  @override
  String get certificateDownloadUnavailable =>
      'Certificate file download is not available yet. Use official verification instead.';

  @override
  String get verifyCertificate => 'Verify certificate';

  @override
  String get documentDownloadFailed => 'Could not download document';

  @override
  String get profileReadOnlyNotice =>
      'Profile updates are not available in the app yet. Contact your university if needed.';

  @override
  String get accountStatus => 'Account status';

  @override
  String get yourProfile => 'Your Profile';

  @override
  String get profileOverviewTitle => 'Your overview';

  @override
  String get profileOverviewSubtitle => 'Profile completeness';

  @override
  String get profileShortcutsTitle => 'Quick shortcuts';

  @override
  String get profileShortcutsSubtitle =>
      'Settings, certificates, and training in one place';

  @override
  String get profileViewAll => 'View all';

  @override
  String get profileFieldEmail => 'Email';

  @override
  String get profileFieldUniversity => 'University';

  @override
  String get profileFieldSpecialty => 'Specialty';

  @override
  String get profileFieldPhone => 'Phone';

  @override
  String get language => 'Language';

  @override
  String get languageArabic => 'Arabic';

  @override
  String get languageEnglish => 'English';

  @override
  String get changePasswordUnavailable => 'Change password';

  @override
  String get useForgotPasswordFlow =>
      'Use forgot password from the login screen';

  @override
  String get privacyNotice => 'Privacy';

  @override
  String get privacyNoticeBody =>
      'Passwords and assessment answers are not stored on device.';

  @override
  String get privacyPolicyLink => 'Privacy policy';

  @override
  String get appVersion => 'App version';

  @override
  String get logoutServerLimitation =>
      'Logout clears the local session only. Server tokens may remain active briefly (QA-AUTH-001).';

  @override
  String get accountManagement => 'Account Management';

  @override
  String get deleteAccount => 'Delete Account';

  @override
  String get requestAccountDeletion => 'Request Account Deletion';

  @override
  String get deletionRequestStatus => 'Deletion Request Status';

  @override
  String get cancelDeletionRequest => 'Cancel Deletion Request';

  @override
  String get deletionExplainTitle => 'You are requesting account deletion';

  @override
  String get deletionExplainBody =>
      'Submitting a request is not the same as immediate deletion. Your request may require identity verification and an authorized review before your personal account data is deleted or anonymized. You may lose access to courses, field training, certificates, and account data after processing.';

  @override
  String get deletionRetentionBody =>
      'Certain academic, legal, security, or audit records may be retained where required by institutional or legal obligations. Disabling an account is different from permanent deletion.';

  @override
  String get deletionReasonOptional => 'Reason (optional)';

  @override
  String get deletionCurrentPassword => 'Current password';

  @override
  String get deletionTypeDelete => 'Type DELETE to confirm';

  @override
  String get deletionTypeDeleteHint => 'Confirmation must be exactly DELETE';

  @override
  String get deletionCheckboxLabel =>
      'I understand this is a deletion request and that some records may be retained.';

  @override
  String get deletionCheckboxRequired =>
      'Please confirm that you understand the deletion request.';

  @override
  String get deletionPasswordRequired => 'Enter your current password.';

  @override
  String get deletionConfirmationInvalid => 'Type DELETE exactly to confirm.';

  @override
  String get deletionInvalidPassword => 'Current password is incorrect.';

  @override
  String get deletionFinalConfirmTitle => 'Confirm deletion request';

  @override
  String get deletionFinalConfirmBody =>
      'This will submit a reviewable deletion request. Your account will not be deleted immediately.';

  @override
  String get deletionSubmit => 'Submit request';

  @override
  String get deletionSubmitSuccess =>
      'Deletion request submitted. Status will update after review.';

  @override
  String get deletionSubmitFailed => 'Could not submit the deletion request.';

  @override
  String get deletionAlreadyExists =>
      'You already have an active deletion request.';

  @override
  String get deletionNotFound => 'No active deletion request was found.';

  @override
  String get deletionCannotCancel =>
      'This deletion request can no longer be cancelled.';

  @override
  String get deletionUnavailable =>
      'Account deletion is unavailable for this account type.';

  @override
  String get deletionOfflineRequired =>
      'An internet connection is required to request or cancel account deletion.';

  @override
  String get deletionStatusNone => 'No deletion request';

  @override
  String get deletionStatusPending => 'Pending review';

  @override
  String get deletionStatusProcessing => 'Processing';

  @override
  String get deletionStatusCompleted => 'Completed';

  @override
  String get deletionStatusRejected => 'Rejected';

  @override
  String get deletionStatusCancelled => 'Cancelled';

  @override
  String deletionRequestedAt(String when) {
    return 'Requested: $when';
  }

  @override
  String get deletionWhatHappensNext =>
      'An authorized administrator will review your request. You can keep using the app while the request is pending unless your account becomes inactive.';

  @override
  String get deletionCancelTitle => 'Cancel deletion request?';

  @override
  String get deletionCancelBody =>
      'Your pending deletion request will be cancelled. You can submit a new request later.';

  @override
  String get deletionCancelAction => 'Cancel request';

  @override
  String get deletionCancelSuccess => 'Deletion request cancelled.';

  @override
  String get deletionContactSupport => 'Contact support';

  @override
  String get accountDeletionWebLink => 'Account deletion (web)';

  @override
  String get certificateReady => 'Completion document ready';

  @override
  String get viewCertificatesHint => 'View or download your completion letter';

  @override
  String get myTrainings => 'My trainings';

  @override
  String instructorGreeting(String name) {
    return 'Hello, $name';
  }

  @override
  String activeTrainingsCount(int count) {
    return '$count active trainings';
  }

  @override
  String activeStudentsCount(int count) {
    return '$count active students';
  }

  @override
  String pendingSubmissionsCount(int count) {
    return '$count submissions awaiting review';
  }

  @override
  String atRiskStudentsCount(int count) {
    return '$count students need follow-up';
  }

  @override
  String instructorPriorityReviewSubmissions(int count) {
    return 'Review $count submissions';
  }

  @override
  String get instructorPriorityUpcomingSession => 'Open upcoming training';

  @override
  String get instructorPriorityRecordAttendance =>
      'Record today\'s session attendance';

  @override
  String instructorPriorityFollowUp(int count) {
    return 'Follow up $count students';
  }

  @override
  String get instructorPriorityOpenTraining => 'Open your training';

  @override
  String get noAssignedTrainings => 'No trainings assigned to you yet';

  @override
  String get searchAssignedTrainings => 'Search your trainings';

  @override
  String get hours => 'hours';

  @override
  String get hoursNotSpecified => 'Hours not specified';

  @override
  String get sessions => 'sessions';

  @override
  String get attendance => 'Attendance';

  @override
  String get participants => 'Participants';

  @override
  String get viewParticipants => 'View students';

  @override
  String get viewSessions => 'View sessions';

  @override
  String get viewSubmissions => 'Review submissions';

  @override
  String get viewAssessmentResults => 'Assessment results';

  @override
  String get recordAttendance => 'Record attendance';

  @override
  String get createSession => 'Create session';

  @override
  String get editSession => 'Edit session';

  @override
  String get sessionTitle => 'Session title';

  @override
  String get sessionDate => 'Session date';

  @override
  String get startTime => 'Start time';

  @override
  String get endTime => 'End time';

  @override
  String get meetingLink => 'Meeting link';

  @override
  String get sessionSaved => 'Session saved';

  @override
  String get invalidSessionTimes => 'End time must be after start time';

  @override
  String get invalidMeetingUrl => 'Invalid meeting link';

  @override
  String get markAllPresent => 'Mark all present';

  @override
  String get unsavedAttendanceTitle => 'Unsaved changes';

  @override
  String get unsavedAttendanceBody =>
      'You have unsaved attendance changes. Leave anyway?';

  @override
  String get discardChanges => 'Discard';

  @override
  String get saveAttendance => 'Save attendance';

  @override
  String get attendanceSaved => 'Attendance saved';

  @override
  String get attendanceSaveFailed => 'Could not save attendance';

  @override
  String get confirmAttendanceSave => 'Confirm attendance';

  @override
  String get confirmAttendanceSaveBody =>
      'Attendance will be saved for all selected students.';

  @override
  String get hoursReadOnlyNotice =>
      'Recording completed training hours is not available via the mobile API yet. Hours are shown only when returned by the server.';

  @override
  String get requiredHoursLabel => 'Required hours';

  @override
  String get completedHoursLabel => 'Completed hours';

  @override
  String get remainingHoursLabel => 'Remaining hours';

  @override
  String get hoursProgressLabel => 'Hours progress';

  @override
  String get recordHours => 'Record hours';

  @override
  String get updateHours => 'Update hours';

  @override
  String get hoursNoteOptional => 'Note (optional)';

  @override
  String get hoursSaved => 'Hours updated';

  @override
  String get hoursConflict =>
      'Hours were updated by someone else. Refresh and try again.';

  @override
  String get hoursExceedRequired =>
      'Completed hours cannot exceed required hours.';

  @override
  String get hoursValidationInvalid => 'Enter a non-negative whole number.';

  @override
  String get hoursNotRecorded => 'Not recorded yet';

  @override
  String get hoursRecordedPerStudentHint =>
      'Completed hours are recorded per student from the participant progress screen.';

  @override
  String get reviewSubmission => 'Review submission';

  @override
  String get approveSubmission => 'Approve';

  @override
  String get rejectSubmission => 'Reject';

  @override
  String get requestRevision => 'Request revision';

  @override
  String get instructorFeedback => 'Instructor feedback';

  @override
  String get feedbackRequired =>
      'Enter feedback when requesting revision or rejecting';

  @override
  String get reviewSaved => 'Review saved';

  @override
  String get downloadAttachment => 'Download attachment';

  @override
  String get noSubmissions => 'No submissions yet';

  @override
  String get noParticipants => 'No participants yet';

  @override
  String get noSessions => 'No sessions yet';

  @override
  String get assessmentResults => 'Assessment results';

  @override
  String get score => 'Score';

  @override
  String get passed => 'Passed';

  @override
  String get failed => 'Failed';

  @override
  String get noAssessmentResults => 'No assessment results yet';

  @override
  String get forbiddenAccess =>
      'You are not authorized to access this training';

  @override
  String get resourceNotFound => 'This item was not found or was removed';

  @override
  String get conflictError => 'Update conflict. Refresh and try again';

  @override
  String get validationError => 'Please check the entered data';

  @override
  String get instructorStudentsHub => 'My training students';

  @override
  String get selectTrainingForStudents =>
      'Select a training to view its students';

  @override
  String get opportunityInfo => 'Opportunity info';

  @override
  String get leaveWithoutSaving => 'Leave';

  @override
  String get stayAndEdit => 'Stay';

  @override
  String get save => 'Save';

  @override
  String get instructorRole => 'Instructor';

  @override
  String get trainees => 'Trainees';

  @override
  String get universityAdminRole => 'University Admin';

  @override
  String get academicAdminRole => 'Academic Admin';

  @override
  String adminOpportunitiesCount(int count) {
    return '$count opportunities';
  }

  @override
  String adminPublishedOpportunitiesCount(int count) {
    return '$count published';
  }

  @override
  String adminPendingApplicationsCount(int count) {
    return '$count applications awaiting review';
  }

  @override
  String adminPendingUsersCount(int count) {
    return '$count accounts pending activation';
  }

  @override
  String get adminPriorityCompleteSetup => 'Complete an opportunity\'s setup';

  @override
  String get createOpportunity => 'Create opportunity';

  @override
  String get noOpportunities => 'No training opportunities yet';

  @override
  String get editOpportunity => 'Edit opportunity';

  @override
  String get publishOpportunity => 'Publish opportunity';

  @override
  String get archiveOpportunity => 'Archive opportunity';

  @override
  String get confirmPublishBody =>
      'The opportunity will be published and open for eligible students to apply.';

  @override
  String get confirmArchiveBody =>
      'The opportunity will be archived and no longer accept applications.';

  @override
  String get opportunityPublished => 'Opportunity published';

  @override
  String get opportunityArchived => 'Opportunity archived';

  @override
  String get needsEligibilitySetupNotice =>
      'Set up eligible universities and specialties before publishing';

  @override
  String get assignedInstructorLabel => 'Assigned instructor';

  @override
  String get reviewApplications => 'Review applications';

  @override
  String get rejectApplication => 'Reject';

  @override
  String get approveApplication => 'Approve';

  @override
  String get confirmApproveTitle => 'Confirm approval';

  @override
  String get confirmRejectTitle => 'Confirm rejection';

  @override
  String get adminNoteOptional => 'Admin note (optional)';

  @override
  String get opportunityTitleLabel => 'Opportunity title';

  @override
  String get locationLabel => 'Location';

  @override
  String get trainingModeLabel => 'Training mode';

  @override
  String get startDateLabel => 'Start date';

  @override
  String get endDateLabel => 'End date';

  @override
  String get invalidRequiredHours =>
      'Enter a positive whole number for required hours';

  @override
  String get specialtyRequired => 'Please select a specialty';

  @override
  String get specialtyCatalogUnavailable =>
      'Could not load the eligible specialties for your university';

  @override
  String get opportunitySaved => 'Training opportunity saved';

  @override
  String get adminReportEligibleOpportunities => 'Eligible opportunities';

  @override
  String get adminReportTotalApplicants => 'Total applicants';

  @override
  String get adminReportAcceptedStudents => 'Accepted students';

  @override
  String get adminReportInTraining => 'In training';

  @override
  String get adminReportCompletedStudents => 'Completed students';

  @override
  String get adminReportCompletionLetters => 'Completion letters issued';

  @override
  String get approveRecognition => 'Approve request';

  @override
  String get assignedReviewerLabel => 'Assigned reviewer';

  @override
  String get certificatesUnavailableForRole =>
      'Certificate listing is not available for this role yet';

  @override
  String get changeStatus => 'Change status';

  @override
  String get cohortLabel => 'Cohort';

  @override
  String get confirmEnrollmentApproveTitle => 'Confirm enrollment approval';

  @override
  String get confirmEnrollmentRejectTitle => 'Confirm enrollment rejection';

  @override
  String confirmRecognitionDecisionBody(String status) {
    return 'The request status will change to: $status';
  }

  @override
  String get confirmRecognitionDecisionTitle => 'Confirm decision';

  @override
  String confirmStatusChangeBody(String status) {
    return 'Status will change to: $status';
  }

  @override
  String get confirmStatusChangeTitle => 'Confirm status change';

  @override
  String get correctiveActionsTitle => 'Corrective actions';

  @override
  String get correctiveAssigneeLabel => 'Assigned to';

  @override
  String get decideRecognition => 'Decide';

  @override
  String get enrollmentApproveAction => 'Approve enrollment';

  @override
  String get enrollmentApproved => 'Enrollment approved';

  @override
  String get enrollmentRejectAction => 'Reject enrollment';

  @override
  String get enrollmentRejected => 'Enrollment rejected';

  @override
  String get enrollmentRejectReasonOptional => 'Rejection reason (optional)';

  @override
  String get evidenceTitle => 'Evidence';

  @override
  String get evidenceTypeLabel => 'Evidence type';

  @override
  String get integrityCasesTitle => 'Integrity cases';

  @override
  String get integrityCaseTypeLabel => 'Case type';

  @override
  String get integrityDecisionLabel => 'Decision';

  @override
  String get integrityEvidenceNotesLabel => 'Evidence notes';

  @override
  String get moveToUnderReview => 'Start review';

  @override
  String get noCorrectiveActions => 'No corrective actions yet';

  @override
  String get noEvidence => 'No evidence yet';

  @override
  String get noIntegrityCases => 'No integrity cases yet';

  @override
  String get noPendingEnrollments => 'No pending enrollment requests';

  @override
  String get noQaReviews => 'No QA reviews yet';

  @override
  String get noRecognitionDocuments => 'No documents attached yet';

  @override
  String get noRecognitionRequests => 'No recognition requests yet';

  @override
  String get noRiskCases => 'No risk cases yet';

  @override
  String get noStatusActionsAvailable =>
      'No status actions are available from the current status';

  @override
  String get offlineWriteBlocked =>
      'This action requires an internet connection. Check your connection and try again.';

  @override
  String openCorrectiveActionsCount(int count) {
    return '$count open corrective actions';
  }

  @override
  String get openDocument => 'Open document';

  @override
  String get openEvidenceFile => 'Open file';

  @override
  String openQaReviewsCount(int count) {
    return '$count open QA reviews';
  }

  @override
  String openRiskCasesCount(int count) {
    return '$count open risk cases';
  }

  @override
  String pendingEnrollmentsCountLabel(int count) {
    return '$count enrollment requests awaiting decision';
  }

  @override
  String get pendingEnrollmentsTitle => 'Pending enrollments';

  @override
  String pendingRecognitionCount(int count) {
    return '$count recognition requests awaiting decision';
  }

  @override
  String get qaActionRequiredLabel => 'Action required';

  @override
  String get qaFindingsLabel => 'Findings';

  @override
  String get qaOfficerRoleLabel => 'QA officer';

  @override
  String get qaPriorityOpenReview => 'Review the oldest open QA review';

  @override
  String get qaReviewDateLabel => 'Review date';

  @override
  String get qaReviewsTitle => 'QA reviews';

  @override
  String get qaReviewTypeLabel => 'Review type';

  @override
  String get qaStatusClosed => 'Closed';

  @override
  String get qaStatusInProgress => 'In progress';

  @override
  String get qaStatusOpen => 'Open';

  @override
  String get qaStatusResolved => 'Resolved';

  @override
  String get recognitionDocumentsTitle => 'Request documents';

  @override
  String get recognitionMicroCredentialLabel => 'Micro-credential';

  @override
  String get recognitionRequestsTitle => 'Recognition requests';

  @override
  String get recognitionStatusApproved => 'Approved';

  @override
  String get recognitionStatusDraft => 'Draft';

  @override
  String get recognitionStatusInPreparation => 'In preparation';

  @override
  String get recognitionStatusNeedsRevision => 'Needs revision';

  @override
  String get recognitionStatusReadyForSubmission => 'Ready for submission';

  @override
  String get recognitionStatusRejected => 'Rejected';

  @override
  String get recognitionStatusSubmitted => 'Submitted';

  @override
  String get recognitionStatusUnderReview => 'Under review';

  @override
  String get recognitionStatusUpdated => 'Recognition request status updated';

  @override
  String get rejectRecognition => 'Reject request';

  @override
  String get relatedCorrectiveActions => 'Related corrective actions';

  @override
  String get requestChangesRecognition => 'Request changes';

  @override
  String get reviewerPriorityDecideEnrollment =>
      'Review pending enrollment requests';

  @override
  String get reviewerPriorityDecideRecognition =>
      'Decide on the recognition request';

  @override
  String get reviewerSearchStudents => 'Search students';

  @override
  String get reviewTypePeriodic => 'Periodic';

  @override
  String get reviewTypePreClosure => 'Pre-closure';

  @override
  String get reviewTypeScheduled => 'Scheduled';

  @override
  String get reviewTypeSpecial => 'Special';

  @override
  String get riskActionPlanLabel => 'Action plan';

  @override
  String get riskCasesTitle => 'Risk cases';

  @override
  String get riskLevelLabel => 'Risk level';

  @override
  String get riskTypeLabel => 'Risk type';

  @override
  String get searchEvidence => 'Search evidence';

  @override
  String get searchRecognitionRequests => 'Search recognition requests';

  @override
  String get searchReviews => 'Search reviews';

  @override
  String get statusChangeSaved => 'Status updated';

  @override
  String get statusConflictRefresh =>
      'This item was updated by someone else. Data has been refreshed.';

  @override
  String get statusEscalatedLabel => 'Escalated';

  @override
  String get statusLabel => 'Status';

  @override
  String get statusOverdueLabel => 'Overdue';

  @override
  String get statusReportedLabel => 'Reported';

  @override
  String get statusUnderInvestigationLabel => 'Under investigation';

  @override
  String get universityReviewerRoleLabel => 'University reviewer';

  @override
  String get superAdminRoleLabel => 'Super Admin';

  @override
  String get isGlobalBadge => 'Global access';

  @override
  String get superAdminGlobalScopeNotice =>
      'You have global access across every university and user in the system.';

  @override
  String get superAdminLostPrivilegeMessage =>
      'Your super admin privilege is no longer active. Contact another super admin if this is unexpected.';

  @override
  String get superAdminCohortsLabel => 'Cohorts';

  @override
  String get superAdminPendingEnrollmentsLabel => 'Pending enrollments';

  @override
  String get superAdminFieldTrainingOversight => 'Field training oversight';

  @override
  String get superAdminQaOversight => 'QA & recognition oversight';

  @override
  String get superAdminGlobalReportTitle => 'Global field training report';

  @override
  String get superAdminUniversityComparisonTitle => 'University comparison';

  @override
  String get superAdminExpelledLabel => 'Expelled';

  @override
  String get superAdminReportExportWebOnlyNotice =>
      'PDF/Excel export is currently only available on the web platform.';

  @override
  String get auditLogsTitle => 'Audit log';

  @override
  String get searchAuditLogs => 'Search audit log';

  @override
  String get noAuditLogs => 'No audit log entries yet';

  @override
  String get systemStatusTitle => 'System status';

  @override
  String get systemStatusApiOnlyNotice =>
      'This check only shows API availability — no environment or database details.';

  @override
  String get apiAvailable => 'API is available';

  @override
  String get apiUnavailable => 'Could not reach the API';

  @override
  String get searchUniversities => 'Search universities';

  @override
  String get noUniversitiesFound => 'No matching universities';

  @override
  String get createUniversity => 'Add university';

  @override
  String get editUniversity => 'Edit university';

  @override
  String get universityDetail => 'University details';

  @override
  String get universityNameLabel => 'University name';

  @override
  String get contactPersonLabel => 'Contact person';

  @override
  String get universitySaved => 'University saved';

  @override
  String get universityNameTaken => 'This university name is already taken';

  @override
  String get searchUsers => 'Search users';

  @override
  String get noUsersFound => 'No matching users';

  @override
  String get userDetail => 'User details';

  @override
  String get userActivated => 'User activated';

  @override
  String get activateUserAction => 'Activate user';

  @override
  String get roleAssignmentLabel => 'Assigned roles';

  @override
  String get assignRolesTitle => 'Assign roles';

  @override
  String get superAdminRoleWarning =>
      'Warning: this role grants full super admin control over the system';

  @override
  String get superAdminBadge => 'Super Admin';

  @override
  String get rolesUpdated => 'User roles updated';

  @override
  String get confirmGrantSuperAdminTitle => 'Confirm granting super admin';

  @override
  String get confirmGrantSuperAdminBody =>
      'This user will get full super admin privileges across every university and user. Are you sure?';

  @override
  String get confirmRevokeSuperAdminTitle => 'Confirm removing super admin';

  @override
  String get confirmRevokeSuperAdminBody =>
      'Super admin privilege will be removed from this user immediately. Are you sure?';

  @override
  String get pushPermissionSheetTitle => 'Never miss an update';

  @override
  String get pushPermissionSheetBody =>
      'Turn on notifications to get instant alerts for enrollment approvals, task reviews, and field training updates — even when the app is closed.';

  @override
  String get pushPermissionEnableAction => 'Enable notifications';

  @override
  String get pushPermissionSkipAction => 'Not now';

  @override
  String get pushNotificationChannelName => 'BATTECHNO LMS notifications';

  @override
  String get pushNotificationChannelDescription =>
      'Real-time alerts for account, field training, and task updates';

  @override
  String get pushPermissionSettingsTitle => 'Device notifications';

  @override
  String get pushPermissionStatusGranted => 'Enabled';

  @override
  String get pushPermissionStatusDenied => 'Disabled';

  @override
  String get pushPermissionStatusProvisional => 'Enabled (provisional)';

  @override
  String get pushPermissionStatusNotDetermined => 'Not asked yet';

  @override
  String get pushPermissionStatusUnsupported => 'Not available in this build';

  @override
  String get pushPermissionSettingsAction => 'Enable notifications';

  @override
  String get pushPermissionOpenSystemSettingsHint =>
      'Changing this permission requires opening this app\'s system settings.';

  @override
  String get courses => 'Courses';

  @override
  String get coursesSubtitle =>
      'Follow your academic courses and learning progress';

  @override
  String get searchCourses => 'Search courses';

  @override
  String get searchLessons => 'Search lessons';

  @override
  String get coursesFilterAll => 'All';

  @override
  String get coursesFilterInProgress => 'In progress';

  @override
  String get coursesFilterNotStarted => 'Not started';

  @override
  String get coursesFilterCompleted => 'Completed';

  @override
  String get coursesEmptyTitle => 'No courses available for you yet';

  @override
  String get coursesEmptyBody =>
      'Courses published by the platform for you or your cohort group will appear here.';

  @override
  String get coursesFilterEmpty => 'No courses match this filter';

  @override
  String get courseOfflineWriteBlocked =>
      'This action needs an internet connection.';

  @override
  String get courseLinkUnsafe => 'This link cannot be opened securely.';

  @override
  String get courseLinkMissing => 'No link is available for this lesson.';

  @override
  String get courseAccessDenied => 'You do not have access to this course.';

  @override
  String get courseNotFound => 'Course not found';

  @override
  String get courseCompletedLabel => 'Course completed';

  @override
  String get courseStatusInProgress => 'In progress';

  @override
  String get courseStatusCompleted => 'Completed';

  @override
  String get courseStatusNotStarted => 'Not started';

  @override
  String get courseStatusUnknown => 'Unknown status';

  @override
  String courseProgressLabel(int percent, int completed, int total) {
    return '$percent% · $completed / $total lessons';
  }

  @override
  String courseProgressPercent(int percent) {
    return '$percent%';
  }

  @override
  String get continueLearning => 'Continue learning';

  @override
  String get startCourse => 'Start course';

  @override
  String get courseSections => 'Course sections';

  @override
  String get courseLessons => 'Lessons';

  @override
  String get courseNoSections => 'No published sections yet';

  @override
  String get courseNoLessonsMatch => 'No lessons match your search';

  @override
  String courseSectionLessonCount(int count) {
    return '$count lessons';
  }

  @override
  String courseLessonDuration(int minutes) {
    return '${minutes}min';
  }

  @override
  String courseDurationTotalHours(int hours, int minutes) {
    return '${hours}h ${minutes}min in total';
  }

  @override
  String courseDurationTotalMinutes(int minutes) {
    return '${minutes}min in total';
  }

  @override
  String get courseNoNextLesson => 'No next lesson';

  @override
  String get courseLesson => 'Lesson';

  @override
  String get lessonNotFound => 'Lesson not found';

  @override
  String get openLessonVideo => 'Open video';

  @override
  String get openLessonResource => 'Open resource';

  @override
  String get markLessonComplete => 'Mark lesson complete';

  @override
  String get lessonMarkedComplete => 'Lesson marked complete';

  @override
  String get lessonCompleted => 'Completed';

  @override
  String get courseVideoNotYoutube =>
      'This video is not a supported in-app YouTube link.';

  @override
  String get lessonTrainingWebOnlyHint =>
      'Detailed lesson training (file upload / quiz) is available on the web when required.';
}
