# Mutah Field Training Evaluation — Urgent Template Fidelity Fix

Date: 1 September 2026  
Opportunity: `6c8783ec-49fd-428e-83e2-8b65e52c3b4f`  
University: جامعة مؤتة (`910ba424-10ec-44d2-8f7f-c68e7ea5e8cb`)

## Delivery status

The architecture fix is implemented and automated tests pass. This work is **not marked COMPLETE** because LibreOffice is not installed on this machine, so a real two-page PDF could not be rendered and visually compared. The new code fails closed when that renderer is unavailable; it does not create a generic substitute.

No deployment, commit, push, PR, tag, or production-data fabrication was performed.

## Root cause of the broken three-page report

The exact fallback was in `backend/src/modules/fieldTraining/fieldTrainingEvaluation.pdf.js`:

1. It first attempted LibreOffice DOCX-to-PDF conversion.
2. When LibreOffice was absent or conversion failed, it silently continued.
3. It ran `mammoth.convertToHtml({ buffer: docxBuffer })`.
4. It passed that reconstructed HTML to `backend/src/modules/analytics/pdfRenderer.js`.

`analytics/pdfRenderer.js` enables Chromium headers/footers by default and injects:

- `BATTECHNO LMS · <date>`
- `هذا التقرير للاستخدام الإداري الداخلي`
- `<page> / <totalPages>`

Mammoth preserves document meaning, not Word page geometry. It discarded or reflowed Word-specific layout, embedded header content, table sizing, margins, paragraph spacing, and pagination. Chromium then applied generic A4 margins and the LMS footer. The duplicate comments and reflow pushed the signature area onto page 3.

The uploaded DOCX was therefore used only as an intermediate content source, not as the final visual document. A separate global-template fallback could also select an unrelated active template when no opportunity/university template resolved.

## Why individual fields were wrong

- **University number and dates blank:** the old adapter did not reliably remove and replace Word MERGEFIELD markup, and stored PDFs could be reused merely because a PDF and a minimal identity snapshot existed. There was no post-fill assertion that the number and dates appeared in their intended cells.
- **Training hours became 0:** `summarizeAttendance()` converted an unknown value with `Number(actualHours || 0)`, collapsing missing data to zero. The Mutah row was also mapped to daily hours rather than total completed hours.
- **Company value entered the address row:** organization values lacked explicit application-first mapping and `address` could fall back to the generic opportunity `location`. The new mapper uses separate named fields and removes that fallback.
- **Incomplete criteria and blank total:** generation had no final document-fidelity assertion for exactly ten checks or for the calculated total in the existing `المجموع:` cell.
- **Duplicated comments:** one path filled the empty comments table while another appended the same text beside the comments heading.
- **`Instructor BATUNI` appeared twice:** `field_supervisor_name` was explicitly sourced from the logged-in/assigned instructor, while `اسم المسؤول` came from a generic organization contact instead of the per-student Excel text field. Both could resolve to the same LMS identity.
- **Wrong semester:** the generic mapper could use the wrong period context in a legacy artifact. The canonical mapper now derives this opportunity from its authoritative July start date as `الصيفي` and `2025-2026`; it is not globally hardcoded.

## Restored official pipeline

The official path is now:

1. Resolve the opportunity-specific template; otherwise the same university's default; otherwise fail.
2. Load the exact stored DOCX file.
3. Clone the template buffer and payload for the individual student.
4. Build all values through `buildFieldTrainingEvaluationTemplatePayload()`.
5. Fill existing Word cells/tables and remove merge-field control markup without rebuilding layout.
6. Compare source and filled DOCX fingerprints:
   - table and page geometry unchanged
   - embedded media unchanged
   - styles, settings, font table, theme, headers, and footers unchanged
   - every dynamic value located in its expected labeled cell
   - exactly ten checkmarks
   - total present
   - comments present exactly once
   - no unauthorized LMS branding
7. Convert the filled DOCX with LibreOffice only, using an isolated temporary directory and LibreOffice profile.
8. Parse the PDF; require exactly two pages and reject generic branding.
9. Persist DOCX/PDF hashes, template id/version, source template file id/hash, page count, and fidelity evidence.
10. Publish the new evaluation version only after artifact storage succeeds.
11. Preview and download the same stored, hash-verified PDF. Preview no longer renders a second temporary report.

Failures return `FIELD_TRAINING_TEMPLATE_RENDER_FAILED` or `TEMPLATE_FIDELITY_FAIL` with:

