import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, Modal, Spinner, inputClass } from './ui.jsx';

function Avatar({ name }) {
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700"
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function ShareModal({ document, onClose }) {
  const toast = useToast();
  const [shares, setShares] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    setLoadError('');
    api
      .listShares(document.id)
      .then(setShares)
      .catch((err) => setLoadError(errorMessage(err, 'Could not load collaborators.')));
  }, [document.id]);

  useEffect(load, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setFormError('Enter the email of a registered user.');
    setBusy(true);
    setFormError('');
    try {
      const share = await api.addShare(document.id, email.trim(), role);
      toast.success(`Shared with ${share.name} as ${share.role === 'editor' ? 'editor' : 'viewer'}.`);
      setEmail('');
      load();
    } catch (err) {
      setFormError(errorMessage(err, 'Could not share the document.'));
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (share, nextRole) => {
    try {
      await api.addShare(document.id, share.email, nextRole);
      toast.success(`${share.name} can now ${nextRole === 'editor' ? 'edit' : 'view'} this document.`);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change permission.'));
    }
  };

  const revoke = async (share) => {
    try {
      await api.removeShare(document.id, share.userId);
      toast.success(`Removed ${share.name}'s access.`);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not revoke access.'));
    }
  };

  return (
    <Modal title="Share document" onClose={onClose} size="lg">
      <form onSubmit={submit} noValidate>
        <label htmlFor="share-email" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Add a person
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="share-email"
            type="email"
            className={inputClass}
            placeholder="name@demo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            aria-invalid={Boolean(formError)}
            aria-describedby={formError ? 'share-error' : undefined}
          />
          <label className="sr-only" htmlFor="share-role">
            Permission
          </label>
          <select
            id="share-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={`${inputClass} sm:w-32`}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <Button type="submit" variant="primary" loading={busy}>
            Share
          </Button>
        </div>
        {formError && (
          <p id="share-error" role="alert" className="mt-2 text-sm text-red-600">
            {formError}
          </p>
        )}
      </form>

      <h3 className="mb-2 mt-6 text-sm font-medium text-zinc-700">People with access</h3>
      <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
        <li className="flex items-center gap-3 px-3 py-2.5">
          <Avatar name={document.ownerName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900">{document.ownerName}</p>
            <p className="text-xs text-zinc-500">Owner</p>
          </div>
        </li>
        {shares === null && !loadError && (
          <li>
            <Spinner label="Loading collaborators" />
          </li>
        )}
        {loadError && (
          <li className="flex items-center justify-between gap-2 px-3 py-3 text-sm text-red-600">
            <span role="alert">{loadError}</span>
            <Button onClick={load}>Retry</Button>
          </li>
        )}
        {shares?.length === 0 && (
          <li className="px-3 py-3 text-sm text-zinc-500">Not shared with anyone yet.</li>
        )}
        {shares?.map((share) => (
          <li key={share.userId} className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={share.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900">{share.name}</p>
              <p className="truncate text-xs text-zinc-500">{share.email}</p>
            </div>
            <label className="sr-only" htmlFor={`role-${share.userId}`}>
              Permission for {share.name}
            </label>
            <select
              id={`role-${share.userId}`}
              value={share.role}
              onChange={(e) => changeRole(share, e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button
              type="button"
              onClick={() => revoke(share)}
              className="rounded p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
              aria-label={`Revoke access for ${share.name}`}
              title="Revoke access"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-zinc-500">
        Viewers can read. Editors can change the title and content. Only the owner can share or delete.
      </p>
    </Modal>
  );
}
