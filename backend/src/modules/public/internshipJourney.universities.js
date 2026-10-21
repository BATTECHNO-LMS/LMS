const OTHER_UNIVERSITY = 'OTHER';

const JORDAN_UNIVERSITIES = [
  { code: 'JU', nameAr: 'الجامعة الأردنية', nameEn: 'University of Jordan', category: 'PUBLIC', aliases: ['الأردنية'], active: true },
  { code: 'YU', nameAr: 'جامعة اليرموك', nameEn: 'Yarmouk University', category: 'PUBLIC', aliases: ['اليرموك'], active: true },
  { code: 'MU', nameAr: 'جامعة مؤتة', nameEn: 'Mutah University', category: 'PUBLIC', aliases: ['مؤتة'], active: true },
  { code: 'JUST', nameAr: 'جامعة العلوم والتكنولوجيا الأردنية', nameEn: 'Jordan University of Science and Technology', category: 'PUBLIC', aliases: ['JUST', 'العلوم والتكنولوجيا'], active: true },
  { code: 'HU', nameAr: 'الجامعة الهاشمية', nameEn: 'Hashemite University', category: 'PUBLIC', aliases: ['الهاشمية'], active: true },
  { code: 'AABU', nameAr: 'جامعة آل البيت', nameEn: 'Al al-Bayt University', category: 'PUBLIC', aliases: ['آل البيت'], active: true },
  { code: 'BAU', nameAr: 'جامعة البلقاء التطبيقية', nameEn: 'Al-Balqa Applied University', category: 'PUBLIC', aliases: ['البلقاء'], active: true },
  { code: 'AHU', nameAr: 'جامعة الحسين بن طلال', nameEn: 'Al-Hussein Bin Talal University', category: 'PUBLIC', aliases: ['الحسين بن طلال'], active: true },
  { code: 'TTU', nameAr: 'جامعة الطفيلة التقنية', nameEn: 'Tafila Technical University', category: 'PUBLIC', aliases: ['الطفيلة'], active: true },
  { code: 'GJU', nameAr: 'الجامعة الألمانية الأردنية', nameEn: 'German Jordanian University', category: 'PUBLIC', aliases: ['الألمانية', 'GJU'], active: true },
  { code: 'AAU', nameAr: 'جامعة عمان العربية', nameEn: 'Amman Arab University', category: 'PRIVATE', aliases: ['عمان العربية'], active: true },
  { code: 'MEU', nameAr: 'جامعة الشرق الأوسط', nameEn: 'Middle East University', category: 'PRIVATE', aliases: ['الشرق الأوسط', 'MEU'], active: true },
  { code: 'JADARA', nameAr: 'جامعة جدارا', nameEn: 'Jadara University', category: 'PRIVATE', aliases: ['جدارا'], active: true },
  { code: 'AU', nameAr: 'جامعة عمان الأهلية', nameEn: 'Al-Ahliyya Amman University', category: 'PRIVATE', aliases: ['عمان الأهلية'], active: true },
  { code: 'ASU', nameAr: 'جامعة العلوم التطبيقية الخاصة', nameEn: 'Applied Science Private University', category: 'PRIVATE', aliases: ['العلوم التطبيقية'], active: true },
  { code: 'PU', nameAr: 'جامعة فيلادلفيا', nameEn: 'Philadelphia University', category: 'PRIVATE', aliases: ['فيلادلفيا'], active: true },
  { code: 'ISRA', nameAr: 'جامعة الإسراء', nameEn: 'Al-Isra University', category: 'PRIVATE', aliases: ['الإسراء'], active: true },
  { code: 'PETRA', nameAr: 'جامعة البترا', nameEn: 'University of Petra', category: 'PRIVATE', aliases: ['البترا'], active: true },
  { code: 'ZUJ', nameAr: 'جامعة الزيتونة الأردنية', nameEn: 'Al-Zaytoonah University of Jordan', category: 'PRIVATE', aliases: ['الزيتونة'], active: true },
  { code: 'ZU', nameAr: 'جامعة الزرقاء', nameEn: 'Zarqa University', category: 'PRIVATE', aliases: ['الزرقاء', 'جامعة الزرقاء الخاصة'], active: true },
  { code: 'IPU', nameAr: 'جامعة إربد الأهلية', nameEn: 'Irbid National University', category: 'PRIVATE', aliases: ['إربد الأهلية'], active: true },
  { code: 'JERASH', nameAr: 'جامعة جرش', nameEn: 'Jerash University', category: 'PRIVATE', aliases: ['جرش', 'جامعة جرش الأهلية الخاصة'], active: true },
  { code: 'PSUT', nameAr: 'جامعة الأميرة سمية للتكنولوجيا', nameEn: 'Princess Sumaya University for Technology', category: 'PRIVATE', aliases: ['الأميرة سمية', 'PSUT'], active: true },
  { code: 'AUM', nameAr: 'الجامعة الأمريكية في مادبا', nameEn: 'American University of Madaba', category: 'PRIVATE', aliases: ['مادبا', 'AUM'], active: true },
  { code: 'ANU', nameAr: 'جامعة عجلون الوطنية', nameEn: 'Ajloun National University', category: 'PRIVATE', aliases: ['عجلون'], active: true },
  { code: 'AUT', nameAr: 'جامعة العقبة للتكنولوجيا', nameEn: 'Aqaba University of Technology', category: 'PRIVATE', aliases: ['العقبة للتكنولوجيا'], active: true },
  { code: 'AUMS', nameAr: 'جامعة العقبة للعلوم الطبية', nameEn: 'Aqaba University of Medical Sciences', category: 'PRIVATE', aliases: ['العقبة للعلوم الطبية'], active: true },
  { code: 'IBN_SINA', nameAr: 'جامعة ابن سينا للعلوم الطبية', nameEn: 'Ibn Sina University for Medical Sciences', category: 'PRIVATE', aliases: ['ابن سينا'], active: true },
  { code: 'WISE', nameAr: 'جامعة العلوم الإسلامية العالمية', nameEn: 'World Islamic Sciences and Education University', category: 'SPECIAL_LAW', aliases: ['العلوم الإسلامية'], active: true },
  { code: 'HTU', nameAr: 'جامعة الحسين التقنية', nameEn: 'Al-Hussein Technical University', category: 'SPECIAL_LAW', aliases: ['الحسين التقنية', 'HTU'], active: true },
  { code: 'AOU_JO', nameAr: 'الجامعة العربية المفتوحة - الأردن', nameEn: 'Arab Open University - Jordan', category: 'REGIONAL', aliases: ['العربية المفتوحة'], active: true },
];

const EPROJECTO_UNIVERSITY_ID_BY_CODE = Object.freeze({});

function getActiveJordanUniversities() {
  return JORDAN_UNIVERSITIES.filter((u) => u.active !== false);
}

function findJordanUniversity(code) {
  return getActiveJordanUniversities().find((u) => u.code === code) || null;
}

function countByCategory() {
  return getActiveJordanUniversities().reduce((acc, u) => {
    acc[u.category] = (acc[u.category] || 0) + 1;
    return acc;
  }, {});
}

module.exports = {
  OTHER_UNIVERSITY,
  JORDAN_UNIVERSITIES,
  EPROJECTO_UNIVERSITY_ID_BY_CODE,
  getActiveJordanUniversities,
  findJordanUniversity,
  countByCategory,
};
