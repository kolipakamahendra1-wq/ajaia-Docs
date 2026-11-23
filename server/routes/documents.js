import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../middleware/auth.js';
import { loadDocumentAccess, requireOwner, requireWriter } from '../middleware/access.js';
import { AppError } from '../middleware/errors.js';
import {
  requireObjectBody,
  parseDocumentId,
  parseTitle,
  parseDocumentContent,
} from '../middleware/validate.js';
import {
  EMPTY_DOC,
  listDocumentsForUser,
  insertDocument,
  updateDocument,
  deleteDocument,
  getDocumentWithRole,
  toDetail,
} from '../services/documents.js';
import sharesRouter from './shares.js';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
    const lists = await listDocumentsForUser(req.app.locals.db, req.user.id, search);
    res.json(lists);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = requireObjectBody(req.body ?? {});
    const title = body.title === undefined ? 'Untitled document' : parseTitle(body.title);
    const content = body.content === undefined ? EMPTY_DOC : parseDocumentContent(body.content);
    const id = randomUUID();

    await insertDocument(req.app.locals.db, { id, ownerId: req.user.id, title, content });
    const found = await getDocumentWithRole(req.app.locals.db, id, req.user.id);
    res.status(201).json({ document: toDetail(found.document, found.role) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', parseIdParam, loadDocumentAccess, (req, res) => {
  res.json({ document: toDetail(req.document, req.docRole) });
});

router.put('/:id', parseIdParam, loadDocumentAccess, requireWriter, async (req, res, next) => {
  try {
    const body = requireObjectBody(req.body);
    const changes = {};
    if (body.title !== undefined) changes.title = parseTitle(body.title);
    if (body.content !== undefined) changes.content = parseDocumentContent(body.content);
    if (Object.keys(changes).length === 0) {
      throw new AppError(400, 'Nothing to update: send title and/or content');
    }

    const db = req.app.locals.db;
    await updateDocument(db, req.document.id, changes);
    const found = await getDocumentWithRole(db, req.document.id, req.user.id);
    res.json({ document: toDetail(found.document, found.role) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', parseIdParam, loadDocumentAccess, requireOwner, async (req, res, next) => {
  try {
    await deleteDocument(req.app.locals.db, req.document.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.use('/:id/shares', parseIdParam, loadDocumentAccess, sharesRouter);

/** Validates :id before any database lookup. Malformed ids get the same 404 as missing ones. */
function parseIdParam(req, res, next) {
  try {
    req.params.id = parseDocumentId(req.params.id);
    next();
  } catch (err) {
    next(err);
  }
}

export default router;