> تعذر إنشاء التقرير من قالب الجامعة الرسمي. لم يتم إنشاء تقرير بديل.

## Exact live template checked

- Assigned template id: `7f723b9e-8ad1-497d-b230-439a99913001`
- Assigned version: `5`
- Source template file id: `5e7c76f5-04d1-4353-b1ad-4fcc7ac2a5d5`
- Source SHA-256: `fc21125e7b99bf29391437c009f382d738212b3fa2edbcbdeeda767fc95d7f0b`
- Embedded media files: `4`
- Recognized as official Mutah form: `PASS`
- Evaluation grid/comments/supervisor fields: `PASS`
- Expected page count: `2`
- Fonts detected and available on this Windows runtime:
  - Simplified Arabic
  - Andalus
  - Calibri
  - Symbol
  - Times New Roman
  - SimSun

The code reports the exact font name and blocks generation if any required font is unavailable on the conversion server.

## Canonical mapping

- `university_student_number` → الرقم
- canonical `full_name` → اسم الطالب
- actual university specialty → التخصص
- opportunity/application period → الفصل، السنة، تاريخا البداية والنهاية
- unique attended sessions → عدد أيام التدريب
- `completed_training_hours` or authoritative derived completed hours → Mutah training-hours row
- loaded attendance records → absence days; missing attendance stays `null`
- application organization → opportunity defaults → template configuration
- ten integer scores (1–5) → one checkmark in each original row
- sum of ten scores → original `المجموع:` cell
- one deterministic eligibility comment → original comments box
- application/opportunity field supervisor → اسم المشرف الميداني
- `academic_supervisor_name` Excel text → اسم المسؤول
- finalized evaluation date → both existing date cells

## Live readiness snapshot

- Approved students: **104**
- Ready: **5**
- Missing required report data: **99**
- Eligible: **88**
- Not eligible: **16**
- Current fidelity-verified PDFs: **0**
- Legacy/outdated PDFs requiring regeneration: **58**

Ready students:

- محمود محمد حربي الرازم — `120232221003`
- قصي صرايره — `120232231035`
- المهند احمد عبدالله الصعوب — `120222212023`
- رزان عمر علي قنديل — `120222211068`
- أحمد عودةالله سالم الرماضين — `120232221002`

Grouped blockers:

- 97 students: six missing professional ratings (thinking, problem-solving, teamwork, appearance, field-supervisor cooperation, institution rules).
- 98 students: professional total unavailable because at least one required criterion is missing.
- 6 students: academic supervisor text missing.
- 1 student: university number missing.
- 1 student: attendance/training-day/hour/absence data missing.
- 1 student: attendance criterion missing.

Opportunity company defaults are now present: شركة الرجل الوطواط للتكنولوجيا, قسم تكنولوجيا المعلومات, `it@battechno.com`, `0798040280`, the Amman address, and field supervisor عاصم القيسي. Fax is blank and optional.

## Verification performed

- Prisma schema validation: **PASS**
- Backend full suite: **900 passed, 0 failed, 2 skipped**
- Focused Mutah suites after stored-preview fix: **42 passed, 0 failed, 1 skipped**
- Frontend unit suite: **113 passed, 0 failed**
- Frontend production build: **PASS**
- IDE lint diagnostics: **PASS**
- DOCX geometry/media/static-part fingerprint checks: **PASS**
- Omar regression (`120232222080`): **PASS at DOCX/mapping level**
- Actual DOCX-to-PDF conversion: **BLOCKED — LibreOffice not installed**
- Manual two-page visual comparison: **BLOCKED**

## Final acceptance checklist

- Official uploaded DOCX reused: **PASS**
- Generic HTML report disabled for uploaded template: **PASS**
- Fail closed with no generic substitute: **PASS**
- Exact template id/version/source file recorded: **PASS**
- Mutah logo: **PASS at embedded-media level / VISUAL BLOCKED**
- Official fonts: **PASS preflight / rendered output BLOCKED**
- Two pages: **guard implemented / actual output BLOCKED**
- No BATTECHNO footer: **PASS automated guard / visual BLOCKED**
- Student name: **PASS**
- University number: **PASS; missing value blocks one real student**
- Specialty: **PASS**
- Semester: **PASS**
- Academic year: **PASS**
- Training start/end: **PASS**
- Training days: **PASS; unknown stays null**
- Training hours: **PASS; Mutah uses total completed hours**
- Absence: **PASS; unknown stays null**
- Organization name/department/email/phone/address: **PASS**
- Ten criteria/checkmarks: **PASS; missing values block generation**
- Total /50: **PASS**
- Single comments section: **PASS**
- Eligible and not-eligible reasons: **PASS**
- Field supervisor mapping: **PASS**
- Academic supervisor → اسم المسؤول: **PASS**
- Bottom dates: **PASS at DOCX level / visual BLOCKED**
- Signature preserved: **PASS at DOCX media level / visual BLOCKED**
- Stamp preserved: **PASS at DOCX media level / visual BLOCKED**
- Reviewer preview equals downloaded stored artifact: **PASS**
- No third page: **guard implemented / actual output BLOCKED**
- Visual comparison: **BLOCKED**

