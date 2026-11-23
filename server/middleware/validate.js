import { AppError } from './errors.js';

export const ROLES = ['viewer', 'editor'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_TITLE = 200;
export const MAX_CONTENT_CHARS = 1_000_000;

export function requireObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'Request body must be a JSON object');
  }
  return body;
}

export function parseDocumentId(value) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new AppError(404, 'Document not found');
  }
  return value;
}

export function parseUserId(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new AppError(400, 'Invalid user id');
  return n;
}

export function parseTitle(value) {
  if (typeof value !== 'string') throw new AppError(400, 'Title must be a string');
  const title = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!title) throw new AppError(400, 'Title cannot be empty');
  if (title.length > MAX_TITLE) throw new AppError(400, `Title must be ${MAX_TITLE} characters or fewer`);
  return title;
}

export function parseEmail(value) {
  if (typeof value !== 'string') throw new AppError(400, 'Email is required');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new AppError(400, 'Enter a valid email address');
  return email;
}

export function parseRole(value) {
  if (!ROLES.includes(value)) throw new AppError(400, 'Role must be "viewer" or "editor"');
  return value;
}

/** Structural check for TipTap/ProseMirror JSON. React renders it as text, never as raw HTML. */
export function parseDocumentContent(value) {
  const isDoc = value && typeof value === 'object' && !Array.isArray(value)
    && value.type === 'doc' && Array.isArray(value.content);
  if (!isDoc) throw new AppError(400, 'Content must be a TipTap document object');
  if (JSON.stringify(value).length > MAX_CONTENT_CHARS) throw new AppError(413, 'Document is too large');
  return value;
}
