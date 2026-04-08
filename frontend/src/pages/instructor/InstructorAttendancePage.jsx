import { useCallback, useMemo, useState } from 'react';
import { ClipboardCheck, UserCheck, UserX, Percent, Save } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SelectField } from '../../components/admin/SelectField.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { Button } from '../../components/common/Button.jsx';
import { MOCK_ATTENDANCE_LEARNERS, MOCK_ATTENDANCE_SESSIONS } from '../../mocks/instructorAttendance.js';
import { useLocale } from '../../features/locale/index.js';
import { tr } from '../../utils/i18n.js';

/** @typedef {{ learnerId: string, presence: 'present' | 'absent', excuseType: 'excused' | 'unexcused' | '', reason: string }} AttendanceRowState */

function emptyRowState(learnerId) {
  return { learnerId, presence: 'present', excuseType: '', reason: '' };
}

export function InstructorAttendancePage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  const [sessionId, setSessionId] = useState(MOCK_ATTENDANCE_SESSIONS[0]?.id ?? '');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(() =>
    MOCK_ATTENDANCE_LEARNERS.map((l) => emptyRowState(l.id))
  );

  const learnersFiltered = useMemo(() => {
    if (!q.trim()) return MOCK_ATTENDANCE_LEARNERS;
    return MOCK_ATTENDANCE_LEARNERS.filter(
      (l) =>
        (isArabic ? l.nameAr : l.nameEn).toLowerCase().includes(q.toLowerCase()) ||
        (isArabic ? l.cohortAr : l.cohortEn).toLowerCase().includes(q.toLowerCase())
    );
  }, [q, isArabic]);

  const updateRow = useCallback((learnerId, patch) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.learnerId !== learnerId) return r;
        const next = { ...r, ...patch };
        if (patch.presence === 'present') {
          next.excuseType = '';
          next.reason = '';
        }
        if (patch.presence === 'absent' && !next.excuseType) {
          next.excuseType = 'unexcused';
        }
        return next;
      })
    );
  }, []);

  const stats = useMemo(() => {
    const map = Object.fromEntries(rows.map((r) => [r.learnerId, r]));
    let present = 0;
    let absent = 0;
    for (const l of MOCK_ATTENDANCE_LEARNERS) {
      const r = map[l.id];
      if (!r) continue;
      if (r.presence === 'present') present += 1;
      else absent += 1;
    }
    const total = MOCK_ATTENDANCE_LEARNERS.length || 1;
    const pct = Math.round((present / total) * 100);
    return { present, absent, pct };
  }, [rows]);

  function handleSave() {
    // placeholder — سيتم الإرسال للخادم لاحقاً
    console.info('attendance save', { sessionId, rows });
  }

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader
        title={tr(isArabic, 'الحضور والغياب', 'Attendance and absence')}
        description={tr(
          isArabic,
          'تسجيل حضور المتعلمين أو غيابهم، مع نوع العذر (بعذر / بدون عذر) وسبب الغياب عند الحاجة.',
          'Record learner attendance or absence, with excuse type (excused / unexcused) and reason when needed.'
        )}
      />
      <AdminActionBar>
        <Button type="button" variant="primary" onClick={handleSave}>
          <Save size={18} aria-hidden /> {tr(isArabic, 'حفظ السجل', 'Save record')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr(isArabic, 'بحث بالمتعلم أو الدفعة', 'Search by learner or cohort')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField
          id="session-pick"
          label={tr(isArabic, 'الجلسة', 'Session')}
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        >
          {MOCK_ATTENDANCE_SESSIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {isArabic ? s.labelAr : s.labelEn}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="نسبة الحضور (هذه القائمة)" value={`${stats.pct}%`} icon={Percent} />
        <StatCard label="حاضرون" value={String(stats.present)} icon={UserCheck} />
        <StatCard label="غائبون" value={String(stats.absent)} icon={UserX} />
        <StatCard label={tr(isArabic, 'جلسة محددة', 'Selected session')} value={sessionId ? tr(isArabic, 'نعم', 'Yes') : '—'} icon={ClipboardCheck} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'تسجيل الحضور لكل متعلم', 'Record attendance for each learner')}>
        <div className="attendance-table-wrap">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>{tr(isArabic, 'المتعلم', 'Learner')}</th>
                <th>{tr(isArabic, 'الدفعة', 'Cohort')}</th>
                <th>{tr(isArabic, 'الحالة', 'Status')}</th>
                <th>{tr(isArabic, 'نوع الغياب', 'Absence type')}</th>
                <th>{tr(isArabic, 'سبب الغياب', 'Absence reason')}</th>
              </tr>
            </thead>
            <tbody>
              {learnersFiltered.map((learner) => {
                const row = rows.find((r) => r.learnerId === learner.id) ?? emptyRowState(learner.id);
                const absent = row.presence === 'absent';
                return (
                  <tr key={learner.id}>
                    <td className="attendance-table__name">{isArabic ? learner.nameAr : learner.nameEn}</td>
                    <td>{isArabic ? learner.cohortAr : learner.cohortEn}</td>
                    <td>
                      <div className="attendance-table__presence">
                        <label className="attendance-radio">
                          <input
                            type="radio"
                            name={`presence-${learner.id}`}
                            checked={row.presence === 'present'}
                            onChange={() => updateRow(learner.id, { presence: 'present' })}
                          />
                          <span>{tr(isArabic, 'حاضر', 'Present')}</span>
                        </label>
                        <label className="attendance-radio">
                          <input
                            type="radio"
                            name={`presence-${learner.id}`}
                            checked={row.presence === 'absent'}
                            onChange={() => updateRow(learner.id, { presence: 'absent', excuseType: 'unexcused' })}
                          />
                          <span>{tr(isArabic, 'غائب', 'Absent')}</span>
                        </label>
                      </div>
                    </td>
                    <td>
                      {absent ? (
                        <select
                          className="form-field__control attendance-table__select"
                          value={row.excuseType || 'unexcused'}
                          onChange={(e) =>
                            updateRow(learner.id, { excuseType: e.target.value })
                          }
                          aria-label={tr(isArabic, 'نوع الغياب', 'Absence type')}
                        >
                          <option value="excused">{tr(isArabic, 'بعذر', 'Excused')}</option>
                          <option value="unexcused">{tr(isArabic, 'بدون عذر', 'Unexcused')}</option>
                        </select>
                      ) : (
                        <span className="attendance-table__na">—</span>
                      )}
                    </td>
                    <td>
                      {absent ? (
                        <input
                          type="text"
                          className="form-field__control"
                          placeholder={tr(isArabic, 'مثال: مرضي، ظرف طارئ...', 'Example: medical, emergency...')}
                          value={row.reason}
                          onChange={(e) => updateRow(learner.id, { reason: e.target.value })}
                          aria-label={tr(isArabic, 'سبب الغياب', 'Absence reason')}
                        />
                      ) : (
                        <span className="attendance-table__na">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="attendance-table__hint">
          {tr(
            isArabic,
            'عند اختيار «غائب» يُطلب تحديد ما إذا كان الغياب بعذر معتمد أم بدون عذر، مع إمكانية كتابة السبب للمرجعية.',
            'When selecting "Absent", choose whether the absence is excused or unexcused and optionally provide a reason for reference.'
          )}
        </p>
      </SectionCard>
    </div>
  );
}
