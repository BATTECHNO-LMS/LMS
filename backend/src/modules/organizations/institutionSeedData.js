'use strict';

/** Stable public institution seed definitions (idempotent upsert by code). */

const CROWN_PRINCE_FOUNDATION = Object.freeze({
  code: 'CROWN_PRINCE_FOUNDATION',
  name: 'مؤسسة ولي العهد',
  nameEn: 'Crown Prince Foundation',
  shortName: 'CPF',
  institutionKind: 'organization',
  branches: Object.freeze([
    { code: 'CPF_AMMAN', name: 'مكتب مؤسسة ولي العهد – محافظة العاصمة', city: 'العاصمة', address: 'عمان، دابوق – شارع محمد السعد البطاينة' },
    { code: 'CPF_IRBID', name: 'مكتب مؤسسة ولي العهد – محافظة إربد', city: 'إربد', address: 'شارع فراس العجلوني بالقرب من دوار القبة' },
    { code: 'CPF_ZARQA', name: 'مكتب مؤسسة ولي العهد – محافظة الزرقاء', city: 'الزرقاء', address: 'شارع الأميرة سلمى – مركز الأميرة سلمى للطفولة' },
    { code: 'CPF_BALQA', name: 'مكتب مؤسسة ولي العهد – محافظة البلقاء', city: 'البلقاء', address: 'طريق السلط – جسر الدبابنة – عمارة بنك الاتحاد' },
    { code: 'CPF_MADABA', name: 'مكتب مؤسسة ولي العهد – محافظة مادبا', city: 'مادبا', address: 'شارع مادبا الغربي – مديرية عمل محافظة مادبا' },
    { code: 'CPF_MAFRAQ', name: 'مكتب مؤسسة ولي العهد – محافظة المفرق', city: 'المفرق', address: 'شارع الكرامة – بجانب جمعية الكاريتاس' },
    { code: 'CPF_JERASH', name: 'مكتب مؤسسة ولي العهد – محافظة جرش', city: 'جرش', address: 'شارع الملك عبدالله الثاني – مقابل شركة أورنج' },
    { code: 'CPF_AJLOUN', name: 'مكتب مؤسسة ولي العهد – محافظة عجلون', city: 'عجلون', address: 'شارع الحسام – المركز الثقافي – بجانب مبنى محافظة عجلون' },
    { code: 'CPF_KARAK', name: 'مكتب مؤسسة ولي العهد – محافظة الكرك', city: 'الكرك', address: 'إشارة كلية الكرك – بجانب مديرية عمل الكرك – الطابق الثاني' },
    { code: 'CPF_TAFILAH', name: 'مكتب مؤسسة ولي العهد – محافظة الطفيلة', city: 'الطفيلة', address: 'طريق الطفيلة – بلدية الطفيلة الجديدة – الطابق الرابع' },
    { code: 'CPF_MAAN', name: 'مكتب مؤسسة ولي العهد – محافظة معان', city: 'معان', address: 'طريق المدورة – مركز الحسين بن عبدالله الثاني الثقافي' },
    { code: 'CPF_AQABA', name: 'مكتب مؤسسة ولي العهد – محافظة العقبة', city: 'العقبة', address: 'مجمع صندوق ادخار الملكية الأردنية – الطابق الثاني' },
  ]),
});

const MINISTRY_OF_YOUTH = Object.freeze({
  code: 'MINISTRY_OF_YOUTH',
  name: 'وزارة الشباب',
  nameEn: 'Ministry of Youth',
  shortName: 'MOY',
  institutionKind: 'government',
  branches: Object.freeze([
    { code: 'MOY_CAPITAL', name: 'مديرية شباب محافظة العاصمة', city: 'العاصمة' },
    { code: 'MOY_BALQA', name: 'مديرية شباب محافظة البلقاء', city: 'البلقاء' },
    { code: 'MOY_MADABA', name: 'مديرية شباب محافظة مادبا', city: 'مادبا' },
    { code: 'MOY_ZARQA', name: 'مديرية شباب محافظة الزرقاء', city: 'الزرقاء' },
    { code: 'MOY_IRBID', name: 'مديرية شباب محافظة إربد', city: 'إربد' },
    { code: 'MOY_MAFRAQ', name: 'مديرية شباب محافظة المفرق', city: 'المفرق' },
    { code: 'MOY_JERASH', name: 'مديرية شباب محافظة جرش', city: 'جرش' },
    { code: 'MOY_AJLOUN', name: 'مديرية شباب محافظة عجلون', city: 'عجلون' },
    { code: 'MOY_KARAK', name: 'مديرية شباب محافظة الكرك', city: 'الكرك' },
    { code: 'MOY_TAFILAH', name: 'مديرية شباب محافظة الطفيلة', city: 'الطفيلة' },
    { code: 'MOY_PETRA', name: 'مديرية شباب إقليم البتراء', city: 'البتراء' },
    { code: 'MOY_MAAN', name: 'مديرية شباب محافظة معان', city: 'معان' },
    { code: 'MOY_AQABA', name: 'مديرية شباب محافظة العقبة', city: 'العقبة' },
  ]),
});

const PUBLIC_INSTITUTION_SEEDS = Object.freeze([CROWN_PRINCE_FOUNDATION, MINISTRY_OF_YOUTH]);

module.exports = {
  CROWN_PRINCE_FOUNDATION,
  MINISTRY_OF_YOUTH,
  PUBLIC_INSTITUTION_SEEDS,
};
