import { useQuery } from '@tanstack/react-query';
import { fetchActiveAttendanceWindows } from '../fieldTraining.service.js';

export const ACTIVE_ATTENDANCE_WINDOW_KEY = ['fieldTraining', 'attendance-window', 'active'];

const IDLE_POLL_MS = 20_000;
const ACTIVE_POLL_MS = 8_000;

/**
 * Shared student poll for open attendance windows.
 * Slow when idle; faster only while a window is open; paused when the tab is hidden.
 */
export function useActiveAttendanceWindows(options = {}) {
  return useQuery({
    queryKey: ACTIVE_ATTENDANCE_WINDOW_KEY,
    queryFn: fetchActiveAttendanceWindows,
    staleTime: IDLE_POLL_MS,
    refetchInterval: (query) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return false;
      }
      const windows = query.state.data?.windows ?? [];
      return windows.length ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    },
    refetchIntervalInBackground: false,
    retry: false,
    ...options,
  });
}
