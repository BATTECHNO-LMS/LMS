import { useMemo } from 'react';
import { EyeOff, GripVertical, Pencil, Send, Undo2, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { RecordedLectureEditor } from './RecordedLectureEditor.jsx';
import {
  formatLectureDuration,
  lectureStatusKey,
  lectureStatusVariant,
  moveLecture,
} from './recordedLectureOrder.js';

function SortableLectureCard({
  lecture,
  canManage,
  editing,
  sessions,
  asInstructor,
  onEdit,
  onCloseEdit,
  onSaved,
  onPublish,
  onHide,
  onDraft,
  busy,
}) {
  const { t } = useTranslation('fieldTraining');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lecture.id,
    disabled: !canManage,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const sourceKey = String(lecture.source_type || 'SINGLE').toLowerCase() === 'playlist' ? 'playlist' : 'single';
  const status = lectureStatusKey(lecture.status);

  return (
    <li ref={setNodeRef} style={style} className={`ft-recorded-row${isDragging ? ' is-dragging' : ''}`}>
      <article className="ft-recorded-card">
        {canManage ? (
          <button
            type="button"
            className="ft-recorded-card__handle"
            aria-label={t('recordedLectures.dragHandle')}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} aria-hidden />
          </button>
        ) : (
          <span className="ft-recorded-card__handle is-static" aria-hidden>
            <GripVertical size={18} />
          </span>
        )}
        {lecture.thumbnail_url ? (
          <img src={lecture.thumbnail_url} alt="" className="ft-recorded-card__thumb" />
        ) : (
          <div className="ft-recorded-card__thumb ft-recorded-card__thumb--empty">
            <Video size={20} />
          </div>
        )}
        <div className="ft-recorded-card__body">
          <h3>{lecture.title}</h3>
          <p>
            {formatLectureDuration(lecture.duration_seconds)} · {t('recordedLectures.providerYoutube')} ·{' '}
            {t(`recordedLectures.source.${sourceKey}`)}
            {lecture.session?.title ? ` · ${lecture.session.title}` : ''}
          </p>
        </div>
        <StatusBadge variant={lectureStatusVariant(lecture.status)}>
          {t(`recordedLectures.status.${status}`)}
        </StatusBadge>
        {canManage ? (
          <div className="ft-recorded-card__actions">
            {status !== 'published' ? (
              <Button type="button" size="sm" disabled={busy} onClick={() => onPublish(lecture)}>
                <Send size={14} aria-hidden /> {t('recordedLectures.publish')}
              </Button>
            ) : null}
            {status !== 'hidden' ? (
              <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => onHide(lecture)}>
                <EyeOff size={14} aria-hidden /> {t('recordedLectures.hide')}
              </Button>
            ) : null}
            {status !== 'draft' ? (
              <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => onDraft(lecture)}>
                <Undo2 size={14} aria-hidden /> {t('recordedLectures.restoreDraft')}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={editing ? 'primary' : 'secondary'}
              onClick={() => (editing ? onCloseEdit() : onEdit(lecture.id))}
            >
              <Pencil size={14} aria-hidden /> {t('edit')}
            </Button>
          </div>
        ) : null}
      </article>
      {editing ? (
        <RecordedLectureEditor
          lecture={lecture}
          sessions={sessions}
          asInstructor={asInstructor}
          onClose={onCloseEdit}
          onSaved={onSaved}
        />
      ) : null}
    </li>
  );
}

export function RecordedLecturesSortableList({
  lectures,
  canManage,
  editingId,
  sessions,
  asInstructor,
  onEdit,
  onCloseEdit,
  onSaved,
  onPublish,
  onHide,
  onDraft,
  onReorder,
  busy,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = useMemo(() => lectures.map((lecture) => lecture.id), [lectures]);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!canManage || !over || active.id === over.id) return;
    const from = lectures.findIndex((lecture) => lecture.id === active.id);
    const to = lectures.findIndex((lecture) => lecture.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(moveLecture(lectures, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="ft-recorded-list">
          {lectures.map((lecture) => (
            <SortableLectureCard
              key={lecture.id}
              lecture={lecture}
              canManage={canManage}
              editing={editingId === lecture.id}
              sessions={sessions}
              asInstructor={asInstructor}
              onEdit={onEdit}
              onCloseEdit={onCloseEdit}
              onSaved={onSaved}
              onPublish={onPublish}
              onHide={onHide}
              onDraft={onDraft}
              busy={busy}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
