import { Role } from '@credit-core/shared';

export const roleTone: Record<Role, string> = {
  [Role.OPERATOR]: 'bg-brand-600',
  [Role.MODERATOR]: 'bg-warning-600',
  [Role.DIRECTOR]: 'bg-violet-600',
  [Role.ADMIN]: 'bg-gray-800 dark:bg-gray-600',
  [Role.COLLECTOR]: 'bg-emerald-600',
};

export const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
