import { useEffect, useMemo, useState } from 'react';
import {
  FACULTY_OPTIONS,
  HOURS_OPTIONS,
  OTHER_FACULTY,
  OTHER_UNIVERSITY,
  emitInternshipJourneyEvent,
  getActiveMajors,
  validateAcademicProfile,
} from '../../features/internshipJourney/index.js';
import {
  fetchInternshipJourneyUniversities,
  validateInternshipAcademicProfile,
} from '../../features/internshipJourney/internshipJourney.api.js';
import { SearchableSelect } from './SearchableSelect.jsx';

export function JourneyConfigurator({ onBuild }) {
  const [universities, setUniversities] = useState([]);
  const [uniSource, setUniSource] = useState('loading');
  const [universityValue, setUniversityValue] = useState('');
  const [otherUniversityName, setOtherUniversityName] = useState('');
  const [facultyCode, setFacultyCode] = useState('');
  const [otherFacultyName, setOtherFacultyName] = useState('');
  const [majorCode, setMajorCode] = useState('');
  const [trainingHours, setTrainingHours] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverHint, setServerHint] = useState('');

  useEffect(() => {
    let cancelled = false;
    emitInternshipJourneyEvent('journey_viewed');
    fetchInternshipJourneyUniversities().then((result) => {
      if (cancelled) return;
      setUniversities(result.universities);
      setUniSource(result.source);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const universityOptions = useMemo(() => {
    const list = universities.map((u) => ({
      value: u.id || u.name,
      label: u.name,
      keywords: [u.name_en, u.short_name, u.code].filter(Boolean).join(' '),
      universityId: u.id,
      universityName: u.name,
    }));
    list.push({
      value: OTHER_UNIVERSITY,
      label: 'جامعة أخرى',
      keywords: 'other جامعة اخرى',
      universityId: null,
      universityName: '',
    });
    return list;
  }, [universities]);

  const facultyOptions = useMemo(
    () =>
      FACULTY_OPTIONS.map((f) => ({
        value: f.code,
        label: f.labelAr,
        keywords: f.labelAr,
      })),
    []
  );

  const majorOptions = useMemo(
    () =>
      getActiveMajors().map((m) => ({
        value: m.value,
        label: m.label,
        keywords: `${m.label} ${m.labelEn} ${m.value}`,
      })),
    []
  );

  const hoursOptions = useMemo(
    () =>
      HOURS_OPTIONS.map((h) => ({
        value: String(h),
        label: `${h} ساعة`,
        keywords: String(h),
      })),
    []
  );

  const facultyEnabled = Boolean(universityValue);
  const majorEnabled = Boolean(facultyEnabled && facultyCode && (facultyCode !== OTHER_FACULTY || otherFacultyName.trim()));
  const hoursEnabled = Boolean(majorEnabled && majorCode);

  function resetFromUniversity() {
    setFacultyCode('');
    setOtherFacultyName('');
    setMajorCode('');
    setTrainingHours('');
    setErrors({});
    setServerHint('');
  }

  function resetFromFaculty() {
    setMajorCode('');
    setTrainingHours('');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.major;
      delete next.hours;
      return next;
    });
  }

  function handleUniversityChange(value, option) {
    setUniversityValue(value);
    if (value !== OTHER_UNIVERSITY) setOtherUniversityName('');
    resetFromUniversity();
    emitInternshipJourneyEvent('university_selected', {
      source: uniSource,
      hasId: Boolean(option?.universityId),
      isOther: value === OTHER_UNIVERSITY,
    });
  }

  function handleFacultyChange(value) {
    setFacultyCode(value);
    if (value !== OTHER_FACULTY) setOtherFacultyName('');
    resetFromFaculty();
    emitInternshipJourneyEvent('faculty_selected', { facultyCode: value === OTHER_FACULTY ? 'other' : value });
  }

  function handleMajorChange(value) {
    setMajorCode(value);
    setTrainingHours('');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.major;
      delete next.hours;
      return next;
    });
    emitInternshipJourneyEvent('major_selected', { majorCode: value });
  }

  function handleHoursChange(value) {
    setTrainingHours(value);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.hours;
      return next;
    });
    emitInternshipJourneyEvent('hours_selected', { hours: Number(value) });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const selectedUni = universityOptions.find((o) => o.value === universityValue);
    const selectedFaculty = FACULTY_OPTIONS.find((f) => f.code === facultyCode);
    const facultyName =
      facultyCode === OTHER_FACULTY ? otherFacultyName.trim() : selectedFaculty?.labelAr || '';

    const selection = {
      universityValue,
      universityId: selectedUni?.universityId || null,
      universityName: universityValue === OTHER_UNIVERSITY ? otherUniversityName : selectedUni?.universityName,
      otherUniversityName,
      facultyCode,
      facultyName,
      otherFacultyName,
      majorCode,
      trainingHours: trainingHours === '' ? NaN : Number(trainingHours),
    };

    const local = validateAcademicProfile(selection);
    if (!local.ok) {
      setErrors(local.errors);
      return;
    }

    setSubmitting(true);
    setServerHint('');
    setErrors({});

    try {
      await validateInternshipAcademicProfile(local.profile);
    } catch (err) {
      const details = err?.response?.data?.details?.fields;
      if (details && typeof details === 'object') {
        const mapped = {};
        for (const [key, msgs] of Object.entries(details)) {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs);
        }
        setErrors(mapped);
        setSubmitting(false);
        return;
      }
      // Offline / API down: keep client validation so the guided preview still works locally.
      setServerHint('تعذر التحقق من الخادم حالياً — نستمر بالتحقق المحلي.');
    }

    emitInternshipJourneyEvent('track_recommended', {
      majorCode: local.profile.majorCode,
      trackCode: local.profile.trackCode,
      hours: local.profile.trainingHours,
    });
    onBuild({
      ...local.profile,
      universityValue,
      otherUniversityName,
      otherFacultyName,
    });
    setSubmitting(false);
  }

  return (
    <section className="ij-section" id="configure">
      <div className="ij-section-title">
        <div className="ij-eyebrow">01 / ACADEMIC PROFILE</div>
        <h2>ابدأ رحلتك في التدريب الميداني</h2>
        <p>حدد بياناتك الأكاديمية لنجهز لك مسار التدريب المناسب لتخصصك وعدد الساعات المطلوبة من جامعتك.</p>
      </div>

      <form className="ij-config ij-glass ij-academic-panel" onSubmit={handleSubmit} noValidate>
        <div className="ij-fields ij-fields--academic">
          <SearchableSelect
            id="ij-university"
            label="الجامعة"
            placeholder="اختر جامعتك"
            searchPlaceholder="ابحث عن جامعتك…"
            value={universityValue}
            options={universityOptions}
            onChange={handleUniversityChange}
            required
            error={errors.university || ''}
          />

          {universityValue === OTHER_UNIVERSITY ? (
            <div className={`ij-field${errors.university ? ' ij-field--error' : ''}`}>
              <label htmlFor="ij-other-university">اسم الجامعة</label>
              <input
                id="ij-other-university"
                className="ij-other-university"
                placeholder="أدخل اسم الجامعة"
                value={otherUniversityName}
                onChange={(e) => setOtherUniversityName(e.target.value)}
                aria-invalid={Boolean(errors.university)}
              />
            </div>
          ) : null}

          <SearchableSelect
            id="ij-faculty"
            label="الكلية"
            placeholder="اختر الكلية"
            searchPlaceholder="ابحث عن الكلية…"
            value={facultyCode}
            options={facultyOptions}
            onChange={handleFacultyChange}
            disabled={!facultyEnabled}
            required
            error={errors.faculty || ''}
          />

          {facultyCode === OTHER_FACULTY ? (
            <div className={`ij-field${errors.faculty ? ' ij-field--error' : ''}`}>
              <label htmlFor="ij-other-faculty">اسم الكلية</label>
              <input
                id="ij-other-faculty"
                placeholder="أدخل اسم الكلية"
                value={otherFacultyName}
                onChange={(e) => setOtherFacultyName(e.target.value)}
                aria-invalid={Boolean(errors.faculty)}
              />
            </div>
          ) : null}

          <SearchableSelect
            id="ij-major"
            label="التخصص"
            placeholder="اختر تخصصك"
            searchPlaceholder="ابحث عن التخصص…"
            value={majorCode}
            options={majorOptions}
            onChange={handleMajorChange}
            disabled={!majorEnabled}
            required
            error={errors.major || ''}
          />

          <SearchableSelect
            id="ij-hours"
            label="عدد ساعات التدريب المطلوبة"
            placeholder="اختر عدد الساعات"
            searchPlaceholder="ابحث عن عدد الساعات…"
            value={trainingHours}
            options={hoursOptions}
            onChange={handleHoursChange}
            disabled={!hoursEnabled}
            required
            error={errors.hours || ''}
          />
        </div>

        <div className="ij-note">
          💡{' '}
          <span>
            <b>مهم:</b> اسم الجامعة لا يحدد الساعات تلقائياً. حدّد عدد الساعات وفق كتاب التدريب الصادر عن
            جامعتك. اختيار «جامعة أخرى» أو «كلية أخرى» يُحفظ كبيانات التحاق فقط ولا ينشئ سجلاً في دليل الجامعات.
          </span>
        </div>

        {serverHint ? <p className="ij-server-hint">{serverHint}</p> : null}

        <div className="ij-actionline">
          <div className="ij-small">
            {uniSource === 'api'
              ? '✓ تم تحميل الجامعات من دليل eprojecto'
              : uniSource === 'fallback'
                ? 'قائمة الجامعات الاحتياطية (وضع عدم الاتصال)'
                : 'جاري تحميل الجامعات…'}
          </div>
          <button type="submit" className="ij-btn ij-pulse" disabled={submitting}>
            {submitting ? 'جاري التجهيز…' : 'اعرض مساري التدريبي'}
          </button>
        </div>
      </form>
    </section>
  );
}
