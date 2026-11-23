import { Link } from 'react-router-dom';
import { FileText, Pencil, Trash2 } from 'lucide-react';
import { RoleBadge } from './ui.jsx';
import { ROLE_LABEL, fullDate, timeAgo } from '../services/format.js';

/** Table-like list that collapses to stacked rows on small screens. */
export default function DocumentList({ documents, showOwner = false, onRename, onDelete }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div
        className={`hidden items-center gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500 sm:grid ${
          showOwner ? 'sm:grid-cols-[1fr_9rem_7rem_8rem_4.5rem]' : 'sm:grid-cols-[1fr_9rem_8rem_4.5rem]'
        }`}
      >
        <span>Title</span>
        <span>Owner</span>
        {showOwner && <span>Access</span>}
        <span>Last updated</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul className="divide-y divide-zinc-100">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className={`group grid items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-zinc-50 ${
              showOwner ? 'sm:grid-cols-[1fr_9rem_7rem_8rem_4.5rem]' : 'sm:grid-cols-[1fr_9rem_8rem_4.5rem]'
            }`}
          >
            <Link to={`/app/doc/${doc.id}`} className="flex min-w-0 items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden="true" />
              <span className="truncate text-sm font-medium text-zinc-900">{doc.title}</span>
            </Link>
            <span className="truncate pl-8 text-sm text-zinc-600 sm:pl-0">
              <span className="sm:hidden">Owner: </span>
              {doc.ownerName}
            </span>
            {showOwner && (
              <span className="pl-8 sm:pl-0">
                <RoleBadge role={doc.role} label={ROLE_LABEL[doc.role]} />
              </span>
            )}
            <time className="pl-8 text-sm text-zinc-500 sm:pl-0" dateTime={doc.updatedAt} title={fullDate(doc.updatedAt)}>
              {timeAgo(doc.updatedAt)}
            </time>
            <div className="flex justify-end gap-1 pl-8 sm:pl-0">
              {doc.role !== 'viewer' && (
                <button
                  type="button"
                  onClick={() => onRename(doc)}
                  className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                  aria-label={`Rename ${doc.title}`}
                  title="Rename"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {doc.role === 'owner' && (
                <button
                  type="button"
                  onClick={() => onDelete(doc)}
                  className="rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Delete ${doc.title}`}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
