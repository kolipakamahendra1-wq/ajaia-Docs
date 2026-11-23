import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createTestContext, login, request, DEMO_PASSWORD } from './helpers.js';

describe('authentication', () => {
  let ctx;
  before(async () => {
    ctx = await createTestContext();
  });
  after(async () => {
    await ctx.close();
  });

  it('logs in seeded demo users with the correct password', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'alice@demo.com', password: DEMO_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.token, 'string');
    assert.equal(res.body.user.email, 'alice@demo.com');
    assert.equal(res.body.user.name, 'Alice');
  });

  it('never exposes password hashes or secrets in responses', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'bob@demo.com', password: DEMO_PASSWORD });
    const text = JSON.stringify(res.body);
    assert.ok(!text.includes('password'));
    assert.ok(!text.includes('$2'));
    assert.ok(!text.includes(process.env.JWT_SECRET));
  });

  it('rejects a wrong password with a generic message', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'alice@demo.com', password: 'not-the-password' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid email or password');
  });

  it('returns the same message for an unknown email (no account enumeration)', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'nobody@demo.com', password: DEMO_PASSWORD });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid email or password');
  });

  it('validates login input', async () => {
    const noPassword = await request(ctx.app).post('/api/auth/login').send({ email: 'alice@demo.com' });
    assert.equal(noPassword.status, 400);
    const badEmail = await request(ctx.app).post('/api/auth/login').send({ email: 'not-an-email', password: 'x' });
    assert.equal(badEmail.status, 400);
    const notObject = await request(ctx.app).post('/api/auth/login').set('Content-Type', 'application/json').send('"text"');
    assert.equal(notObject.status, 400);
  });

  it('returns the current user from /me with a valid token', async () => {
    const token = await login(ctx.app, 'alice@demo.com');
    const res = await request(ctx.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'alice@demo.com');
  });

  it('rejects requests without a token', async () => {
    const res = await request(ctx.app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  it('rejects a tampered token', async () => {
    const token = await login(ctx.app, 'alice@demo.com');
    const res = await request(ctx.app).get('/api/auth/me').set('Authorization', `Bearer ${token}x`);
    assert.equal(res.status, 401);
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = jwt.sign({ sub: '1' }, 'attacker-secret-attacker-secret', { algorithm: 'HS256' });
    const res = await request(ctx.app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    assert.equal(res.status, 401);
  });

  it('rejects an unsigned (alg: none) token', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: '1' })).toString('base64url');
    const res = await request(ctx.app).get('/api/auth/me').set('Authorization', `Bearer ${header}.${body}.`);
    assert.equal(res.status, 401);
  });

  it('logout succeeds and the health check reports the database', async () => {
    const logout = await request(ctx.app).post('/api/auth/logout');
    assert.equal(logout.status, 204);
    const health = await request(ctx.app).get('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.database, 'ok');
  });
});
