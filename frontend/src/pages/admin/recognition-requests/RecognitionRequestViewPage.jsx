import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { FormSelect } from '../../../components/forms/index.js';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { useAuth } from '../../../features/auth/index.js';
import { useRecognitionRequest } from '../../../features/recognition/hooks/useRecognitionRequest.js';
import { useRecognitionDocuments } from '../../../features/recognition/hooks/useRecognitionDocuments.js';
import { useUpdateRecognitionRequestStatus } from '../../../features/recognition/hooks/useUpdateRecognitionRequestStatus.js';
import { useCreateRecognitionDocument } from '../../../features/recognition/hooks/useCreateRecognitionDocument.js';
import { useDeleteRecognitionDocument } from '../../../features/recognition/hooks/useDeleteRecognitionDocument.js';
import { useUpdateRecognitionDocument } from '../../../features/recognition/hooks/useUpdateRecognitionDocument.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { canPatchRecognitionStatus, canWriteRecognitionRequest } from '../../../utils/recognitionPermissions.js';

const STATUS_OPTIONS = [
  'draft',
  'in_preparation',
  'ready_for_submission',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'needs_revision',
];

const DOC_TYPES = [
  'credential_description',
  'alignment_matrix',
  'attendance_report',
  'grades_report',
  'evidence_samples',
  'delivery_report',
  'qa_report',
  'academic_recommendation',
  'other',
];

