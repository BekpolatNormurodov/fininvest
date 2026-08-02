import { LETTER_TYPE_LABEL, LetterType, type VisitDto } from '@credit-core/shared';
import { api } from '@credit-core/api-client';
import { Location, Camera, FileText } from '../lib/icons';
import { formatMoney } from '../lib/cn';

/**
 * Read-only history of a collection's field visits — how many times, when, by whom, how much was
 * collected, which letter was served, and any photo/video evidence. Shown to admin/operator/director.
 */
export function CollectionVisits({ visits }: { visits: VisitDto[] }) {
  if (!visits.length) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Hali tashrif yo‘q.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Tashriflar tarixi — {visits.length} marta
      </p>
      <ol className="space-y-2.5">
        {visits.map((v) => (
          <li key={v.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-white">
                {v.amount > 0 ? formatMoney(v.amount) : (LETTER_TYPE_LABEL[v.letterType] ?? '—')}
              </span>
              <span className="whitespace-nowrap text-xs text-gray-400">
                {new Date(v.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              {v.collectorName && <span>{v.collectorName}</span>}
              {v.letterType !== LetterType.NONE && (
                <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {LETTER_TYPE_LABEL[v.letterType]}</span>
              )}
              {v.lat != null && v.lng != null && (
                <a
                  className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
                  href={`https://www.google.com/maps?q=${v.lat},${v.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Location className="h-3.5 w-3.5" /> joylashuv
                </a>
              )}
            </div>
            {v.comment && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{v.comment}</p>}
            {v.media.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {v.media.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => api.viewVisitMedia(m.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/10"
                  >
                    <Camera className="h-3.5 w-3.5" /> {m.kind === 'video' ? 'Video' : 'Rasm'} {i + 1}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
