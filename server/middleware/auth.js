import { AppError } from './errors.js';
import { verifyToken, findUserById } from '../services/auth.js';

/** Requires a valid Bearer JWT and a user that still exists. Sets req.user. */
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) throw new AppError(401, 'Authentication required');

    let payload;
    try {
      payload = verifyToken(match[1]);
    } catch {
      throw new AppError(401, 'Session is invalid or expired');
    }

    const user = await findUserById(req.app.locals.db, payload.sub);
    if (!user) throw new AppError(401, 'Session is invalid or expired');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
