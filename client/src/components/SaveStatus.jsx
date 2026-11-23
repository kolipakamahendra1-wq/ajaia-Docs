import { AlertCircle, CheckCircle2, Eye, Loader2, PenLine } from 'lucide-react';
import { timeAgo } from '../services/format.js';

const VIEW = {
  saved: { icon: CheckCircle2, color: 'text-emerald-600', text: 'Saved' },
  saving: { icon: Loader2, color: 'text-zinc-500', text: 'Saving…', spin: true },
  unsaved: { icon: PenLine, color: 'text-amber-600', text: 'Unsaved changes' },
  error: { icon: AlertCircle, color: 'text-red-600', text: 'Save failed. Retrying on next edit' },
};

export default function SaveStatus({ status, lastSavedAt, readOnly }) {
  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
        <Eye className="h-4 w-4" aria-hidden="true" />
        View only
      </span>
    );
  }
  const v = VIEW[status];
  const Icon = v.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${v.color}`} role="status" aria-live="polite">
      <Icon className={`h-4 w-4 ${v.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span>
        {v.text}
        {status === 'saved' && lastSavedAt ? ` · ${timeAgo(lastSavedAt.toISOString())}` : ''}
      </span>
    </span>
  );
}
