'use strict';

/**
 * Approved Tafila Excel evaluation baseline for opportunity
 * 4d9466cb-127b-42f2-ac08-88e7fcc7c7df only.
 * Keyed by university student number — never by name.
 */

const PRIMARY_TAFILA_OPPORTUNITY_ID = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const LAITH_UNIVERSITY_NUMBER = '320230601066';

const APPROVED_NOT_ELIGIBLE = Object.freeze([
  '320250602134', // Layan Aljamal
  '320220603075', // محمد محمود محمد حسين
  '320250603244', // ريما عادل طارق محمود
  '320220603007', // حمدالله انور حمدالله عيسى
  '320230601066', // ليث محمد احمد بريوش
]);

/** @type {Record<string, { excelScore: number|null, excelStatus: 'ELIGIBLE'|'NOT_ELIGIBLE', special?: string }>} */
const TAFILA_APPROVED_EXCEL_BASELINE = Object.freeze({
  '320230603015': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320210601046': { excelScore: 83, excelStatus: 'ELIGIBLE' },
  '320220603012': { excelScore: 78, excelStatus: 'ELIGIBLE' },
  '320220605231': { excelScore: 87, excelStatus: 'ELIGIBLE' },
  '320220603206': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320220603142': { excelScore: 79, excelStatus: 'ELIGIBLE' },
  '320220603203': { excelScore: 89, excelStatus: 'ELIGIBLE' },
  '320220605260': { excelScore: 77, excelStatus: 'ELIGIBLE' },
  '320220605041': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220605070': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220605004': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320230602075': { excelScore: 89, excelStatus: 'ELIGIBLE' },
  '320210605021': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320230603005': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320220605227': { excelScore: 89, excelStatus: 'ELIGIBLE' },
  '320220603005': { excelScore: 87, excelStatus: 'ELIGIBLE' },
  '320230605012': { excelScore: 92, excelStatus: 'ELIGIBLE' },
  '320220603026': { excelScore: 76, excelStatus: 'ELIGIBLE' },
  '320230602004': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320230603020': { excelScore: 91, excelStatus: 'ELIGIBLE' },
  '320220605255': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220605020': { excelScore: 92, excelStatus: 'ELIGIBLE' },
  '320230602073': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320220603209': { excelScore: 91, excelStatus: 'ELIGIBLE' },
  '320220605149': { excelScore: 83, excelStatus: 'ELIGIBLE' },
  '320230602067': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320220603017': { excelScore: 68, excelStatus: 'ELIGIBLE' },
  '320220603242': { excelScore: 90, excelStatus: 'ELIGIBLE' },
  '320220603207': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320220603213': { excelScore: 87, excelStatus: 'ELIGIBLE' },
  '320220605206': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320220605085': { excelScore: 88, excelStatus: 'ELIGIBLE' },
  '320230601004': { excelScore: 73, excelStatus: 'ELIGIBLE' },
  '320230602024': { excelScore: 86, excelStatus: 'ELIGIBLE' },
  '320230602065': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220602065': { excelScore: 89, excelStatus: 'ELIGIBLE' },
  '320220603156': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320210603079': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320220605157': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320230602064': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220605218': { excelScore: 84, excelStatus: 'ELIGIBLE' },
  '320230602046': { excelScore: 91, excelStatus: 'ELIGIBLE' },
  '320200601069': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320230602037': { excelScore: 86, excelStatus: 'ELIGIBLE' },
  '320220602027': { excelScore: 86, excelStatus: 'ELIGIBLE' },
  '320220605217': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320220603062': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320230603002': { excelScore: 80, excelStatus: 'ELIGIBLE' },
  '320230603022': { excelScore: 86, excelStatus: 'ELIGIBLE' },
  '320220603102': { excelScore: 88, excelStatus: 'ELIGIBLE' },
  '320220602019': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320230602116': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320220603098': { excelScore: 92, excelStatus: 'ELIGIBLE' },
  '320200602030': { excelScore: 84, excelStatus: 'ELIGIBLE' },
  '320200601081': { excelScore: 84, excelStatus: 'ELIGIBLE' },
  '320230605007': { excelScore: 84, excelStatus: 'ELIGIBLE' },
  '320220603123': { excelScore: 87, excelStatus: 'ELIGIBLE' },
  '320220605165': { excelScore: 91, excelStatus: 'ELIGIBLE' },
  '320230603014': { excelScore: 98, excelStatus: 'ELIGIBLE' },
  '320230601009': { excelScore: 68, excelStatus: 'ELIGIBLE' },
  '320230602027': { excelScore: 84, excelStatus: 'ELIGIBLE' },
  '320220605063': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320220605228': { excelScore: 92, excelStatus: 'ELIGIBLE' },
  '320230601066': { excelScore: null, excelStatus: 'NOT_ELIGIBLE', special: 'SPECIAL_LAITH' },
  '320220602037': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320220603199': { excelScore: 88, excelStatus: 'ELIGIBLE' },
  '320220605131': { excelScore: 80, excelStatus: 'ELIGIBLE' },
  '320220603092': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '120220612060': { excelScore: 87, excelStatus: 'ELIGIBLE' },
  '320240605125': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220605111': { excelScore: 87, excelStatus: 'ELIGIBLE' },
  '320250602134': { excelScore: 0, excelStatus: 'NOT_ELIGIBLE' },
  '320210601146': { excelScore: 76, excelStatus: 'ELIGIBLE' },
  '320230605005': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320200603040': { excelScore: 89, excelStatus: 'ELIGIBLE' },
  '320230602014': { excelScore: 98, excelStatus: 'ELIGIBLE' },
  '320230605038': { excelScore: 87, excelStatus: 'ELIGIBLE' },
  '320230602002': { excelScore: 93, excelStatus: 'ELIGIBLE' },
  '320220603054': { excelScore: 86, excelStatus: 'ELIGIBLE' },
  '320220603015': { excelScore: 98, excelStatus: 'ELIGIBLE' },
  '320230602018': { excelScore: 87, excelStatus: 'ELIGIBLE' },
  '320230602057': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320220603075': { excelScore: 0, excelStatus: 'NOT_ELIGIBLE' },
  '320220603068': { excelScore: 73, excelStatus: 'ELIGIBLE' },
  '320220603217': { excelScore: 86, excelStatus: 'ELIGIBLE' },
  '320230602096': { excelScore: 98, excelStatus: 'ELIGIBLE' },
  '320220601007': { excelScore: 87, excelStatus: 'ELIGIBLE' },
  '320230602113': { excelScore: 98, excelStatus: 'ELIGIBLE' },
  '320230605014': { excelScore: 91, excelStatus: 'ELIGIBLE' },
  '320220603189': { excelScore: 80, excelStatus: 'ELIGIBLE' },
  '320250603244': { excelScore: 0, excelStatus: 'NOT_ELIGIBLE' },
  '320220602035': { excelScore: 84, excelStatus: 'ELIGIBLE' },
  '320210602023': { excelScore: 86, excelStatus: 'ELIGIBLE' },
  '320220605065': { excelScore: 89, excelStatus: 'ELIGIBLE' },
  '320240605129': { excelScore: 93, excelStatus: 'ELIGIBLE' },
  '320230603013': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320220605188': { excelScore: 86, excelStatus: 'ELIGIBLE' },
  '320220603220': { excelScore: 88, excelStatus: 'ELIGIBLE' },
  '320220601004': { excelScore: 89, excelStatus: 'ELIGIBLE' },
  '320220602070': { excelScore: 87, excelStatus: 'ELIGIBLE' },
  '320220603003': { excelScore: 89, excelStatus: 'ELIGIBLE' },
  '320220605090': { excelScore: 70, excelStatus: 'ELIGIBLE' },
  '320220605124': { excelScore: 93, excelStatus: 'ELIGIBLE' },
  '320230605021': { excelScore: 91, excelStatus: 'ELIGIBLE' },
  '320240603002': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320230602062': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220603170': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220603045': { excelScore: 98, excelStatus: 'ELIGIBLE' },
  '320230602066': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320210601043': { excelScore: 74, excelStatus: 'ELIGIBLE' },
  '320220605258': { excelScore: 88, excelStatus: 'ELIGIBLE' },
  '320220603198': { excelScore: 92, excelStatus: 'ELIGIBLE' },
  '320210602057': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320230602003': { excelScore: 86, excelStatus: 'ELIGIBLE' },
  '320220605162': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220605160': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220605182': { excelScore: 93, excelStatus: 'ELIGIBLE' },
  '320220603099': { excelScore: 91, excelStatus: 'ELIGIBLE' },
  '320220603024': { excelScore: 90, excelStatus: 'ELIGIBLE' },
  '320230602147': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220605075': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320230602053': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320230605016': { excelScore: 88, excelStatus: 'ELIGIBLE' },
  '320220603150': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320230602055': { excelScore: 89, excelStatus: 'ELIGIBLE' },
  '320230603008': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320210601097': { excelScore: 84, excelStatus: 'ELIGIBLE' },
  '320220605048': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320230603007': { excelScore: 98, excelStatus: 'ELIGIBLE' },
  '320220602015': { excelScore: 91, excelStatus: 'ELIGIBLE' },
  '320230601021': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320230602006': { excelScore: 98, excelStatus: 'ELIGIBLE' },
  '320240603015': { excelScore: 98, excelStatus: 'ELIGIBLE' },
  '320220603067': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220603007': { excelScore: 0, excelStatus: 'NOT_ELIGIBLE' },
  '320220603105': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320220603232': { excelScore: 96, excelStatus: 'ELIGIBLE' },
  '320220603052': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220605259': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '21220019': { excelScore: 69, excelStatus: 'ELIGIBLE' },
  '320220603066': { excelScore: 89, excelStatus: 'ELIGIBLE' },
  '320220605261': { excelScore: 92, excelStatus: 'ELIGIBLE' },
  '320220602016': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220605251': { excelScore: 98, excelStatus: 'ELIGIBLE' },
  '320220605212': { excelScore: 91, excelStatus: 'ELIGIBLE' },
  '320240603003': { excelScore: 99, excelStatus: 'ELIGIBLE' },
  '320220605060': { excelScore: 97, excelStatus: 'ELIGIBLE' },
  '320210603015': { excelScore: 87, excelStatus: 'ELIGIBLE' },
  '320230601062': { excelScore: 89, excelStatus: 'ELIGIBLE' },
  '320220603233': { excelScore: 92, excelStatus: 'ELIGIBLE' },
  '320210601081': { excelScore: 97, excelStatus: 'ELIGIBLE' },
});

function normalizeUniversityNumber(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '');
}

function getBaselineByUniversityNumber(universityNumber) {
  const key = normalizeUniversityNumber(universityNumber);
  return TAFILA_APPROVED_EXCEL_BASELINE[key] || null;
}

function isPrimaryTafilaOpportunity(opportunityId) {
  return String(opportunityId) === PRIMARY_TAFILA_OPPORTUNITY_ID;
}

function mapExcelStatusToWorkflow(excelStatus) {
  if (excelStatus === 'ELIGIBLE') return 'eligible';
  return 'ineligible';
}

module.exports = {
  PRIMARY_TAFILA_OPPORTUNITY_ID,
  LAITH_UNIVERSITY_NUMBER,
  APPROVED_NOT_ELIGIBLE,
  TAFILA_APPROVED_EXCEL_BASELINE,
  normalizeUniversityNumber,
  getBaselineByUniversityNumber,
  isPrimaryTafilaOpportunity,
  mapExcelStatusToWorkflow,
  baselineCount: Object.keys(TAFILA_APPROVED_EXCEL_BASELINE).length,
};
