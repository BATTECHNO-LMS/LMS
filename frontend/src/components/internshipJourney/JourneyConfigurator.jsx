import { useRef, useState } from 'react';
import {
  ACADEMIC_MAJORS,
  DEFAULT_HOURS,
  DEFAULT_MAJOR,
  HOURS_OPTIONS,
  OTHER_UNIVERSITY,
  UNIVERSITIES,
} from '../../features/internshipJourney/index.js';

function UniversitySelector({ value, otherName, onChange, onOtherNameChange, selectRef, otherRef }) {
  return (
    <div className="ij-field">
      <label htmlFor="ij-university">🏫 جامعتك</label>
      <select id="ij-university" ref={selectRef} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— اختر الجامعة —</option>
        {UNIVERSITIES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={OTHER_UNIVERSITY}>جامعة أخرى...</option>
      </select>
      {value === OTHER_UNIVERSITY ? (
        <input
          ref={otherRef}
          className="ij-other-university"
          placeholder="اسم الجامعة"
          aria-label="اسم الجامعة"
          value={otherName}
          onChange={(e) => onOtherNameChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}

function InternshipHoursSelector({ value, onChange }) {
  return (
    <div className="ij-field">
      <label htmlFor="ij-hours">⏱️ الساعات المطلوبة</label>
      <select id="ij-hours" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {HOURS_OPTIONS.map((hours) => (
          <option key={hours} value={hours}>
            {hours} ساعة
          </option>
        ))}
      </select>
    </div>
  );
}

function SpecializationSelector({ value, onChange }) {
  return (
    <div className="ij-field">
      <label htmlFor="ij-track">🧭 تخصصك</label>
      <select id="ij-track" value={value} onChange={(e) => onChange(e.target.value)}>
        {ACADEMIC_MAJORS.map((major) => (
          <option key={major.value} value={major.value}>
            {major.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function JourneyConfigurator({ onBuild }) {
  const [university, setUniversity] = useState('');
  const [otherName, setOtherName] = useState('');
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [majorKey, setMajorKey] = useState(DEFAULT_MAJOR);
  const universityRef = useRef(null);
  const otherRef = useRef(null);

  function handleBuild() {
    const isOther = university === OTHER_UNIVERSITY;
    const universityName = isOther ? otherName.trim() : university;
    if (!universityName) {
      window.alert('اختار الجامعة أو اكتب اسمها أولاً 🎓');
      (isOther ? otherRef.current : universityRef.current)?.focus();
      return;
    }
    onBuild({ university: universityName, hours, majorKey });
  }

  return (
    <section className="ij-section" id="configure">
      <div className="ij-section-title">
        <div className="ij-eyebrow">01 / YOUR MISSION</div>
        <h2>حدد وجهتك... ونخطّط المغامرة 🗺️</h2>
        <p>اختر جامعتك والساعات بين 80 و300، وحدّد تخصصك لتظهر خطة مهنية مفصلة</p>
      </div>
      <div className="ij-config ij-glass">
        <div className="ij-fields">
          <UniversitySelector
            value={university}
            otherName={otherName}
            onChange={setUniversity}
            onOtherNameChange={setOtherName}
            selectRef={universityRef}
            otherRef={otherRef}
          />
          <InternshipHoursSelector value={hours} onChange={setHours} />
          <SpecializationSelector value={majorKey} onChange={setMajorKey} />
        </div>
        <div className="ij-note">
          💡{' '}
          <span>
            <b>مهم:</b> اسم الجامعة لا يحدد الساعات تلقائياً. حدّد عدد الساعات وفق كتاب التدريب الصادر عن
            جامعتك؛ ويتفق المشرف معك على أيام الدوام والمدة ومتطلبات الاعتماد.
          </span>
        </div>
        <div className="ij-actionline">
          <div className="ij-small">🔐 خطتك محليّة داخل المتصفح؛ لا يتم إرسال البيانات لأي خادم.</div>
          <button type="button" className="ij-btn ij-pulse" onClick={handleBuild}>
            ✨ ابنِ خريطتي التدريبية
          </button>
        </div>
      </div>
    </section>
  );
}
