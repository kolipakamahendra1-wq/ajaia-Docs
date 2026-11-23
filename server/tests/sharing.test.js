import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, login, request, sampleDoc } from './helpers.js';

describe('sharing and permission enforcement', () => {
  let ctx;
  let alice;
  let bob;
  let docId;

  const as = (token) => ({ Authorization: `Bearer ${token}` });

  before(async () => {
    ctx = await createTestContext();
    alice = await login(ctx.app, 'alice@demo.com');
    bob = await login(ctx.app, 'bob@demo.com');
    const created = await request(ctx.app)
      .post('/api/documents')
      .set(as(alice))
      .send({ title: 'Shared plan', content: sampleDoc('Original') });
    docId = created.body.document.id;
  });
  after(async () => {
    await ctx.close();
  });

  it('gives Bob no access before he is shared in', async () => {
    assert.equal((await request(ctx.app).get(`/api/documents/${docId}`).set(as(bob))).status, 404);
  });

  it('lets the owner share with a registered user as viewer', async () => {
    const res = await request(ctx.app)
      .post(`/api/documents/${docId}/shares`)
      .set(as(alice))
      .send({ email: 'BOB@demo.com', role: 'viewer' });
    assert.equal(res.status, 201);
    assert.equal(res.body.share.email, 'bob@demo.com');
    assert.equal(res.body.share.role, 'viewer');
  });

  it('shows the shared document to Bob under "shared" and marks his role', async () => {
    const res = await request(ctx.app).get('/api/documents').set(as(bob));
    assert.deepEqual(res.body.owned, []);
    assert.equal(res.body.shared.length, 1);
    assert.equal(res.body.shared[0].id, docId);
    assert.equal(res.body.shared[0].role, 'viewer');
    assert.equal(res.body.shared[0].ownerName, 'Alice');
  });

  it('lets a viewer read the document', async () => {
    const res = await request(ctx.app).get(`/api/documents/${docId}`).set(as(bob));
    assert.equal(res.status, 200);
    assert.equal(res.body.document.role, 'viewer');
    assert.deepEqual(res.body.document.content, sampleDoc('Original'));
  });

  it('blocks a viewer from editing content, title, deleting, sharing, or listing shares', async () => {
    assert.equal((await request(ctx.app).put(`/api/documents/${docId}`).set(as(bob)).send({ title: 'Hacked' })).status, 403);
    assert.equal((await request(ctx.app).put(`/api/documents/${docId}`).set(as(bob)).send({ content: sampleDoc('x') })).status, 403);
    assert.equal((await request(ctx.app).delete(`/api/documents/${docId}`).set(as(bob))).status, 403);
    assert.equal((await request(ctx.app).get(`/api/documents/${docId}/shares`).set(as(bob))).status, 403);
    assert.equal(
      (await request(ctx.app).post(`/api/documents/${docId}/shares`).set(as(bob)).send({ email: 'alice@demo.com', role: 'editor' })).status,
      403,
    );
    const unchanged = await request(ctx.app).get(`/api/documents/${docId}`).set(as(alice));
    assert.equal(unchanged.body.document.title, 'Shared plan');
  });

  it('upgrades Bob to editor when the owner shares again (upsert, no duplicate rows)', async () => {
    const res = await request(ctx.app)
      .post(`/api/documents/${docId}/shares`)
      .set(as(alice))
      .send({ email: 'bob@demo.com', role: 'editor' });
    assert.equal(res.status, 201);
    assert.equal(res.body.share.role, 'editor');

    const list = await request(ctx.app).get(`/api/documents/${docId}/shares`).set(as(alice));
    assert.equal(list.body.shares.length, 1);
  });

  it('lets an editor modify title and content', async () => {
    const res = await request(ctx.app)
      .put(`/api/documents/${docId}`)
      .set(as(bob))
      .send({ title: 'Edited by Bob', content: sampleDoc('Bob was here') });
    assert.equal(res.status, 200);
    assert.equal(res.body.document.role, 'editor');
    assert.equal(res.body.document.title, 'Edited by Bob');

    const owner = await request(ctx.app).get(`/api/documents/${docId}`).set(as(alice));
    assert.deepEqual(owner.body.document.content, sampleDoc('Bob was here'));
  });

  it('still prevents an editor from deleting, sharing, or changing ownership', async () => {
    assert.equal((await request(ctx.app).delete(`/api/documents/${docId}`).set(as(bob))).status, 403);
    assert.equal(
      (await request(ctx.app).post(`/api/documents/${docId}/shares`).set(as(bob)).send({ email: 'bob@demo.com', role: 'viewer' })).status,
      403,
    );
    // Ownership is never client-controlled: an ownerId in the body is ignored.
    const res = await request(ctx.app)
      .put(`/api/documents/${docId}`)
      .set(as(bob))
      .send({ title: 'Same', ownerId: 2, owner_id: 2 });
    assert.equal(res.status, 200);
    assert.equal(res.body.document.ownerName, 'Alice');
  });

  it('validates share requests', async () => {
    const auth = as(alice);
    const url = `/api/documents/${docId}/shares`;
    assert.equal((await request(ctx.app).post(url).set(auth).send({ email: 'ghost@demo.com', role: 'viewer' })).status, 404);
    assert.equal((await request(ctx.app).post(url).set(auth).send({ email: 'alice@demo.com', role: 'viewer' })).status, 400);
    assert.equal((await request(ctx.app).post(url).set(auth).send({ email: 'bob@demo.com', role: 'owner' })).status, 400);
    assert.equal((await request(ctx.app).post(url).set(auth).send({ email: 'not-email', role: 'viewer' })).status, 400);
    assert.equal((await request(ctx.app).delete(`${url}/abc`).set(auth)).status, 400);
  });

  it('revokes access: the revoked user loses the document immediately', async () => {
    const res = await request(ctx.app).delete(`/api/documents/${docId}/shares/2`).set(as(alice));
    assert.equal(res.status, 204);

    assert.equal((await request(ctx.app).get(`/api/documents/${docId}`).set(as(bob))).status, 404);
    assert.equal((await request(ctx.app).put(`/api/documents/${docId}`).set(as(bob)).send({ title: 'x' })).status, 404);
    const list = await request(ctx.app).get('/api/documents').set(as(bob));
    assert.equal(list.body.shared.length, 0);
  });

  it('returns 404 when revoking access that does not exist', async () => {
    const res = await request(ctx.app).delete(`/api/documents/${docId}/shares/2`).set(as(alice));
    assert.equal(res.status, 404);
  });

  it('only the owner can revoke, and an editor-owned share cannot be revoked by the editor', async () => {
    await request(ctx.app).post(`/api/documents/${docId}/shares`).set(as(alice)).send({ email: 'bob@demo.com', role: 'editor' });
    const res = await request(ctx.app).delete(`/api/documents/${docId}/shares/2`).set(as(bob));
    assert.equal(res.status, 403);
    await request(ctx.app).delete(`/api/documents/${docId}/shares/2`).set(as(alice));
  });
});
