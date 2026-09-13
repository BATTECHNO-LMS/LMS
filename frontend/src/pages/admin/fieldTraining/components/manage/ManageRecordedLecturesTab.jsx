import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { useAuth } from '../../../../../features/auth/index.js';
import { ROLES } from '../../../../../constants/roles.js';
import {
  changeRecordedLectureStatus,
  hideRecordedLecture,
  publishRecordedLecture,
  reorderOpportunityRecordedLectures,
  useOpportunityRecordedLectures,
  useOpportunitySessions,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { ManageTabEmpty, ManageTabSkeleton } from './ManageTabStates.jsx';
import { RecordedLecturesImportPanel } from './RecordedLecturesImportPanel.jsx';
import { RecordedLecturesSortableList } from './RecordedLecturesSortableList.jsx';
import { RecordedLecturesSyncPanel } from './RecordedLecturesSyncPanel.jsx';
import { lectureStatusKey } from './recordedLectureOrder.js';

function universityLabel(opportunity) {
  return (
    opportunity?.university_name ||
    opportunity?.universities?.name ||
    opportunity?.university?.name ||
    ''
  );
}

function canManageRecordedLectures(apiScope, user) {
  if (apiScope === 'reviewer') return false;
  const roles = Array.isArray(user?.roles) ? user.roles.map(String) : [];
  if (roles.includes(ROLES.SUPER_ADMIN) || user?.isGlobal) return true;
  if (apiScope === 'instructor') return true;
  if (roles.includes(ROLES.REVIEWER) && !roles.includes(ROLES.ADMIN) && !roles.includes(ROLES.SUPER_ADMIN)) {
    return false;
  }
  return true;
}

export function ManageRecordedLecturesTab({ opportunityId, opportunity = null, apiScope = 'admin' }) {
  const isInstructor = apiScope === 'instructor';
  const { t } = useTranslation('fieldTraining');
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManage = canManageRecordedLectures(apiScope, user);
  const { data, isLoading } = useOpportunityRecordedLectures(opportunityId, { scope: apiScope });
  const { data: sessionsData } = useOpportunitySessions(opportunityId, {
    enabled: Boolean(opportunityId) && canManage,
    scope: apiScope,
  });
  const lectures = data?.lectures ?? [];
  const playlistSources = data?.playlistSources ?? [];
  const [filter, setFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [ordered, setOrdered] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setOrdered(lectures);
  }, [lectures]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.recordedLectures(opportunityId, apiScope) });

  const opts = { asInstructor: isInstructor };
  const reorderMut = useMutation({
    mutationFn: ({ ids }) => reorderOpportunityRecordedLectures(opportunityId, ids, opts),
    onSuccess: (payload) => {
      setError('');
      if (payload?.lectures) setOrdered(payload.lectures);
      invalidate();
    },
    onError: (err, variables) => {
      if (variables?.previous) setOrdered(variables.previous);
      setError(getApiErrorMessage(err) || t('recordedLectures.reorderFailed'));
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ lecture, action }) => {
      if (action === 'publish') return publishRecordedLecture(lecture.id, opts);
      if (action === 'hide') return hideRecordedLecture(lecture.id, opts);
      return changeRecordedLectureStatus(lecture.id, 'draft', opts);
    },
    onSuccess: invalidate,
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const filtered = useMemo(() => {
    if (filter === 'all') return ordered;
    return ordered.filter((lecture) => lectureStatusKey(lecture.status) === filter);
  }, [filter, ordered]);

  function handleReorder(next) {
    const previous = ordered;
    setOrdered(next);
    reorderMut.mutate({
      ids: next.map((lecture) => lecture.id),
      previous,
    });
  }

  if (isLoading) return <ManageTabSkeleton rows={4} />;

  const busy = reorderMut.isPending || statusMut.isPending;
  const empty = lectures.length === 0;

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">{t('recordedLectures.title')}</h2>
          <p className="ft-manage-panel__desc">
            {[opportunity?.title, universityLabel(opportunity), t('recordedLectures.lectureCount', { count: lectures.length })]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setShowImport((open) => !open)}>
            {t('recordedLectures.addButton')}
          </Button>
        ) : null}
      </header>

      {error ? <p className="form-field__error">{error}</p> : null}

      {canManage && (showImport || empty) ? (
        <RecordedLecturesImportPanel
          opportunityId={opportunityId}
          asInstructor={isInstructor}
          onImported={() => {
            invalidate();
            setShowImport(false);
          }}
        />
      ) : null}

      {playlistSources.map((source) => (
        <RecordedLecturesSyncPanel
          key={source.playlistId}
          opportunityId={opportunityId}
          source={source}
          asInstructor={isInstructor}
          canManage={canManage}
          onImported={invalidate}
        />
      ))}

      {empty ? (
        <ManageTabEmpty
          icon={Plus}
          title={t('recordedLectures.emptyOpportunity')}
          description={t('recordedLectures.emptyDesc')}
          action={
            canManage ? (
              <Button type="button" onClick={() => setShowImport(true)}>
                {t('recordedLectures.addCta')}
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="ft-recorded-filters" role="tablist">
            {['all', 'published', 'draft', 'hidden'].map((key) => (
              <button
                key={key}
                type="button"
                className={`ft-recorded-mode${filter === key ? ' is-active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {t(`recordedLectures.filters.${key}`)}
              </button>
            ))}
          </div>
          <RecordedLecturesSortableList
            lectures={filtered}
            canManage={canManage && filter === 'all'}
            editingId={editingId}
            sessions={sessionsData?.sessions ?? []}
            asInstructor={isInstructor}
            onEdit={setEditingId}
            onCloseEdit={() => setEditingId(null)}
            onSaved={invalidate}
            onPublish={(lecture) => statusMut.mutate({ lecture, action: 'publish' })}
            onHide={(lecture) => statusMut.mutate({ lecture, action: 'hide' })}
            onDraft={(lecture) => statusMut.mutate({ lecture, action: 'draft' })}
            onReorder={handleReorder}
            busy={busy}
          />
        </>
      )}
    </div>
  );
}
