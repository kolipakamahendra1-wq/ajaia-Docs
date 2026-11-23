import { useState } from 'react';
import { Button, Modal, inputClass } from './ui.jsx';

/** Rename dialog. onSubmit may be async; the dialog closes when it resolves. */
export function RenameDialog({ document, onClose, onSubmit }) {
  const [title, setTitle] = useState(document.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const next = title.trim();
    if (!next) return setError('Title cannot be empty.');
    if (next === document.title) return onClose();
    setBusy(true);
    setError('');
    try {
      await onSubmit(next);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not rename the document.');
      setBusy(false);
    }
  };

  return (
    <Modal title="Rename document" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <label htmlFor="rename-title" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Title
        </label>
        <input
          id="rename-title"
          className={inputClass}
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'rename-error' : undefined}
        />
        {error && (
          <p id="rename-error" role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>
            Rename
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ConfirmDeleteDialog({ document, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not delete the document.');
      setBusy(false);
    }
  };

  return (
    <Modal title="Delete document" onClose={onClose}>
      <p className="text-sm text-zinc-600">
        <strong className="font-semibold text-zinc-900">{document.title}</strong> will be permanently deleted for you and
        everyone it is shared with. This cannot be undone.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={confirm} loading={busy}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}
