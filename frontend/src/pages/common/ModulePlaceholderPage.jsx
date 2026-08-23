import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';

export function NotFoundPage() {
  const { t } = useTranslation('emptyStates');
  return (
    <div className="page page--dashboard">
      <PageHeader title={t('notFound.title')} subtitle={t('notFound.subtitle')} />
      <EmptyState title={t('notFound.emptyTitle')} description={t('notFound.emptyDescription')} />
    </div>
  );
}

/** @deprecated Unknown routes now render a real 404. */
export function ModulePlaceholderPage() {
  return <NotFoundPage />;
}

export function AdminNotFoundPage() {
  return <NotFoundPage />;
}
