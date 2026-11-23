import { AppError } from './errors.js';
import { getDocumentWithRole } from '../services/documents.js';

/**
 * Resolves the caller's role on :id. Returns 404 when the caller has no access,
 * so the existence of other users' documents is not revealed.
 * Sets req.document (row) and req.docRole: 'owner' | 'editor' | 'viewer'.
 */
export async function loadDocumentAccess(req, res, next) {
  try {
    const found = await getDocumentWithRole(req.app.locals.db, req.params.id, req.user.id);
    if (!found) throw new AppError(404, 'Document not found');
    req.document = found.document;
    req.docRole = found.role;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireOwner(req, res, next) {
  if (req.docRole !== 'owner') {
    return next(new AppError(403, 'Only the document owner can do this'));
  }
  next();
}

export function requireWriter(req, res, next) {
  if (req.docRole !== 'owner' && req.docRole !== 'editor') {
    return next(new AppError(403, 'You have view-only access to this document'));
  }
  next();
}
