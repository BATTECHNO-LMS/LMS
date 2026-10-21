/**
 * Public Jordan university directory for Field Training intake.
 * Separate from eprojecto tenant/organization records — selecting a university
 * never creates an Organization/University row.
 */

export const OTHER_UNIVERSITY = 'OTHER';

/** @typedef {'PUBLIC' | 'PRIVATE' | 'SPECIAL_LAW' | 'REGIONAL'} UniversityCategory */

/**
 * @typedef {object} JordanUniversity
 * @property {string} code
 * @property {string} nameAr
 * @property {string} [nameEn]
 * @property {UniversityCategory} category
 * @property {string[]} [aliases]
 * @property {boolean} active
 */

/** @type {JordanUniversity[]} */
export const JORDAN_UNIVERSITIES = [
  // PUBLIC
  { code: 'JU', nameAr: 'الجامعة الأردنية', nameEn: 'University of Jordan', category: 'PUBLIC', aliases: ['الأردنية', 'الجامعة الاردنية'], active: true },
  { code: 'YU', nameAr: 'جامعة اليرموك', nameEn: 'Yarmouk University', category: 'PUBLIC', aliases: ['اليرموك'], active: true },
  { code: 'MU', nameAr: 'جامعة مؤتة', nameEn: 'Mutah University', category: 'PUBLIC', aliases: ['مؤتة', 'موتة'], active: true },
  { code: 'JUST', nameAr: 'جامعة العلوم والتكنولوجيا الأردنية', nameEn: 'Jordan University of Science and Technology', category: 'PUBLIC', aliases: ['العلوم والتكنولوجيا', 'جست', 'JUST'], active: true },
  { code: 'HU', nameAr: 'الجامعة الهاشمية', nameEn: 'Hashemite University', category: 'PUBLIC', aliases: ['الهاشمية'], active: true },
  { code: 'AABU', nameAr: 'جامعة آل البيت', nameEn: 'Al al-Bayt University', category: 'PUBLIC', aliases: ['آل البيت', 'ال البيت'], active: true },
  { code: 'BAU', nameAr: 'جامعة البلقاء التطبيقية', nameEn: 'Al-Balqa Applied University', category: 'PUBLIC', aliases: ['البلقاء', 'البلقاء التطبيقية'], active: true },
  { code: 'AHU', nameAr: 'جامعة الحسين بن طلال', nameEn: 'Al-Hussein Bin Talal University', category: 'PUBLIC', aliases: ['الحسين بن طلال'], active: true },
  { code: 'TTU', nameAr: 'جامعة الطفيلة التقنية', nameEn: 'Tafila Technical University', category: 'PUBLIC', aliases: ['الطفيلة', 'الطفيلة التقنية'], active: true },
  { code: 'GJU', nameAr: 'الجامعة الألمانية الأردنية', nameEn: 'German Jordanian University', category: 'PUBLIC', aliases: ['الألمانية', 'الالمانية', 'GJU'], active: true },

  // PRIVATE
  { code: 'AAU', nameAr: 'جامعة عمان العربية', nameEn: 'Amman Arab University', category: 'PRIVATE', aliases: ['عمان العربية'], active: true },
  { code: 'MEU', nameAr: 'جامعة الشرق الأوسط', nameEn: 'Middle East University', category: 'PRIVATE', aliases: ['الشرق الأوسط', 'الشرق الاوسط', 'MEU'], active: true },
  { code: 'JADARA', nameAr: 'جامعة جدارا', nameEn: 'Jadara University', category: 'PRIVATE', aliases: ['جدارا'], active: true },
  { code: 'AU', nameAr: 'جامعة عمان الأهلية', nameEn: 'Al-Ahliyya Amman University', category: 'PRIVATE', aliases: ['عمان الأهلية', 'عمان الاهلية', 'الأهلية'], active: true },
  { code: 'ASU', nameAr: 'جامعة العلوم التطبيقية الخاصة', nameEn: 'Applied Science Private University', category: 'PRIVATE', aliases: ['العلوم التطبيقية', 'التطبيقية الخاصة'], active: true },
  { code: 'PU', nameAr: 'جامعة فيلادلفيا', nameEn: 'Philadelphia University', category: 'PRIVATE', aliases: ['فيلادلفيا'], active: true },
  { code: 'ISRA', nameAr: 'جامعة الإسراء', nameEn: 'Al-Isra University', category: 'PRIVATE', aliases: ['الإسراء', 'الاسراء'], active: true },
  { code: 'PETRA', nameAr: 'جامعة البترا', nameEn: 'University of Petra', category: 'PRIVATE', aliases: ['البترا', 'البتراء'], active: true },
  { code: 'ZUJ', nameAr: 'جامعة الزيتونة الأردنية', nameEn: 'Al-Zaytoonah University of Jordan', category: 'PRIVATE', aliases: ['الزيتونة'], active: true },
  { code: 'ZU', nameAr: 'جامعة الزرقاء', nameEn: 'Zarqa University', category: 'PRIVATE', aliases: ['الزرقاء', 'جامعة الزرقاء الخاصة'], active: true },
  { code: 'IPU', nameAr: 'جامعة إربد الأهلية', nameEn: 'Irbid National University', category: 'PRIVATE', aliases: ['إربد الأهلية', 'اربد الاهلية', 'إربد'], active: true },
  { code: 'JERASH', nameAr: 'جامعة جرش', nameEn: 'Jerash University', category: 'PRIVATE', aliases: ['جرش', 'جامعة جرش الأهلية الخاصة'], active: true },
  { code: 'PSUT', nameAr: 'جامعة الأميرة سمية للتكنولوجيا', nameEn: 'Princess Sumaya University for Technology', category: 'PRIVATE', aliases: ['الأميرة سمية', 'الاميرة سمية', 'سمية', 'PSUT'], active: true },
  { code: 'AUM', nameAr: 'الجامعة الأمريكية في مادبا', nameEn: 'American University of Madaba', category: 'PRIVATE', aliases: ['الأمريكية في مادبا', 'مادبا', 'AUM'], active: true },
  { code: 'ANU', nameAr: 'جامعة عجلون الوطنية', nameEn: 'Ajloun National University', category: 'PRIVATE', aliases: ['عجلون'], active: true },
  { code: 'AUT', nameAr: 'جامعة العقبة للتكنولوجيا', nameEn: 'Aqaba University of Technology', category: 'PRIVATE', aliases: ['العقبة للتكنولوجيا'], active: true },
  { code: 'AUMS', nameAr: 'جامعة العقبة للعلوم الطبية', nameEn: 'Aqaba University of Medical Sciences', category: 'PRIVATE', aliases: ['العقبة للعلوم الطبية'], active: true },
  { code: 'IBN_SINA', nameAr: 'جامعة ابن سينا للعلوم الطبية', nameEn: 'Ibn Sina University for Medical Sciences', category: 'PRIVATE', aliases: ['ابن سينا'], active: true },

  // SPECIAL_LAW
  { code: 'WISE', nameAr: 'جامعة العلوم الإسلامية العالمية', nameEn: 'World Islamic Sciences and Education University', category: 'SPECIAL_LAW', aliases: ['العلوم الإسلامية', 'العلوم الاسلامية'], active: true },
  { code: 'HTU', nameAr: 'جامعة الحسين التقنية', nameEn: 'Al-Hussein Technical University', category: 'SPECIAL_LAW', aliases: ['الحسين التقنية', 'HTU'], active: true },

  // REGIONAL
  { code: 'AOU_JO', nameAr: 'الجامعة العربية المفتوحة - الأردن', nameEn: 'Arab Open University - Jordan', category: 'REGIONAL', aliases: ['العربية المفتوحة', 'المفتوحة'], active: true },
];

/** Trusted code → optional eprojecto tenant UUID (configured, never loose string match). */
export const EPROJECTO_UNIVERSITY_ID_BY_CODE = Object.freeze({});

export function getActiveJordanUniversities() {
  return JORDAN_UNIVERSITIES.filter((u) => u.active !== false);
}

export function findJordanUniversity(code) {
  return getActiveJordanUniversities().find((u) => u.code === code) ?? null;
}

export function universitySearchKeywords(uni) {
  return [uni.nameAr, uni.nameEn, uni.code, ...(uni.aliases || [])].filter(Boolean).join(' ');
}
