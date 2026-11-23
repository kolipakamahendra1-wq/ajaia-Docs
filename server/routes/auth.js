import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errors.js';
import { requireObjectBody, parseEmail } from '../middleware/validate.js';
import { signToken, verifyCredentials, toPublicUser } from '../services/auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const body = requireObjectBody(req.body);
    const email = parseEmail(body.email);
    if (typeof body.password !== 'string' || body.password.length === 0 || body.password.length > 200) {
      throw new AppError(400, 'Password is required');
    }

    const user = await verifyCredentials(req.app.locals.db, email, body.password);
    if (!user) throw new AppError(401, 'Invalid email or password');

    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// Tokens are stateless JWTs; the client discards its token. Documented in ARCHITECTURE.md.
router.post('/logout', (req, res) => {
  res.status(204).end();
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

export default router;
