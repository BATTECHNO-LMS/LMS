# الواجهة الأمامية ونظام التصميم

## الإطار واستراتيجية العرض

| الخاصية | القيمة | الثقة |
|---------|--------|-------|
| الإطار | React 18 | Confirmed |
| البناء | Vite 5 | Confirmed |
| العرض | SPA بالكامل (CSR) | Confirmed |
| التوجيه | React Router 6 — تعريف صريح في `AppRouter` | Confirmed |
| تقسيم الكود | `React.lazy` عبر `lazyPages.js` + Suspense | Confirmed |
| الحالة البعيدة | TanStack Query 5 | Confirmed — `lib/queryClient.js` |
| الحالة المحلية للجلسة | `AuthContext`, `TenantContext`, `LocaleContext` | Confirmed |
| النماذج | react-hook-form + zod resolvers | Confirmed (اعتماديات + صفحات auth/CRUD) |
| HTTP | Axios `apiClient.js` | Confirmed |
| i18n | i18next — مجلدات `i18n/locales/ar` و`en` | Confirmed |
| الرسوم | recharts (تحليلات) | Confirmed |
| الحركة | framer-motion (لاندنج) | Confirmed |
| أيقونات | lucide-react، react-icons | Confirmed |

## معمارية المكوّنات

```
pages/          → شاشات حسب البوابة
layouts/        → AdminLayout, InstructorLayout, StudentLayout, ReviewerLayout, AuthLayout, BaseDashboardLayout
features/       → خدمات + hooks لكل مجال
components/     → common, navigation, forms, crud, landing, permissions, student, admin, …
```

تقريبًا: **~118** ملف JSX تحت `components/`، **~200** تحت `pages/`.

## التخطيطات والبوابات

| Layout | الاستخدام |
|--------|-----------|
| `AuthLayout` | تسجيل/دخول/OTP |
| `AdminLayout` | `/admin` و`/academic` |
| `InstructorLayout` | `/instructor` |
| `StudentLayout` | `/student` |
| `ReviewerLayout` | `/reviewer` |

التنقل: `adminNavigation.js` + `navigation.js` (`NAV_BY_ROLE`).

## نظام التصميم — مصادر الرموز

| المصدر | الملف | الاستخدام |
|--------|-------|-----------|
| SCSS variables | `assets/styles/abstracts/_variables.scss` | التطبيق التشغيلي (لوحات) |
| SCSS app entry | `assets/styles/app.scss` | تجميع المكوّنات/الصفحات |
| Tailwind | `landing-tailwind.css` + إعداد Tailwind | صفحة الهبوط غالبًا |
| CSS إضافي | `landing-backgrounds.css`, `phone-device.css` | لاندنج/أجهزة |

**لا يُستخدم theme provider لوضع داكن شامل** — عدم وجود dark mode واضح (Strong inference من غياب tokens/dark).

## الرموز المرئية الأساسية (من `_variables.scss`)

| الرمز | القيمة |
|-------|--------|
| Primary navy | `#132d4a` |
| Accent gold | `#c9a227` |
| Background | `#f6f7f5` |
| Cream | `#f7f1e7` |
| Card | `#ffffff` |
| Success/Info/Warning/Danger | greens/blues/ambers/reds محددة |
| Font | `'Tajawal', 'IBM Plex Sans Arabic', 'Inter', system-ui, sans-serif` |
| Radii | sm→xl + pill |
| Shadows | soft/card/3d variants بصبغة navy |
| Sidebar width | `16.5rem` (منهار `4.5rem`) |
| Header height | `4.5rem` |

**الثقة:** Confirmed من الملف.

## RTL / LTR والتوطين

- دعم عربي/إنجليزي عبر i18n و`LocaleContext`.
- عائلة خطوط عربية أولاً تشير إلى توجه RTL قوي — Confirmed للخطوط؛ تبديل الاتجاه يعتمد على منطق locale (انظر `frontend/docs/I18N_AND_LOCALE_AR.md`).

## أنماط UI شائعة

| النمط | أين يظهر |
|-------|----------|
| جداول CRUD + `TableIconActions` | صفحات admin |
| فلاتر admin/analytics | مكوّنات filters + SCSS |
| Status badges | `_status-badges.scss` + `statusMap.js` |
| Modals | `_modals.scss` |
| PermissionGate | إخفاء عناصر |
| Toasts/notifications | صفحة notifications + أنواع في DB |
| Skeletons | مثل `StudentDashboardSkeleton` |
| Landing | مكوّنات `components/landing/*` مع motion |

## جرد مكوّنات (عينة تمثيلية)

| المكوّن | المسار | الغرض |
|---------|--------|-------|
| `ProtectedRoute` | `components/common/ProtectedRoute.jsx` | حارس مصادقة |
| `RoleBasedRoute` | `components/common/RoleBasedRoute.jsx` | حارس دور |
| `PermissionGate` | `components/permissions/PermissionGate.jsx` | إظهار حسب صلاحية UI |
| `TenantSwitcher` | `components/common/TenantSwitcher.jsx` | تبديل نطاق جامعة (UI) |
| `LanguageSwitcher` | `components/common/LanguageSwitcher.jsx` | لغة |
| `ErrorBoundary` | `components/ErrorBoundary.jsx` | أخطاء React |
| `FileUploader` | `components/forms/FileUploader.jsx` | رفع ملفات |
| `AdminPageHeader` | `components/admin/AdminPageHeader.jsx` | ترويسة صفحات إدارة |
| `SidebarSectionTitle` | `components/navigation/SidebarSectionTitle.jsx` | تنقل |
| `AnalyticsKpiCard` | `components/analytics/AnalyticsKpiCard.jsx` | مؤشرات |
| `HeroBackground` | `components/landing/motion/HeroBackground.jsx` | لاندنج |
| `StudentProgramCard` | `components/student/StudentProgramCard.jsx` | بطاقة برنامج طالب |

قائمة كاملة لكل الملفات تتجاوز هذا المستند؛ الجرد العددي في [16_ANALYSIS_COVERAGE.md](./16_ANALYSIS_COVERAGE.md).

## الوصول (Accessibility)

أنماط محدودة مرصودة (`aria-hidden` في بعض الأيقونات). لا مكتبة a11y مخصصة مكتشفة — **Weak inference** أن التغطية جزئية.

## ملاحظات اتساق بصري (رصد فقط)

- ازدواجية Tailwind (لاندنج) وSCSS (لوحات) — مصدران للرموز.
- وجود cream surfaces بجانب navy/gold — هوية أكاديمية مقصودة في المتغيرات.
- صفحات placeholder عبر `ModulePlaceholderPage` لمسارات غير مُنفَّذة داخل البوابة.

**لا تغييرات تصميم في هذه المرحلة.**
