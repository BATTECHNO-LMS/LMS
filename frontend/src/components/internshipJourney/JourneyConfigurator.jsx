import { useEffect, useMemo, useState } from 'react';
import {
  HOURS_OPTIONS,
  OTHER_FACULTY,
  OTHER_MAJOR,
  OTHER_UNIVERSITY,
  emitInternshipJourneyEvent,
  getActiveFaculties,
  getFaculty,
  getMajorsForFaculty,
  validateAcademicProfile,
} from '../../features/internshipJourney/index.js';
import { fetchInternshipJourneyUniversities, validateInternshipAcademicProfile } from '../../features/internshipJourney/internshipJourney.api.js';
import { SearchableSelect } from './SearchableSelect.jsx';

export function JourneyConfigurator({ onBuild }) {
  const [universities, setUniversities] = useState([]);
  const [uniSource, setUniSource] = useState('loading');
  const [universityCode, setUniversityCode] = useState('');
  const [otherUniversityName, setOtherUniversityName] = useState('');
  const [facultyCode, setFacultyCode] = useState('');
  const [otherFacultyName, setOtherFacultyName] = useState('');
  const [majorCode, setMajorCode] = useState('');
  const [otherMajorName, setOtherMajorName] = useState('');
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
      value: u.code,
      label: u.name || u.name_ar,
      keywords: u.keywords || [u.name, u.name_en, u.code, ...(u.aliases || [])].filter(Boolean).join(' '),
      universityCode: u.code,
      universityName: u.name || u.name_ar,
      eprojectoUniversityId: u.eprojectoUniversityId || null,
    }));
    list.push({
      value: OTHER_UNIVERSITY,
      label: 'جامعة أخرى',
      keywords: 'other جامعة اخرى',
      universityCode: OTHER_UNIVERSITY,
      universityName: '',
      eprojectoUniversityId: null,
    });
    return list;
  }, [universities]);

  const facultyOptions = useMemo(
    () =>
      getActiveFaculties().map((f) => ({
        value: f.code,
        label: f.labelAr,
        keywords: [f.labelAr, f.labelEn, ...(f.aliases || [])].join(' '),
      })),
    []
  );

  const majorOptions = useMemo(() => {
    if (!facultyCode || facultyCode === OTHER_FACULTY) return [];
    return getMajorsForFaculty(facultyCode).map((m) => ({
      value: m.code,
      label: m.labelAr,
      keywords: `${m.labelAr} ${m.labelEn} ${m.code}`,
      isOther: Boolean(m.isOther),
    }));
  }, [facultyCode]);

  const hoursOptions = useMemo(
    () => HOURS_OPTIONS.map((h) => ({ value: String(h), label: `${h} ساعة`, keywords: String(h) })),
    []
  );

  const facultyMeta = getFaculty(facultyCode);
  const selectedMajor = majorOptions.find((m) => m.value === majorCode);
  const needsCustomMajor = facultyCode === OTHER_FACULTY || Boolean(selectedMajor?.isOther);

  const facultyEnabled = Boolean(universityCode);
  const majorEnabled = Boolean(
    facultyEnabled && facultyCode && (facultyCode !== OTHER_FACULTY || otherFacultyName.trim())
  );
  const hoursEnabled = Boolean(
    majorEnabled &&
      (facultyCode === OTHER_FACULTY
        ? otherMajorName.trim()
        : majorCode && (!selectedMajor?.isOther || otherMajorName.trim()))
  );

  function resetFromUniversity() {
    setFacultyCode('');
    setOtherFacultyName('');
    setMajorCode('');
    setOtherMajorName('');
    setTrainingHours('');
    setErrors({});
    setServerHint('');
  }

  function resetFromFaculty() {
    setMajorCode('');
    setOtherMajorName('');
    setTrainingHours('');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.major;
      delete next.hours;
      return next;
    });
  }

  function handleUniversityChange(value) {
    setUniversityCode(value);
    if (value !== OTHER_UNIVERSITY) setOtherUniversityName('');
    resetFromUniversity();
    emitInternshipJourneyEvent('university_selected', {
      source: uniSource,
      isOther: value === OTHER_UNIVERSITY,
      universityCode: value === OTHER_UNIVERSITY ? 'OTHER' : value,
    });
  }

  function handleFacultyChange(value) {
    setFacultyCode(value);
    if (value !== OTHER_FACULTY) setOtherFacultyName('');
    resetFromFaculty();
    emitInternshipJourneyEvent('faculty_selected', {
      facultyCode: value === OTHER_FACULTY ? 'OTHER' : value,
    });
  }

  function handleMajorChange(value) {
    setMajorCode(value);
    const opt = majorOptions.find((m) => m.value === value);
    if (!opt?.isOther) setOtherMajorName('');
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
    const selectedUni = universityOptions.find((o) => o.value === universityCode);
    const facultyName =
      facultyCode === OTHER_FACULTY ? otherFacultyName.trim() : facultyMeta?.labelAr || '';

    const selection = {
      universityCode,
      universityValue: universityCode,
      universityName:
        universityCode === OTHER_UNIVERSITY ? otherUniversityName : selectedUni?.universityName,
      otherUniversityName,
      facultyCode,
      facultyName,
      otherFacultyName,
      majorCode: facultyCode === OTHER_FACULTY ? OTHER_MAJOR : majorCode,
      otherMajorName,
      majorCustomName: otherMajorName,
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
      setServerHint('تعذر التحقق من الخادم حالياً — نستمر بالتحقق المحلي.');
    }

    emitInternshipJourneyEvent('track_recommended', {
      majorCode: local.profile.majorCode,
      trackCode: local.profile.trackCode,
      hours: local.profile.trainingHours,
      facultyCode: local.profile.facultyCode,
    });
    onBuild({
      ...local.profile,
      universityValue: universityCode,
      otherUniversityName,
      otherFacultyName,
      otherMajorName,
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
            value={universityCode}
            options={universityOptions}
            onChange={handleUniversityChange}
            required
            error={errors.university || ''}
          />

          {universityCode === OTHER_UNIVERSITY ? (
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

          {facultyMeta?.helperAr && facultyCode && facultyCode !== OTHER_FACULTY ? (
            <p className="ij-field-hint" role="note">
              {facultyMeta.helperAr}
            </p>
          ) : null}

          {facultyCode !== OTHER_FACULTY ? (
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
          ) : null}

          {needsCustomMajor ? (
            <div className={`ij-field${errors.major ? ' ij-field--error' : ''}`}>
              <label htmlFor="ij-other-major">اكتب اسم تخصصك</label>
              <input
                id="ij-other-major"
                placeholder="اكتب اسم تخصصك"
                value={otherMajorName}
                onChange={(e) => {
                  setOtherMajorName(e.target.value);
                  setTrainingHours('');
                }}
                disabled={!majorEnabled}
                aria-invalid={Boolean(errors.major)}
              />
              {errors.major ? (
                <p className="ij-field-error" role="alert">
                  {errors.major}
                </p>
              ) : null}
            </div>
          ) : null}

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
            <b>مهم:</b> قائمة الجامعات دليل أردني عام للالتحاق، وليست مرتبطة بإنشاء مؤسسة في eprojecto.
            التخصصات المعروضة تعتمد على الكلية المختارة ضمن مسارات التدريب المدعومة حالياً.
          </span>
        </div>

        {serverHint ? <p className="ij-server-hint">{serverHint}</p> : null}

        <div className="ij-actionline">
          <div className="ij-small">
            {uniSource === 'loading'
              ? 'جاري تحميل دليل الجامعات…'
              : `✓ دليل جامعات الأردن (${universities.length} جامعة)`}
          </div>
          <button type="submit" className="ij-btn ij-pulse" disabled={submitting}>
            {submitting ? 'جاري التجهيز…' : 'اعرض مساري التدريبي'}
          </button>
        </div>
      </form>
    </section>
  );
}
