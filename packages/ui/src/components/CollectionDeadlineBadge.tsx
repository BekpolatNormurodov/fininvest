import { collectionDaysLeft } from '@credit-core/shared';
import { cn } from '../lib/cn';

/**
 * The undiruv deadline as a coloured chip: grey while there's time, amber within a day, red once
 * overdue. Renders nothing for a closed collection or when there is no deadline.
 */
export function CollectionDeadlineBadge({ deadlineAt, closed }: { deadlineAt: string | null; closed?: boolean }) {
  if (closed || !deadlineAt) return null;
  const left = collectionDaysLeft(deadlineAt);
  if (left === null) return null;

  const overdue = left < 0;
  const soon = left >= 0 && left <= 1;
  const tone = overdue
    ? 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400'
    : soon
      ? 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400'
      : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300';
  const text = overdue
    ? `${Math.abs(left)} kun kechikdi`
    : left === 0
      ? 'Bugun tugaydi'
      : `${left} kun qoldi`;

  return <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', tone)}>{text}</span>;
}
