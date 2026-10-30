import type { InvoiceStatus } from '../types';

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  SUBMITTED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
};

interface StatusBadgeProps {
  status: InvoiceStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}
