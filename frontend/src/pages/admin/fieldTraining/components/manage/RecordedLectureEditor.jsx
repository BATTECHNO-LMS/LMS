import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { FormInput } from '../../../../../components/forms/FormInput.jsx';
import { FormSelect } from '../../../../../components/forms/FormSelect.jsx';
import { FormTextarea } from '../../../../../components/forms/FormTextarea.jsx';
import { updateRecordedLecture } from '../../../../../features/fieldTraining/index.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';

function lectureToForm(lecture) {
  return {
    title: lecture.title || '',
    description: lecture.description || '',
    lecture_date: lecture.lecture_date || '',
    instructor_name: lecture.instructor_name || '',
    session_id: lecture.session_id || '',
    status: String(lecture.status || 'DRAFT').toUpperCase(),
  };
}

export function RecordedLectureEditor({
  lecture,
  sessions = [],
  asInstructor,
  onClose,
  onSaved,
}) {
  const { t } = useTranslation('fieldTraining');
  const [form, setForm] = useState(() => lectureToForm(lecture));
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(lectureToForm(lecture));
    setError('');
  }, [lecture]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateRecordedLecture(
        lecture.id,
        {
          title: form.title.trim(),
          description: form.description.trim() || null,
          lecture_date: form.lecture_date || null,
          instructor_name: form.instructor_name.trim() || null,
          session_id: form.session_id || null,
          status: form.status,
        },
        { asInstructor }
      ),
    onSuccess: () => {
      onSaved?.();
      onClose?.();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      className="ft-recorded-editor"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.title.trim()) {
          setError(t('recordedLectures.titleRequired'));
          return;
        }
        saveMut.mutate();
      }}
    >
      {error ? <p className="form-field__error">{error}</p> : null}
      <FormInput
        label={t('recordedLectures.editTitle')}
        value={form.title}
        onChange={(e) => setField('title', e.target.value)}
        required
      />
      <FormTextarea
        label={t('recordedLectures.editDescription')}
        value={form.description}
        rows={4}
        onChange={(e) => setField('description', e.target.value)}
      />
      <div className="ft-recorded-editor__grid">
        <FormInput
          type="date"
          label={t('recordedLectures.lectureDate')}
          value={form.lecture_date}
          onChange={(e) => setField('lecture_date', e.target.value)}
        />
        <FormInput
          label={t('recordedLectures.instructorName')}
          value={form.instructor_name}
          onChange={(e) => setField('instructor_name', e.target.value)}
        />
      </div>
      <FormSelect
        label={t('recordedLectures.linkedSession')}
        value={form.session_id}
        onChange={(e) => setField('session_id', e.target.value)}
      >
        <option value="">{t('recordedLectures.noSession')}</option>
        {sessions.map((session) => (
          <option key={session.id} value={session.id}>
            {session.title}
          </option>
        ))}
      </FormSelect>
      <FormSelect
        label={t('recordedLectures.publicationStatus')}
        value={form.status}
        onChange={(e) => setField('status', e.target.value)}
      >
        <option value="DRAFT">{t('recordedLectures.status.draft')}</option>
        <option value="PUBLISHED">{t('recordedLectures.status.published')}</option>
        <option value="HIDDEN">{t('recordedLectures.status.hidden')}</option>
      </FormSelect>
      <div className="ft-manage-panel__head-actions">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saveMut.isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={saveMut.isPending}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