export function RecognitionRequestViewPage() {
  const { t } = useTranslation('recognition');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { user } = useAuth();
  const { id } = useParams();
  const location = useLocation();
  const base = location.pathname.startsWith('/reviewer') ? '/reviewer' : '/admin';

  const { data, isLoading, isError, error } = useRecognitionRequest(id, { staleTime: 30_000 });
  const { data: docsPayload, isLoading: docsLoading } = useRecognitionDocuments(id, { staleTime: 15_000 });

  const row = data?.recognition_request;
  const readiness = data?.readiness;
  const documents = docsPayload?.recognition_documents ?? [];

  const [nextStatus, setNextStatus] = useState('');
  const [statusErr, setStatusErr] = useState('');
  const [docForm, setDocForm] = useState({ document_type: 'credential_description', title: '', file_url: '' });
  const [editingDocumentId, setEditingDocumentId] = useState('');
  const [docErr, setDocErr] = useState('');

  const patchStatus = useUpdateRecognitionRequestStatus();
  const createDoc = useCreateRecognitionDocument();
  const deleteDoc = useDeleteRecognitionDocument();
  const updateDoc = useUpdateRecognitionDocument();

  const canWrite = canWriteRecognitionRequest(user);
  const canStatus = canPatchRecognitionStatus(user);

  const onDeleteDocument = useCallback(
    (docId) => {
      if (!id) return;
      deleteDoc.mutate(
        { id: docId, recognitionRequestId: id },
        { onError: (err) => setDocErr(getApiErrorMessage(err, t('form.documentError'))) }
      );
    },
    [id, deleteDoc, t]
  );

  const docRows = useMemo(
    () =>
      documents.map((d) => ({
        id: d.id,
        document_type: d.document_type,
        title: d.title,
        file_url: d.file_url,
        created_at: d.created_at ? new Date(d.created_at).toLocaleString(locale) : '—',
      })),
    [documents, locale]
  );

  const documentColumns = useMemo(() => {
    const base = [
      { key: 'document_type', label: t('form.documentType') },
      { key: 'title', label: t('form.documentTitle') },
      {
        key: 'file_url',
        label: t('form.fileUrl'),
        render: (r) => (
          <a href={r.file_url} target="_blank" rel="noreferrer">
            {r.file_url}
          </a>
        ),
      },
      { key: 'created_at', label: t('list.columns.createdAt') },
    ];
    if (canWrite) {
      base.push({
        key: 'actions',
        label: t('list.columns.actions'),
        render: (r) => (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => onStartEditDocument(r)}>
              {t('form.editDocument')}
            </button>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => onDeleteDocument(r.id)}>
              {t('form.deleteDocument')}
            </button>
          </div>
        ),
      });
    }
    return base;
  }, [canWrite, t, onDeleteDocument]);

  if (isLoading) {
    return (
      <div className="page page--admin crud-page">
        <p className="crud-muted">{tCommon('loading')}</p>
      </div>
    );
  }

  if (isError || !row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={tCommon('errors.generic')} description={getApiErrorMessage(error, '')} />
        <Link className="btn btn--primary" to={`${base}/recognition-requests`}>
          {tCommon('actions.backToList')}
        </Link>
      </div>
    );
  }

  function onApplyStatus(e) {
    e.preventDefault();
    setStatusErr('');
    if (!id || !nextStatus) return;
    patchStatus.mutate(
      { id, body: { status: nextStatus } },
      {
        onSuccess: () => setNextStatus(''),
        onError: (err) => setStatusErr(getApiErrorMessage(err, tCommon('errors.generic'))),
      }
    );
  }

  function onAddDocument(e) {
    e.preventDefault();
    setDocErr('');
    if (!id || !docForm.title.trim() || !docForm.file_url.trim()) {
      setDocErr(t('form.documentError'));
      return;
    }
    createDoc.mutate(
      { recognitionRequestId: id, body: { document_type: docForm.document_type, title: docForm.title, file_url: docForm.file_url } },
      {
        onSuccess: () => setDocForm((f) => ({ ...f, title: '', file_url: '' })),
        onError: (err) => setDocErr(getApiErrorMessage(err, t('form.documentError'))),
      }
    );
  }

  function onStartEditDocument(doc) {
    setDocErr('');
    setEditingDocumentId(doc.id);
    setDocForm({
      document_type: doc.document_type || 'other',
      title: doc.title || '',
      file_url: doc.file_url || '',
    });
  }

  function onCancelEditDocument() {
    setEditingDocumentId('');
    setDocForm({ document_type: 'credential_description', title: '', file_url: '' });
  }

  function onSaveDocumentEdit(e) {
    e.preventDefault();
    setDocErr('');
    if (!id || !editingDocumentId || !docForm.title.trim() || !docForm.file_url.trim()) {
      setDocErr(t('form.documentError'));
      return;
    }
    updateDoc.mutate(
      {
        id: editingDocumentId,
        recognitionRequestId: id,
        body: {
          document_type: docForm.document_type,
          title: docForm.title.trim(),
          file_url: docForm.file_url.trim(),
        },
      },
      {
        onSuccess: () => onCancelEditDocument(),
        onError: (err) => setDocErr(getApiErrorMessage(err, t('form.documentError'))),
      }
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={t('view.title')} description={t('list.description')} />
      <SectionCard
        title={t('view.title')}
        actions={
          canWrite && base === '/admin' ? (
            <Link className="btn btn--primary" to={`/admin/recognition-requests/${id}/edit`}>
              <Pencil size={18} aria-hidden /> {tCommon('actions.edit')}
            </Link>
          ) : null
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{t('list.columns.university')}</dt>
            <dd>{row.university?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('list.columns.microCredential')}</dt>
            <dd>{row.micro_credential?.title ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('list.columns.cohort')}</dt>
            <dd>{row.cohort?.title ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('list.columns.createdAt')}</dt>
            <dd>{row.created_at ? new Date(row.created_at).toLocaleString(locale) : '—'}</dd>
          </div>
          <div>
            <dt>{t('list.columns.status')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status, locale)}</StatusBadge>
            </dd>
          </div>
          {row.submitted_at ? (
            <div>
              <dt>{t('list.columns.submittedAt')}</dt>
              <dd>{new Date(row.submitted_at).toLocaleString(locale)}</dd>
            </div>
          ) : null}
          {row.reviewed_at ? (
            <div>
              <dt>{t('list.columns.reviewedAt')}</dt>
              <dd>{new Date(row.reviewed_at).toLocaleString(locale)}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t('form.decisionNotes')}</dt>
            <dd>{row.decision_notes || '—'}</dd>
          </div>
        </dl>

        {readiness ? (
          <div className="crud-view-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <h3 className="crud-section-title">{t('form.readiness')}</h3>
            <ul className="crud-muted">
              <li>
                {t('form.documentCount')}: {readiness.document_count}
              </li>
              <li>
                {t('form.hasCredentialDescription')}: {readiness.has_credential_description ? t('form.yes') : t('form.no')}
              </li>
              <li>
                {t('form.hasAlignmentMatrix')}: {readiness.has_alignment_matrix ? t('form.yes') : t('form.no')}
              </li>
            </ul>
          </div>
        ) : null}

        {canStatus ? (
          <form className="crud-view-actions" style={{ flexWrap: 'wrap', gap: '0.75rem' }} onSubmit={onApplyStatus}>
            <FormSelect id="next-status" label={t('form.statusChange')} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
              <option value="">{t('form.chooseStatus')}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </FormSelect>
            <button type="submit" className="btn btn--outline" disabled={!nextStatus || patchStatus.isPending}>
              {t('form.applyStatus')}
            </button>
            <p className="crud-muted" style={{ width: '100%', margin: 0 }}>
              {t('form.statusHelp')}
            </p>
            {statusErr ? (
              <p className="crud-muted" role="alert">
                {statusErr}
              </p>
            ) : null}
          </form>
        ) : null}

        <div className="crud-view-actions">
          <Link className="btn btn--outline" to={`${base}/recognition-requests`}>
            {tCommon('actions.backToList')}
          </Link>
        </div>
      </SectionCard>

      <SectionCard title={t('form.documentsTitle')}>
        {docsLoading ? <p className="crud-muted">{tCommon('loading')}</p> : null}
        {docErr ? (
          <p className="crud-muted" role="alert">
            {docErr}
          </p>
        ) : null}
        <DataTable emptyTitle={t('list.emptyTitle')} emptyDescription={t('list.emptyDescription')} columns={documentColumns} rows={docRows} />

        {canWrite ? (
          <form className="crud-form-grid" style={{ marginTop: '1rem' }} onSubmit={editingDocumentId ? onSaveDocumentEdit : onAddDocument}>
            <FormSelect
              id="doc-type"
              label={t('form.documentType')}
              value={docForm.document_type}
              onChange={(e) => setDocForm((f) => ({ ...f, document_type: e.target.value }))}
            >
              {DOC_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {t(`documentTypes.${dt}`)}
                </option>
              ))}
            </FormSelect>
            <div className="form-field">
              <label className="form-field__label" htmlFor="doc-title">
                {t('form.documentTitle')}
              </label>
              <input
                id="doc-title"
                className="form-field__control"
                value={docForm.title}
                onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="doc-url">
                {t('form.fileUrl')}
              </label>
              <input
                id="doc-url"
                className="form-field__control"
                value={docForm.file_url}
                onChange={(e) => setDocForm((f) => ({ ...f, file_url: e.target.value }))}
              />
            </div>
            <div className="crud-view-actions" style={{ gap: '0.5rem' }}>
              <button type="submit" className="btn btn--primary" disabled={createDoc.isPending || updateDoc.isPending}>
                {editingDocumentId ? t('form.updateDocument') : t('form.addDocument')}
              </button>
              {editingDocumentId ? (
                <button type="button" className="btn btn--outline" onClick={onCancelEditDocument}>
                  {t('form.cancel')}
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </SectionCard>
    </div>
  );
}
