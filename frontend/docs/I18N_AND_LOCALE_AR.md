# توثيق نظام اللغات والواجهة (BATTECHNO-LMS)

هذا الملف يلخّص **ما تم تنفيذه** في واجهة المشروع، **أين توجد الملفات**، و**أين وصلنا** في مسار دعم العربية والإنجليزية بالكامل.

للرؤية الشاملة للمشروع **من التأسيس حتى اليوم** (توجيه، أدوار، وحدات، ثم i18n): راجع **[`PROJECT_JOURNEY_AR.md`](./PROJECT_JOURNEY_AR.md)**.

---

## 1. الهدف العام

- دعم لغتين: **العربية (ar)** و**الإنجليزية (en)**.
- **العربية هي الافتراضية** عند أول زيارة.
- حفظ اختيار المستخدم في **localStorage** واستعادته بعد التحديث.
- **RTL** للعربية و**LTR** للإنجليزية على مستوى المستند (`html` / `body`).
- عدم ترجمة الواجهة عبر نصوص مكررة داخل المكوّنات قدر الإمكان؛ الاعتماد على **مفاتيح ترجمة** عبر **react-i18next**.

---

## 2. التقنية المستخدمة

| المكوّن | الدور |
|--------|--------|
| **i18next** | محرك الترجمة، تحميل الموارد، اللغة الافتراضية والاحتياطية |
| **react-i18next** | ربط React بـ `useTranslation()` وتحديث الواجهة عند تغيير اللغة |
| **SCSS** | أنماط حسّاسة للاتجاه (مثل `body[dir="rtl"]`) |

---

## 3. هيكل المجلدات (أين الملفات؟)

```
frontend/src/i18n/
  index.js              # استيراد config كأثر جانبي + إعادة تصدير
  config.js             # تهيئة i18n، الموارد، ربط التخزين واتجاه الصفحة
  locales/
    ar/                 # نصوص عربية (JSON لكل نطاق namespace)
    en/                 # نصوص إنجليزية (نفس أسماء الملفات)
```

**أمثلة على namespaces (ملفات JSON):**

- `common` — تسميات عامة (أزرار، علامة تجارية، ثيم، لغة، جداول…)
- `navigation` — القائمة الجانبية للإدارة، عناصر المدرب/الطالب/المراجع…
- `auth`, `dashboard`, `users`, `assessments`, `cohorts`, `universities`, …
- `validation`, `emptyStates`, `settings`, `tracks`, `microCredentials`, `recognition`

**ملفات مساعدة:**

- `frontend/src/utils/locale.js` — تخزين اللغة، تطبيع `ar`/`en`، `applyDocumentLocale` (على `html` و`body`)
- `frontend/src/utils/storage.js` — مفتاح التخزين للغة
- `frontend/src/utils/format.js` — تنسيق التاريخ والأرقام حسب **اللغة النشطة** في i18n

---

## 4. نقطة الدخول والتهيئة

1. **`frontend/src/main.jsx`**  
   يستورد **`./i18n/index.js`** قبل باقي التطبيق حتى تكون الترجمة واتجاه الصفحة جاهزين من أول عرض.

2. **`frontend/src/i18n/config.js`**  
   - يجمّد الموارد من ملفات JSON (استيراد مباشر مع Vite).  
   - `fallbackLng: 'ar'`  
   - `defaultNS: 'common'`  
   - عند **`languageChanged`**: حفظ في التخزين + **`applyDocumentLocale`**.

3. **`frontend/src/features/locale/context/LocaleContext.jsx`**  
   - يزامن حالة `locale` مع **`i18n.changeLanguage`**.  
   - **`setLocale`** يستدعي تغيير اللغة في i18next (مصدر حقيقة واحد).

---

## 5. RTL / LTR (كيف يعمل؟)

- عند تغيير اللغة، يُستدعى **`applyDocumentLocale`** من `utils/locale.js`:
  - يضبط **`document.documentElement.lang` و `dir`**
  - ويضبط **`document.body`** بنفس `lang` و`dir`
- أنماط إضافية في:
  - `src/assets/styles/base/_globals.scss` — `body[dir='rtl']` / `body[dir='ltr']`
  - `src/assets/styles/layouts/_header.scss` — مثلاً `.app-header__lang-select` لمبدل اللغة

---

## 6. مبدّل اللغة في الهيدر

- **المكوّن:** `frontend/src/components/common/LanguageSwitcher.jsx`
- قائمة `<select>`: **العربية** / **English**
- يستدعي **`i18n.changeLanguage`**؛ التسميات من namespace **`common`** (مفاتيح مثل `language.arabic`, `language.choose`).
- مُدمَج في **`AppNavbar`** (`frontend/src/components/common/AppNavbar.jsx`).

---

## 7. التنقل والعناوين (Sidebar + عنوان الصفحة)

### الإدارة (`adminNavigation.js`)

- المجموعات والعناصر أصبحت تعتمد **مفاتيح** مثل:
  - `titleKey`: `admin.groups.general`
  - `labelKey` لكل رابط: `admin.items.dashboard`, `admin.items.users`, …
- الدالة **`getAdminNavGroupsForRole(role, t)`** تأخذ **`t` من `useTranslation('navigation')`** وتحوّل المفاتيح إلى نصوص معروضة.

