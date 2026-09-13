'use strict';

const PROVIDERS = Object.freeze({
  YOUTUBE: 'youtube',
  VIMEO: 'vimeo',
});

const SOURCE_TYPES = Object.freeze({
  SINGLE: 'single',
  PLAYLIST: 'playlist',
});

const STATUSES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  HIDDEN: 'hidden',
});

const AUDIT = Object.freeze({
  CREATED: 'RECORDED_LECTURE_CREATED',
  UPDATED: 'RECORDED_LECTURE_UPDATED',
  PUBLISHED: 'RECORDED_LECTURE_PUBLISHED',
  HIDDEN: 'RECORDED_LECTURE_HIDDEN',
  IMPORTED_SINGLE: 'RECORDED_LECTURE_IMPORTED_SINGLE',
  IMPORTED_PLAYLIST: 'RECORDED_LECTURES_IMPORTED_PLAYLIST',
  REORDERED: 'RECORDED_LECTURES_REORDERED',
  PLAYLIST_SYNCED: 'RECORDED_LECTURE_PLAYLIST_SYNCED',
});

const MSG = Object.freeze({
  notFound: 'المحاضرة المسجلة غير موجودة.',
  forbidden: 'لا تملك صلاحية الوصول إلى هذه المحاضرة.',
  duplicate: 'هذا الفيديو مضاف مسبقًا لهذه الفرصة التدريبية.',
  sessionMismatch: 'الجلسة المحددة لا تتبع نفس فرصة التدريب.',
  opportunityNotFound: 'فرصة التدريب غير موجودة.',
  sessionNotFound: 'الجلسة المحددة غير موجودة.',
  reviewerReadOnly: 'ليس لديك صلاحية إنشاء أو تعديل المحاضرات المسجلة.',
  institution: 'لا تملك صلاحية الوصول إلى المحاضرات المسجلة للتدريب الميداني.',
  universityRequired: 'لم يتم ربط حسابك بجامعة.',
  titleRequired: 'عنوان المحاضرة مطلوب.',
  providerUnsupported: 'مزود الفيديو غير مدعوم.',
  videoIdRequired: 'معرّف الفيديو مطلوب.',
  videoIdInvalid: 'معرّف الفيديو غير صالح. استخدم المعرّف وليس الرابط الكامل.',
  durationInvalid: 'مدة المحاضرة يجب أن تكون صفرًا أو أكثر.',
  sortOrderInvalid: 'ترتيب المحاضرة لا يمكن أن يكون سالبًا.',
  statusInvalid: 'حالة المحاضرة غير معروفة.',
  sourceTypeInvalid: 'نوع مصدر المحاضرة غير معروف.',
  youtubeUrlInvalid: 'رابط YouTube غير صالح.',
  youtubeVideoUnavailable: 'تعذر العثور على الفيديو أو الوصول إليه.',
  youtubePlaylistUnavailable: 'تعذر العثور على قائمة التشغيل أو الوصول إليها.',
  youtubePlaylistEmpty: 'لا توجد فيديوهات قابلة للاستيراد في قائمة التشغيل.',
  youtubeKeyMissing: 'خدمة YouTube غير مهيأة على الخادم. تواصل مع مدير النظام.',
  youtubeQuota: 'تم تجاوز الحد المتاح لخدمة YouTube مؤقتًا.',
  youtubeUnavailable: 'تعذر الاتصال بخدمة YouTube حاليًا، يرجى المحاولة لاحقًا.',
  youtubePlaylistTooLarge: 'قائمة التشغيل أكبر من الحد المسموح ولا يمكن استيرادها دفعة واحدة.',
  youtubeSelectionRequired: 'يرجى اختيار فيديوهات للاستيراد أو استيراد الكل.',
  reorderFailed: 'تعذر حفظ ترتيب المحاضرات، يرجى المحاولة مرة أخرى.',
  reorderIncomplete: 'يجب أن يشمل الترتيب جميع محاضرات هذه الفرصة.',
  reorderDuplicate: 'قائمة الترتيب تحتوي على معرفات مكررة.',
  reorderForeign: 'لا يمكن ترتيب محاضرات لا تنتمي لهذه الفرصة.',
  providerImmutable: 'لا يمكن تغيير معرّف الفيديو بعد الإنشاء.',
  youtubePlaylistSourceMissing: 'لا توجد قائمة تشغيل محفوظة لهذه الفرصة.',
  youtubePlaylistSourceRequired: 'يرجى تحديد قائمة التشغيل المراد مزامنتها.',
});

const PROVIDER_API = Object.freeze({
  youtube: 'YOUTUBE',
  vimeo: 'VIMEO',
});

const SOURCE_API = Object.freeze({
  single: 'SINGLE',
  playlist: 'PLAYLIST',
});

const STATUS_API = Object.freeze({
  draft: 'DRAFT',
  published: 'PUBLISHED',
  hidden: 'HIDDEN',
});

module.exports = {
  PROVIDERS,
  SOURCE_TYPES,
  STATUSES,
  AUDIT,
  MSG,
  PROVIDER_API,
  SOURCE_API,
  STATUS_API,
};
