import { useEffect, useMemo, useState } from 'react';
import { Shield, KeyRound, Link2, Users, Save } from 'lucide-react';
import {
  AdminPageHeader,
  AdminStatsGrid,
  SectionCard,
} from '../../components/admin/index.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { ConfirmDeleteModal } from '../../components/modals/ConfirmDeleteModal.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useRolesOverview, useUpdateRolePermissions } from '../../features/roles/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { tr } from '../../utils/i18n.js';

const WRITE_ACTIONS = new Set(['create', 'update', 'delete', 'approve', 'manage']);

function actionLabel(action, isArabic) {
  const map = {
    view: isArabic ? 'عرض' : 'View',
    create: isArabic ? 'إنشاء' : 'Create',
    update: isArabic ? 'تعديل' : 'Update',
    delete: isArabic ? 'حذف' : 'Delete',
    approve: isArabic ? 'اعتماد' : 'Approve',
    export: isArabic ? 'تصدير' : 'Export',
    manage: isArabic ? 'إدارة' : 'Manage',
  };
  return map[action] || action;
}

export function RolesPermissionsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { data, isLoading, isError, error, refetch } = useRolesOverview();
  const updateMutation = useUpdateRolePermissions();

  const roles = data?.roles ?? [];
  const modules = data?.modules ?? [];
  const actions = data?.actions ?? ['view', 'create', 'update', 'delete', 'approve', 'export', 'manage'];
  const summary = data?.summary;

  const [selectedCode, setSelectedCode] = useState('admin');
  const [draft, setDraft] = useState(() => new Set());
  const [feedback, setFeedback] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((r) => r.code === selectedCode) || roles[0] || null,
    [roles, selectedCode]
  );

  useEffect(() => {
    if (!roles.length) return;
    if (!roles.some((r) => r.code === selectedCode)) {
      setSelectedCode(roles[0].code);
    }
  }, [roles, selectedCode]);

  useEffect(() => {
    if (!selectedRole) return;
    setDraft(new Set(selectedRole.permission_codes || []));
    setFeedback('');
  }, [selectedRole?.id, selectedRole?.permission_codes?.join('|')]);

  const isSuperAdminRole = selectedRole?.code === 'super_admin';
  const isReviewerRole = selectedRole?.code === 'reviewer';

  function codeFor(moduleKey, action) {
    return `${moduleKey}.${action}`;
  }

  function isLocked(action) {
    if (isSuperAdminRole) return true;
    if (isReviewerRole && WRITE_ACTIONS.has(action)) return true;
    return false;
  }

  function toggle(code, locked) {
    if (locked) return;
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function selectAllModule(moduleKey) {
    setDraft((prev) => {
      const next = new Set(prev);
      for (const action of actions) {
        if (isLocked(action)) continue;
        next.add(codeFor(moduleKey, action));
      }
      return next;
    });
  }

  function clearModule(moduleKey) {
    setDraft((prev) => {
      const next = new Set(prev);
      for (const action of actions) {
        const code = codeFor(moduleKey, action);
        if (isSuperAdminRole) continue;
        if (isReviewerRole && WRITE_ACTIONS.has(action)) continue;
        next.delete(code);
      }
      return next;
    });
  }

  async function save() {
    if (!selectedRole) return;
    setFeedback('');
    try {
      await updateMutation.mutateAsync({
        roleId: selectedRole.id,
        permissionCodes: [...draft],
      });
      setFeedback(tr(isArabic, 'تم حفظ الصلاحيات.', 'Permissions saved.'));
      setConfirmOpen(false);
      refetch();
    } catch (err) {
      setFeedback(getApiErrorMessage(err, tr(isArabic, 'تعذّر الحفظ.', 'Could not save.')));
      setConfirmOpen(false);
    }
  }

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الأدوار والصلاحيات', 'Roles and permissions')}
        description={tr(
          isArabic,
          'إدارة الأدوار الخمسة ومصفوفة الصلاحيات. متاح لسوبر أدمن فقط. المراجع الأكاديمي يبقى للعرض والتصدير فقط.',
          'Manage the five roles and permission matrix. Super Admin only. Academic reviewer stays view/export only.'
        )}
      />
      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <EmptyState
          title={tr(isArabic, 'تعذّر تحميل البيانات', 'Failed to load data')}
          description={error?.message || tr(isArabic, 'حاول مرة أخرى.', 'Please try again.')}
          actionLabel={tr(isArabic, 'إعادة المحاولة', 'Retry')}
          onAction={() => refetch()}
        />
      ) : (
        <>
          <AdminStatsGrid>
            <StatCard
              label={tr(isArabic, 'الأدوار المعتمدة', 'Canonical roles')}
              value={String(summary?.roles_count ?? 0)}
              icon={Shield}
            />
            <StatCard
              label={tr(isArabic, 'صلاحيات نشطة', 'Active permissions')}
              value={String(summary?.permissions_count ?? 0)}
              icon={KeyRound}
            />
            <StatCard
              label={tr(isArabic, 'روابط دور-صلاحية', 'Role-permission links')}
              value={String(summary?.role_permission_links ?? 0)}
              icon={Link2}
            />
            <StatCard
              label={tr(isArabic, 'مستخدمون مرتبطون', 'Linked users')}
              value={String(summary?.users_with_roles ?? 0)}
              icon={Users}
            />
          </AdminStatsGrid>

          <div className="ft-report-opportunity-grid" style={{ marginBottom: '1.25rem' }}>
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`ft-report-opportunity-card${selectedRole?.id === r.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedCode(r.code)}
                style={{ textAlign: 'start', cursor: 'pointer' }}
              >
                <h3 className="ft-report-opportunity-card__title">
                  {isArabic && r.name_ar ? r.name_ar : r.name}
                </h3>
                <p className="ft-report-opportunity-card__meta">
                  <code>{r.code}</code> · {r.scope}
                </p>
                <dl className="ft-report-opportunity-card__stats">
                  <div>
                    <dt>{tr(isArabic, 'المستخدمون', 'Users')}</dt>
                    <dd>{String(r.users_count ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>{tr(isArabic, 'الصلاحيات', 'Permissions')}</dt>
                    <dd>{String(r.permissions_count ?? 0)}</dd>
                  </div>
                </dl>
              </button>
            ))}
          </div>

          {selectedRole ? (
            <SectionCard
              title={
                isArabic && selectedRole.name_ar
                  ? selectedRole.name_ar
                  : selectedRole.name
              }
              actions={
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={updateMutation.isPending || isSuperAdminRole}
                  onClick={() => setConfirmOpen(true)}
                >
                  <Save size={16} aria-hidden /> {tr(isArabic, 'حفظ', 'Save')}
                </button>
              }
            >
              {isSuperAdminRole ? (
                <p className="crud-muted">
                  {tr(
                    isArabic,
                    'صلاحيات سوبر أدمن مقفلة بالكامل ولا يمكن تقليلها من الواجهة.',
                    'Super Admin permissions are locked and cannot be reduced from the UI.'
                  )}
                </p>
              ) : null}
              {isReviewerRole ? (
                <p className="crud-muted">
                  {tr(
                    isArabic,
                    'المراجع الأكاديمي للعرض والتصدير فقط — صلاحيات الكتابة مرفوضة من الخادم.',
                    'Academic reviewer is view/export only — write permissions are rejected by the server.'
                  )}
                </p>
              ) : null}
              {feedback ? (
                <p className="auth-register__helper" role="status">
                  {feedback}
                </p>
              ) : null}

              <div className="roles-matrix">
                {modules.map((mod) => (
                  <div key={mod.key} className="roles-matrix__module">
                    <div className="roles-matrix__module-head">
                      <strong>{isArabic ? mod.name_ar || mod.name : mod.name}</strong>
                      <div className="roles-matrix__module-actions">
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          disabled={isSuperAdminRole}
                          onClick={() => selectAllModule(mod.key)}
                        >
                          {tr(isArabic, 'تحديد الكل', 'Select all')}
                        </button>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          disabled={isSuperAdminRole}
                          onClick={() => clearModule(mod.key)}
                        >
                          {tr(isArabic, 'إلغاء الكل', 'Clear all')}
                        </button>
                      </div>
                    </div>
                    <div className="roles-matrix__checks">
                      {actions.map((action) => {
                        const code = codeFor(mod.key, action);
                        const locked = isLocked(action);
                        const checked = draft.has(code) || (isSuperAdminRole && true);
                        return (
                          <label key={code} className="roles-matrix__check">
                            <input
                              type="checkbox"
                              checked={Boolean(checked)}
                              disabled={locked}
                              onChange={() => toggle(code, locked)}
                            />
                            <span>{actionLabel(action, isArabic)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </>
      )}

      <ConfirmDeleteModal
        open={confirmOpen}
        title={tr(isArabic, 'تأكيد حفظ الصلاحيات', 'Confirm permission save')}
        message={tr(
          isArabic,
          'سيتم تطبيق المصفوفة فورًا على الخادم وتسجيلها في سجل التدقيق. المستخدمون يحتاجون طلبات جديدة لتحميل الصلاحيات.',
          'The matrix applies immediately on the server and is audited. Users need new requests to load permissions.'
        )}
        confirmLabel={tr(isArabic, 'حفظ', 'Save')}
        confirmVariant="primary"
        onClose={() => setConfirmOpen(false)}
        onConfirm={save}
        busy={updateMutation.isPending}
      />
    </div>
  );
}
