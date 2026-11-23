import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';

// Compared against when the email is unknown, so login timing does not reveal which emails exist.
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8.4k0Zl8Y6T0CO0f0V9yYc0sHeAA0W';

export function signToken(user) {
  return jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
}

export function toPublicUser(row) {
  return { id: row.id, email: row.email, name: row.name };
}

export async function findUserById(db, id) {
  const result = await db.execute({
    sql: 'SELECT id, email, name FROM users WHERE id = ?',
    args: [Number(id)],
  });
  return result.rows[0] ?? null;
}

export async function verifyCredentials(db, email, password) {
  const result = await db.execute({
    sql: 'SELECT id, email, name, password_hash FROM users WHERE email = ?',
    args: [email],
  });
  const row = result.rows[0];
  const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  return row && ok ? toPublicUser(row) : null;
}

export async function findUserByEmail(db, email) {
  const result = await db.execute({
    sql: 'SELECT id, email, name FROM users WHERE email = ?',
    args: [email],
  });
  return result.rows[0] ?? null;
}