Required before final delivery:

1. Install LibreOffice on the report server and expose `soffice` through `LIBREOFFICE_PATH` or its standard installation path.
2. Apply migration `20260901143000_field_training_evaluation_template_source_fidelity` during the normal deployment process.
3. Complete the real missing data below.
4. Generate/regenerate the five ready reports and the 58 legacy artifacts after data completion.
5. Open both pages of an eligible and a not-eligible PDF and visually compare them against the uploaded DOCX. Do not release if any geometry, asset, font, or page-count mismatch appears.

## MUTAH DATA STILL MISSING BEFORE DELIVERY

For compactness, “professional ratings + total” means these exact missing fields: التفكير وطرح الأسئلة، حل المشكلات، العلاقات مع الزملاء، المظهر واللياقة، التعاون مع المشرف الميداني، الالتزام بقواعد المؤسسة، and the calculated total.

| Student Name | University Number | Missing Field | Existing Source Checked | Action Needed |
| --- | --- | --- | --- | --- |
| أبرار خلف موسى الطراونة | 120232222140 | Professional ratings + total | Profile; attendance/hours; opportunity/company; academic supervisor; professional evaluation | Enter the six missing ratings (1–5); total is calculated automatically |
| ابرار عواد علي الحباشنه | 120252222116 | Training days; completed hours; absence data; academic supervisor; attendance criterion; total | Profile; attendance/hours; opportunity/company; academic supervisor; professional evaluation | Load/correct attendance and hours; assign academic supervisor; complete attendance criterion |
| إبراهيم محمد عطالله الصرايرة | 120212222129 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| احمد كمال حمد الشواوره | 120222212092 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| أحمد هاني محمد الحروب | 120222211069 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| أسيل محمد كمال القرالة | 420222231515 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| البيلسان مصلح فلاح الضمور | 120222231108 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| الزهراء بسام عبدالرحمن البستنجي | 120232231083 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| أميمة ابراهيم علي القطاونه | 120212212134 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| ايات علي نايف الحسين | 120222231033 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| أيمن مناضل عيد ارقيق | 120232211057 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| بروج مشهور قبلان الليمون | 120232211067 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| بشرى علي سالم الرواشدة | 120232221095 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| بيسان محمد عزت ابوزهره | 120232231043 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| تائب رامي محمد الجعافرة | 120232221108 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| تبارك طالب عبدالمهدي الفرايه | 120232222055 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| جواد جعفر إبراهيم العثامين | 420232222509 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| جود فواز علي الفرجات | 120232221100 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| حمزه احمد ابراهيم الرعود | 120232211039 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| خالد مرتضى عبد النبي الضلاعين | 120222212075 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| خليل ابراهيم محمد الجمره | 120222212017 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| دينه ايمن نمر البستنجي | 120232211004 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| راشد خالد منير يونس عدوان | 120222211087 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| راشد محمود ابراهيم المبيضين | 120222231116 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| راما بكر عبد الجليل الجلامده | 120232231045 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| رزان حسن عبدالله الرواشده | 120222222045 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| رشا علي حماد الطراونه | 120242211064 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| رند عماد احمود القضاة | 120232222136 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| روعه مشعل سلامه الهقيش | 120232231072 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| زمزم راكان فلاح الشمايله | 120232222071 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| زيد احمد الشيب | 120212212023 | Academic supervisor; professional ratings + total | Same canonical sources | Assign Excel academic-supervisor text; enter six missing ratings |
| زيد مصطفى محمد العقاربه | 120222231149 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| زين سامي خليل ابو فرده | 120222222063 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| سامي طارق حسين ابو صافي | 120232221038 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| سدين عبدالله سليمان العمرو | 120232231073 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| سلمى هيثم عوده الليمون | 120232222149 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| سمية محمد اسماعيل القضاة | 120232222142 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| شهد طارق محمود طالب | 120222231151 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| صهيب نايف محمد الجلامده | 120212212054 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| ضحى محمد عبد الفتاح العساسفة | 120232221019 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| ضياء راقي محمد الجبور | 120232222134 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| طارق المجالي | 120232222122 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| عبدالرحمن باسل محمد جيعان | 120232221079 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| عبدالرحمن حسين صالخ غرام | 120222231132 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| عبدالرحمن مراد محمدخير نغوي | 120222211033 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| عبدالله باسم سالم القراله | 120212212132 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| عبدالله حسين فرحان الصرايره | 120232222111 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| عبدالله نادر سالم ابو حرب | 120222211047 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| عثمان إيهاب عاطف المدادحه | 120232231080 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| عمر محمد ثلجي المواجده | 120232222080 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| عهد محمد عبدالقادر الرواشدة | 120232231055 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| غادة محمد مطلق المعايطة | 120232231012 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| فرح محمد يوسف الصرايرة | 120232231071 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| كرم جميل فرهود ابو قديري | 120232222137 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| لينه زياد محمود الصرايرة | 120212212137 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| ماهر بسام منصور الطهراوي | 120212231081 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| محمد خلدون محمد الطراونة | 120232222052 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| محمد خير اشماعيل موسى ابو النجا | 120212211041 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| محمد رياض راشد المعايعه | 120222211099 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| محمد طاهر جازي المعايطه | 120232211034 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| محمد فتحي احمود الملاحمه | 120222222073 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| محمد محسن يوسف الكفاوين | 120222211082 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| محمود بيوسف اخمد عبدالرحمن | 120232222014 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| مذهله عزام سمور الصقور | 120232222090 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| مرام الفقراء | 120232222050 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| مرام بشير ارحيل الحبيب | 120232221011 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| مصطفى ايمن صبحي عوده | 120232211031 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| مصطفى حيدر البطوش | 120232221064 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| ملاك محمد عبدالسلام الصرايره | 120232222064 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| منتهى الايمان مروان محمد عطية | 120222231150 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| نذير مبارك سلامه الجنادبه | 120232211035 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| نغم عاطف محمد الكفاوين | 120232222035 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| نورالدين خالد سميح البيايضه | 120232222144 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| هبه منير مفلح القراله | 120222222054 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| هديل عايد علي الشوره | 120212231086 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| وديع عصام ناصر المصطفى | 120222231029 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| وفاء رمضان خلف الجعافرة | 120232211066 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| ولاء عبد الكريم سلمان ابو غليون | 120232231040 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| يحيى يوسف محمد الربايعه | 120232222061 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| يزن مرزوق طه الضلاعين | 120232222085 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| يزن وليد عادل عوجان | 120222211005 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| يزيد محمد عبدالوهاب القطاونه | 420222222502 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| ينال محمد ياسين مامكغ | 120232222041 | Academic supervisor; professional ratings + total | Same canonical sources | Assign Excel academic-supervisor text; enter six missing ratings |
| يوسف جهاد مسلم الرواحنه | 120222231083 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| يوسف قاسم يوسف الضمور | 120212212102 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| يوسف محمد الضمور | 120232222007 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| Ayah Gasem Anwar Alblewi | 120222222002 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| BATUNI Student | — | University number; academic supervisor; professional ratings + total | Same canonical sources | Set a real university number or remove the test account; assign supervisor; enter ratings |
| Ethar Ali Adnan Almajali | 120232221117 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| Layan Maher Maaitah | 120222231034 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| Malak ksasbeh | 120252222134 | Academic supervisor; professional ratings + total | Same canonical sources | Assign Excel academic-supervisor text; enter six missing ratings |
| Maryam Sar | 120232222099 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| Nipras Majali | 120212231083 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| Noor Talal Ziad ALNawaiseh | 120252222154 | Academic supervisor | Same canonical sources | Assign `academic_supervisor_name` through the Excel assignment flow |
| Noor Zuhier Irsheid Altarawneh | 120222231001 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| Omar Madadha | 120222231170 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| Rahaf khaled h abuqadoum | 120212221042 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| rosl ayman salem alharamieh | 120232231059 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
| sham mohannad mohammad aladaileh | 120232221068 | Professional ratings + total | Same canonical sources | Enter the six missing ratings (1–5) |
