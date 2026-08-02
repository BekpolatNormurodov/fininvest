import { useQuery } from '@tanstack/react-query';
import { formatDuration } from '@credit-core/shared';
import { api } from '@credit-core/api-client';
import { Modal } from './Modal';
import { Clock, Location } from '../lib/icons';

/** Read-only work-shift history for one collector — when they started/finished and for how long. */
export function WorkSessionsModal({
  collector,
  onClose,
}: {
  collector: { id: string; fullName: string } | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['workSessions', collector?.id],
    queryFn: () => api.workSessions({ collectorId: collector!.id }),
    enabled: !!collector,
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const time = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <Modal open={!!collector} onClose={onClose} title="Ish vaqtlari" description={collector?.fullName}>
      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {isLoading && <p className="text-sm text-gray-400">Yuklanmoqda…</p>}
        {!isLoading && (!data || data.length === 0) && (
          <p className="text-sm text-gray-400 dark:text-gray-500">Ish vaqtlari yo‘q.</p>
        )}
        {(data ?? []).map((s) => (
          <div key={s.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-white">
                <Clock className="h-4 w-4 text-gray-400" />
                {fmt(s.startedAt)} {s.endedAt ? `– ${time(s.endedAt)}` : '– hozir'}
              </span>
              <span className={s.endedAt ? 'text-xs font-medium text-gray-500' : 'text-xs font-semibold text-success-600'}>
                {s.endedAt ? formatDuration(s.durationMin) : 'ishda'}
              </span>
            </div>
            {(s.pingCount > 0 || s.startLat != null) && (
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                {s.startLat != null && s.startLng != null && (
                  <a
                    className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
                    href={`https://www.google.com/maps?q=${s.startLat},${s.startLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Location className="h-3.5 w-3.5" /> boshlanish joyi
                  </a>
                )}
                {s.pingCount > 0 && <span>{s.pingCount} ta lokatsiya</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
