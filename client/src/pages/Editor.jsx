import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ArrowLeft, Save, Share2 } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import { useAutosave } from '../hooks/useAutosave.js';
import { useToast } from '../context/ToastContext.jsx';
import { ROLE_LABEL } from '../services/format.js';
import { Button, EmptyState, ErrorState, RoleBadge, Spinner } from '../components/ui.jsx';
import Toolbar from '../components/Toolbar.jsx';
import SaveStatus from '../components/SaveStatus.jsx';
import ShareModal from '../components/ShareModal.jsx';

function DocumentEditor({ doc }) {
  const toast = useToast();
  const canEdit = doc.role !== 'viewer';
  const isOwner = doc.role === 'owner';
  const [title, setTitle] = useState(doc.title);
  const [shareOpen, setShareOpen] = useState(false);
  const savedTitle = useRef(doc.title);

  const onSave = useCallback(
    async (changes) => {
      try {
        const updated = await api.updateDocument(doc.id, changes);
        savedTitle.current = updated.title;
      } catch (err) {
        toast.error(errorMessage(err, 'Could not save your changes.'));
        throw err;
      }
    },
    [doc.id, toast],
  );

  const { status, lastSavedAt, markDirty, saveNow } = useAutosave({ onSave });

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false })],
    content: doc.content,
    editable: canEdit,
    editorProps: { attributes: { class: 'doc-content', 'aria-label': 'Document content' } },
    onUpdate: ({ editor: e }) => markDirty({ content: e.getJSON() }),
  });

  const manualSave = useCallback(async () => {
    if (!canEdit) return;
    const ok = await saveNow();
    if (ok) toast.success('All changes saved.');
  }, [canEdit, saveNow, toast]);

  // Ctrl/Cmd+S saves immediately instead of opening the browser's "save page" dialog.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        manualSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manualSave]);

  // Warn before closing the tab while changes have not reached the server.
  useEffect(() => {
    if (status === 'saved') return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  useEffect(() => {
    document.title = `${title.trim() || 'Untitled'} · Ajaia Docs`;
    return () => {
      document.title = 'Ajaia Docs';
    };
  }, [title]);

  const onTitleChange = (e) => {
    setTitle(e.target.value);
    if (e.target.value.trim()) markDirty({ title: e.target.value.trim() });
  };

  const onTitleBlur = () => {
    if (!title.trim()) setTitle(savedTitle.current);
  };

  const focusEndOnBackgroundClick = (e) => {
    if (e.target === e.currentTarget) editor?.commands.focus('end');
  };

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">
          <Link
            to={isOwner ? '/app/documents' : '/app/shared'}
            className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100"
            aria-label="Back to documents"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <label htmlFor="doc-title" className="sr-only">
            Document title
          </label>
          <input
            id="doc-title"
            value={title}
            onChange={onTitleChange}
            onBlur={onTitleBlur}
            readOnly={!canEdit}
            maxLength={200}
            placeholder="Untitled document"
            className="min-w-[8rem] flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-lg font-semibold text-zinc-900 hover:border-zinc-200 focus:border-blue-600 read-only:hover:border-transparent"
          />
          <div className="flex items-center gap-3">
            {!isOwner && <RoleBadge role={doc.role} label={ROLE_LABEL[doc.role]} />}
            <SaveStatus status={status} lastSavedAt={lastSavedAt} readOnly={!canEdit} />
            {canEdit && (
              <Button onClick={manualSave} disabled={status === 'saving'}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Save
              </Button>
            )}
            {isOwner && (
              <Button variant="primary" onClick={() => setShareOpen(true)}>
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share
              </Button>
            )}
          </div>
        </div>
        {canEdit && editor && (
          <div className="mx-auto max-w-5xl px-3 pb-2.5 sm:px-4">
            <Toolbar editor={editor} disabled={!canEdit} />
          </div>
        )}
      </header>

      {!canEdit && (
        <p className="mx-auto mt-4 max-w-3xl rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800" role="note">
          You have view-only access to this document, shared by {doc.ownerName}.
        </p>
      )}

      <main className="px-3 pb-16 sm:px-4">
        <div
          onClick={focusEndOnBackgroundClick}
          className="mx-auto my-6 min-h-[70vh] max-w-3xl cursor-text rounded-lg bg-white px-5 py-8 shadow-sm ring-1 ring-zinc-200 sm:px-14 sm:py-14"
        >
          <EditorContent editor={editor} />
        </div>
      </main>

      {shareOpen && <ShareModal document={doc} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

export default function Editor() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setFailure(null);
    api
      .getDocument(id)
      .then((loaded) => !cancelled && setDoc(loaded))
      .catch((err) => {
        if (cancelled) return;
        setFailure({ notFound: err.response?.status === 404, message: errorMessage(err, 'Could not open this document.') });
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (failure?.notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <EmptyState
          title="Document not found"
          description="It may have been deleted, or you may not have access to it."
        >
          <Link
            to="/app/documents"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Back to my documents
          </Link>
        </EmptyState>
      </div>
    );
  }
  if (failure) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <ErrorState message={failure.message} onRetry={() => setAttempt((n) => n + 1)} />
      </div>
    );
  }
  if (!doc) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Opening document" />
      </div>
    );
  }
  return <DocumentEditor key={doc.id} doc={doc} />;
}