### باقي الأدوار (`navigation.js`)

- عناصر المدرب / الطالب / المراجع تستخدم **`labelKey`** + بادئة دور (`instructor.*`, `student.*`, `reviewer.*`).
- **`getDashboardNavGroups(role, tNav)`** و **`getNavItemsForRole(role, tNav)`** يحتاجان دالة **`t` لنطاق `navigation`**.

### عنوان الصفحة وصلاحية المسار

- **`getPageTitleForPath(role, pathname)`** يستخدم **`i18n.getFixedT`** لقراءة عناوين CRUD من namespaces المناسبة (`users`, `universities`, …) عند مسارات مثل `/admin/users/create`.
- **`canAccessPath`** للإدارة يعتمد **`flattenAdminNavPaths(role)`** (مسارات فقط، بلا ترجمة) من `adminNavigation.js`.

### التخطيط

- **`BaseDashboardLayout.jsx`**:  
  - `useTranslation('navigation')` للقائمة  
  - `useTranslation('common')` للعلامة `brand`  
  - يعيد حساب المجموعات وعنوان الصفحة عند تغيير **`i18n.language`**.

---

## 8. مكوّنات الغلاف المحدّثة (أمثلة)

| الملف | ملاحظة |
|------|--------|
| `AppNavbar.jsx` | ثيم، شعار، مبدل لغة، بدون نصوص عربية/إنجليزية مضمنة للواجهة |
| `AppFooter.jsx` | `brand` و `rights` من `common` |
| `AdminSidebar.jsx` | `aria-label` و`alt` من `common` |
| `UserDropdown.jsx` | `user.fallbackName`, `user.logout` |
| `NotificationBell.jsx` | `notifications` |
| `ModulePlaceholderPage.jsx` | `emptyStates.modulePlaceholder.*` |

---

## 9. أين وصلنا؟ (حالة العمل)

### مكتمل بشكل جيد

- تهيئة **i18next + react-i18next** مع **العربية افتراضياً** والتخزين.
- ربط **اتجاه الصفحة** مع اللغة.
- **مبدل لغة** عالمي في الهيدر.
- **قائمة جانبية وعناوين صفحات** للإدارة وباقي الأدوار عبر **مفاتيح `navigation`** حيث طُبّق التحديث.
- **غلاف التطبيق** (هيدر، فوتر، قائمة، صفحة placeholder) يعتمد مفاتيح الترجمة.
- **`utils/format.js`** جاهز للاستخدام مع اللغة النشطة.
- **إضافة مفاتيح** لـ `universities` و`cohorts` (create/edit/view) حيث لزم لعناوين CRUD.
- **`emptyStates.modulePlaceholder`** للصفحات المؤقتة.

### ما يزال قيد الإكمال (للمستقبل القريب)

- **صفحات الميزات** (قوائم، نماذج، جداول، لوحات…) قد لا تزال تستخدم **`useTr`** أو **`tr(ar, en)`** أو نصوصاً ثابتة في بعض الأماكن — الهدف هو استبدالها تدريجياً بـ **`useTranslation('namespace')`** و**مفاتيح** فقط.
- **`utils/i18n.js`** ما زال يحتوي **`translateText` / `AR_TO_EN`** و**ترجمة DOM**؛ يمكن تقليل الاعتماد عليها أو إزالتها بعد اكتمال ترجمة كل المكوّنات.
- **أيقونات اتجاهية (سهام)** — قلبها في RTL إن لزم يمكن إضافته لاحقاً عبر كلاسات أو `transform` حسب التصميم.

---

## 10. كيف تضيف ترجمة جديدة؟

1. أضف المفتاح في **`ar/<namespace>.json`** و **`en/<namespace>.json`** بنفس البنية.
2. إذا كان namespace جديداً، سجّله في **`src/i18n/config.js`** ضمن **`I18N_NAMESPACES`** وفي كائن **`resources`**.
3. في المكوّن:

```jsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation('users');
return <h1>{t('title')}</h1>;
```

---

## 11. سيناريوهات اختبار سريعة

- أول تحميل: واجهة **عربية** واتجاه **RTL**.
- تغيير اللغة إلى الإنجليزية: نصوص إنجليزية و**LTR** فوراً.
- تحديث الصفحة: اللغة **المحفوظة** تُستعاد.
- التنقل بين أقسام الإدارة: عناصر القائمة تتبع اللغة دون خلط.

---

## 12. ملخص مسار الملفات المهمّة

| المسار | الغرض |
|--------|--------|
| `src/main.jsx` | استيراد i18n |
| `src/i18n/config.js` | تهيئة كاملة |
| `src/constants/adminNavigation.js` | مفاتيح قائمة الإدارة |
| `src/constants/navigation.js` | دمج الأدوار، العناوين، الصلاحيات |
| `src/layouts/BaseDashboardLayout.jsx` | تخطيط لوحة التحكم + ترجمة |
| `src/components/common/LanguageSwitcher.jsx` | تبديل اللغة |
| `src/utils/locale.js` | تخزين + DOM |
| `src/utils/format.js` | تاريخ وأرقام حسب اللغة |

---

*آخر تحديث للوثيقة: يعكس حالة المستودع بعد تنفيذ طبقة i18n الموصوفة أعلاه.*
