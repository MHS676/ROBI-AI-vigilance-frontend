import { cn } from '@/lib/utils';
import type { DeviceStatus } from '@/types';

type BadgeStatus = DeviceStatus | 'ACTIVE' | 'INACTIVE';

interface BadgeProps {
  status: BadgeStatus;
  className?: string;
}

const STATUS_MAP: Record<
  BadgeStatus,
  { dot: string; text: string; bg: string; label: string }
> = {
  ONLINE:      { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Online' },
  OFFLINE:     { dot: 'bg-red-400',     text: 'text-red-400',     bg: 'bg-red-400/10',     label: 'Offline' },
  MAINTENANCE: { dot: 'bg-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-400/10',   label: 'Maintenance' },
  ACTIVE:      { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Active' },
  INACTIVE:    { dot: 'bg-slate-500',   text: 'text-slate-400',   bg: 'bg-slate-500/10',   label: 'Inactive' },
};

export default function Badge({ status, className }: BadgeProps) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.OFFLINE;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        s.text,
        s.bg,
        'border-current/20',
        className,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.dot)} />
      {s.label}
    </span>
  );
}
