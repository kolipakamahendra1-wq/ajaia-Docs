import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { FilePlus2, FileUp } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useToast } from '../context/ToastContext.jsx';
import { ROLE_LABEL, timeAgo } from '../services/format.js';
import { Button, EmptyState, ErrorState, RoleBadge, Spinner } from '../components/ui.jsx';
import DocumentList from '../components/DocumentList.jsx';
import { ConfirmDeleteDialog, RenameDialog } from '../components/Dialogs.jsx';

const ALLOWED_EXTENSIONS = ['.txt', '.md', '.docx'];
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

function RecentCard({ doc }) {
  return (
    <Link
      to={`/app/doc/${doc.id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
    >
      <p className="truncate text-sm font-medium text-zinc-900">{doc.title}</p>
      <p className="mt-1 truncate text-xs text-zinc-500">
        {doc.role === 'owner' ? 'You' : doc.ownerName} · {timeAgo(doc.updatedAt)}
      </p>
      {doc.role !== 'owner' && (
        <div className="mt-2">
          <RoleBadge role={doc.role} label={ROLE_LABEL[doc.role]} />
        </div>
      )}
    </Link>
  );
}

export default function Dashboard({ view }) {
  const { search } = useOutletContext();
  const query = useDebounce(search.trim(), 300);
  const navigate = useNavigate();
  const toast = useToast();
  const fileInput = useRef(null);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError('');
    api
      .listDocuments(query)
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(errorMessage(err, 'Could not load your documents.')));
    return () => {
      cancelled = true;
    };
  }, [query, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const createDocument = async () => {
    setCreating(true);
    try {
      const doc = await api.createDocument();
      navigate(`/app/doc/${doc.id}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create the document.'));
      setCreating(false);
    }
  };

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;

    const dot = file.name.lastIndexOf('.');
    const ext = dot < 0 ? '' : file.name.slice(dot).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) return toast.error('Unsupported file type. Upload a .txt, .md or .docx file.');
    if (file.size === 0) return toast.error('That file is empty.');
    if (file.size > MAX_UPLOAD_BYTES) return toast.error('File is too large. The limit is 2 MB.');

    setUploading(true);
    try {
      const doc = await api.uploadFile(file);
      toast.success(`Imported "${doc.title}". You can edit it now.`);
      navigate(`/app/doc/${doc.id}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed.'));
      setUploading(false);
    }
  };

  const renameDocument = async (title) => {
    try {
      await api.updateDocument(renaming.id, { title });
      toast.success('Document renamed.');
      reload();
    } catch (err) {
      throw new Error(errorMessage(err, 'Could not rename the document.'));
    }
  };

  const deleteDocument = async () => {
    try {
      await api.deleteDocument(deleting.id);
      toast.success('Document deleted.');
      reload();
    } catch (err) {
      throw new Error(errorMessage(err, 'Could not delete the document.'));
    }
  };

  const isMine = view === 'mine';
  const documents = data ? (isMine ? data.owned : data.shared) : [];
  const recent =
    data && isMine && !query
      ? [...data.owned, ...data.shared].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
      : [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {isMine ? 'My documents' : 'Shared with me'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isMine ? 'Documents you own, most recently updated first.' : 'Documents other people have shared with you.'}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.md,.docx"
            className="hidden"
            onChange={onFileChosen}
            aria-label="Upload a TXT, MD or DOCX file"
            tabIndex={-1}
          />
          <Button onClick={() => fileInput.current?.click()} loading={uploading}>
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Upload
          </Button>
          <Button variant="primary" onClick={createDocument} loading={creating}>
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            New document
          </Button>
        </div>
      </div>

      {recent.length > 0 && (
        <section className="mt-8" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="mb-3 text-sm font-semibold text-zinc-700">
            Recent
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((doc) => (
              <RecentCard key={doc.id} doc={doc} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8" aria-label={isMine ? 'My documents' : 'Shared with me'}>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data === null ? (
          <Spinner label="Loading documents" />
        ) : documents.length === 0 ? (
          query ? (
            <EmptyState title="No matching documents" description={`Nothing matches "${query}". Try a different title.`} />
          ) : isMine ? (
            <EmptyState title="No documents yet" description="Create a blank document or import a .txt, .md or .docx file.">
              <Button variant="primary" onClick={createDocument} loading={creating}>
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                New document
              </Button>
              <Button onClick={() => fileInput.current?.click()}>
                <FileUp className="h-4 w-4" aria-hidden="true" />
                Upload a file
              </Button>
            </EmptyState>
          ) : (
            <EmptyState
              title="Nothing shared with you yet"
              description="When someone shares a document with you, it will show up here."
            />
          )
        ) : (
          <DocumentList documents={documents} showOwner={!isMine} onRename={setRenaming} onDelete={setDeleting} />
        )}
      </section>

      {renaming && <RenameDialog document={renaming} onClose={() => setRenaming(null)} onSubmit={renameDocument} />}
      {deleting && (
        <ConfirmDeleteDialog document={deleting} onClose={() => setDeleting(null)} onConfirm={deleteDocument} />
      )}
    </div>
  );
}
