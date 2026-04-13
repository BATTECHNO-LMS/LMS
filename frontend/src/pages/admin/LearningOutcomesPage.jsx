import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AdminPageHeader,
  AdminFilterBar,
  SectionCard,
  SelectField,
} from '../../components/admin/index.js';
import { useMicroCredentials } from '../../features/microCredentials/index.js';
import { LearningOutcomesPanel } from '../../features/learningOutcomes/components/LearningOutcomesPanel.jsx';

export function LearningOutcomesPage() {
  const { t } = useTranslation('learningOutcomes');
  const { data } = useMicroCredentials({}, { staleTime: 30_000 });
  const micros = data?.micro_credentials ?? [];
  const [microCredentialId, setMicroCredentialId] = useState('');

  const options = useMemo(
    () =>
      micros.map((m) => ({
        id: String(m.id),
        label: `${m.code} — ${m.title}`,
      })),
    [micros]
  );

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminFilterBar>
        <SelectField
          id="lo-micro-pick"
          label={t('catalog.pickLabel')}
          value={microCredentialId}
          onChange={(e) => setMicroCredentialId(e.target.value)}
        >
          <option value="">{t('catalog.pickPlaceholder')}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      {!microCredentialId ? (
        <SectionCard title={t('panelTitle')}>
          <p className="auth-register__helper">{t('catalog.hint')}</p>
        </SectionCard>
      ) : (
        <LearningOutcomesPanel microCredentialId={microCredentialId} readOnly={false} />
      )}
    </div>
  );
}
