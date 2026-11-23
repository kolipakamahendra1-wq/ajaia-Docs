import { Router } from 'express';
import { requireOwner } from '../middleware/access.js';
import { AppError } from '../middleware/errors.js';
import {
  requireObjectBody,
  parseEmail,
  parseRole,
  parseUserId,
} from '../middleware/validate.js';
import { findUserByEmail } from '../services/auth.js';
import { listShares, upsertShare, deleteShare } from '../services/documents.js';

// Mounted at /api/documents/:id/shares. Access middleware has already run (req.document, req.docRole).
const router = Router({ mergeParams: true });

router.use(requireOwner);

router.get('/', async (req, res, next) => {
  try {
    res.json({ shares: await listShares(req.app.locals.db, req.document.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const body = requireObjectBody(req.body);
    const email = parseEmail(body.email);
    const role = parseRole(body.role);

    const target = await findUserByEmail(db, email);
    if (!target) throw new AppError(404, 'No registered user with that email');
    if (target.id === req.document.owner_id) {
      throw new AppError(400, 'The owner already has full access');
    }

    await upsertShare(db, req.document.id, target.id, role);
    const shares = await listShares(db, req.document.id);
    const share = shares.find((s) => s.userId === target.id);
    res.status(201).json({ share });
  } catch (err) {
    next(err);
  }
});

router.delete('/:userId', async (req, res, next) => {
  try {
    const userId = parseUserId(req.params.userId);
    const removed = await deleteShare(req.app.locals.db, req.document.id, userId);
    if (!removed) throw new AppError(404, 'That user does not have access to this document');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
