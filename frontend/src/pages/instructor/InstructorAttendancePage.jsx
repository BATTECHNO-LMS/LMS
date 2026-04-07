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

/** @typedef {{ learnerId: string, presence: 'present' | 'absent', excuseType: 'excused' | 'unexcused' | '', reason: string }} AttendanceRowState */

function emptyRowState(learnerId) {
  return { learnerId, presence: 'present', excuseType: '', reason: '' };
}

export function InstructorAttendancePage() {
  const [sessionId, setSessionId] = useState(MOCK_ATTENDANCE_SESSIONS[0]?.id ?? '');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(() =>
    MOCK_ATTENDANCE_LEARNERS.map((l) => emptyRowState(l.id))
  );

  const learnersFiltered = useMemo(() => {
    if (!q.trim()) return MOCK_ATTENDANCE_LEARNERS;
    return MOCK_ATTENDANCE_LEARNERS.filter(
      (l) => l.name.includes(q) || l.cohort.includes(q)
    );
  }, [q]);

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
        title="الحضور والغياب"
        description="تسجيل حضور المتعلمين أو غيابهم، مع نوع العذر (بعذر / بدون عذر) وسبب الغياب عند الحاجة."
      />
      <AdminActionBar>
        <Button type="button" variant="primary" onClick={handleSave}>
          <Save size={18} aria-hidden /> حفظ السجل
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالمتعلم أو الدفعة" aria-label="بحث" />
        <SelectField id="session-pick" label="الجلسة" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          {MOCK_ATTENDANCE_SESSIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="نسبة الحضور (هذه القائمة)" value={`${stats.pct}%`} icon={Percent} />
        <StatCard label="حاضرون" value={String(stats.present)} icon={UserCheck} />
        <StatCard label="غائبون" value={String(stats.absent)} icon={UserX} />
        <StatCard label="جلسة محددة" value={sessionId ? 'نعم' : '—'} icon={ClipboardCheck} />
      </AdminStatsGrid>
      <SectionCard title="تسجيل الحضور لكل متعلم">
        <div className="attendance-table-wrap">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>المتعلم</th>
                <th>الدفعة</th>
                <th>الحالة</th>
                <th>نوع الغياب</th>
                <th>سبب الغياب</th>
              </tr>
            </thead>
            <tbody>
              {learnersFiltered.map((learner) => {
                const row = rows.find((r) => r.learnerId === learner.id) ?? emptyRowState(learner.id);
                const absent = row.presence === 'absent';
                return (
                  <tr key={learner.id}>
                    <td className="attendance-table__name">{learner.name}</td>
                    <td>{learner.cohort}</td>
                    <td>
                      <div className="attendance-table__presence">
                        <label className="attendance-radio">
                          <input
                            type="radio"
                            name={`presence-${learner.id}`}
                            checked={row.presence === 'present'}
                            onChange={() => updateRow(learner.id, { presence: 'present' })}
                          />
                          <span>حاضر</span>
                        </label>
                        <label className="attendance-radio">
                          <input
                            type="radio"
                            name={`presence-${learner.id}`}
                            checked={row.presence === 'absent'}
                            onChange={() => updateRow(learner.id, { presence: 'absent', excuseType: 'unexcused' })}
                          />
                          <span>غائب</span>
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
                          aria-label="نوع الغياب"
                        >
                          <option value="excused">بعذر</option>
                          <option value="unexcused">بدون عذر</option>
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
                          placeholder="مثال: مرضي، ظرف طارئ..."
                          value={row.reason}
                          onChange={(e) => updateRow(learner.id, { reason: e.target.value })}
                          aria-label="سبب الغياب"
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
          عند اختيار «غائب» يُطلب تحديد ما إذا كان الغياب بعذر معتمد أم بدون عذر، مع إمكانية كتابة السبب للمرجعية.
        </p>
      </SectionCard>
    </div>
  );
}
