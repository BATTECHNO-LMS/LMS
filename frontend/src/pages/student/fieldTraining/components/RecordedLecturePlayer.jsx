import { useTranslation } from 'react-i18next';
import { YouTubeRecordedLecturePlayer } from './YouTubeRecordedLecturePlayer.jsx';

export function RecordedLecturePlayer({ lecture, startSeconds = 0, onPlaybackEvent, seekApiRef }) {
  const { t } = useTranslation('fieldTraining');
  const provider = String(lecture?.provider || '').toUpperCase();
  const videoId = lecture?.providerVideoId || lecture?.provider_video_id;

  if (provider === 'YOUTUBE' && videoId) {
    return (
      <YouTubeRecordedLecturePlayer
        videoId={videoId}
        startSeconds={startSeconds}
        title={lecture?.title}
        onPlaybackEvent={onPlaybackEvent}
        seekApiRef={seekApiRef}
      />
    );
  }

  return (
    <div className="ft-recorded-player__unsupported" role="status">
      {t('recordedLectures.studentWatch.providerUnsupported')}
    </div>
  );
}
