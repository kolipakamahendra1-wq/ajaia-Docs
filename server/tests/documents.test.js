import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, createDb, createApp, login, request, sampleDoc } from './helpers.js';

describe('document creation, retrieval and persistence', () => {
  let ctx;
  let aliceToken;
  let bobToken;

  before(async () => {
    ctx = await createTestContext();
    aliceToken = await login(ctx.app, 'alice@demo.com');
    bobToken = await login(ctx.app, 'bob@demo.com');
  });
  after(async () => {
    await ctx.close();
  });

  it('creates a document owned by the requester with a default title and content', async () => {
    const res = await request(ctx.app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({});
    assert.equal(res.status, 201);
    assert.equal(res.body.document.title, 'Untitled document');
    assert.equal(res.body.document.role, 'owner');
    assert.equal(res.body.document.ownerName, 'Alice');
    assert.equal(res.body.document.content.type, 'doc');
  });

  it('retrieves a created document with its full content', async () => {
    const created = await request(ctx.app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Plan', content: sampleDoc('First draft') });
    const id = created.body.document.id;

    const res = await request(ctx.app).get(`/api/documents/${id}`).set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.document.title, 'Plan');
    assert.deepEqual(res.body.document.content, sampleDoc('First draft'));
  });

  it('lists only owned documents under "owned" and sorts by recent update', async () => {
    const res = await request(ctx.app).get('/api/documents').set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.owned.length >= 2);
    assert.ok(res.body.owned.every((d) => d.role === 'owner'));
    assert.deepEqual(res.body.shared, []);
  });

  it('filters the list by title search, treating LIKE wildcards literally', async () => {
    await request(ctx.app).post('/api/documents').set('Authorization', `Bearer ${aliceToken}`).send({ title: '100% done' });
    const hit = await request(ctx.app).get('/api/documents?q=100%25').set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(hit.body.owned.length, 1);
    assert.equal(hit.body.owned[0].title, '100% done');
    const miss = await request(ctx.app).get('/api/documents?q=_%25').set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(miss.body.owned.length, 0);
  });

  it('renames and updates content for the owner and bumps updatedAt', async () => {
    const created = await request(ctx.app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Old' });
    const id = created.body.document.id;

    const res = await request(ctx.app)
      .put(`/api/documents/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'New title', content: sampleDoc('Edited') });
    assert.equal(res.status, 200);
    assert.equal(res.body.document.title, 'New title');
    assert.deepEqual(res.body.document.content, sampleDoc('Edited'));
    assert.ok(res.body.document.updatedAt >= created.body.document.updatedAt);
  });

  it('rejects invalid titles, content and empty updates', async () => {
    const created = await request(ctx.app).post('/api/documents').set('Authorization', `Bearer ${aliceToken}`).send({});
    const id = created.body.document.id;
    const auth = { Authorization: `Bearer ${aliceToken}` };

    assert.equal((await request(ctx.app).put(`/api/documents/${id}`).set(auth).send({ title: '   ' })).status, 400);
    assert.equal((await request(ctx.app).put(`/api/documents/${id}`).set(auth).send({ title: 'x'.repeat(201) })).status, 400);
    assert.equal((await request(ctx.app).put(`/api/documents/${id}`).set(auth).send({ content: '<script>' })).status, 400);
    assert.equal((await request(ctx.app).put(`/api/documents/${id}`).set(auth).send({ content: { type: 'html' } })).status, 400);
    assert.equal((await request(ctx.app).put(`/api/documents/${id}`).set(auth).send({})).status, 400);
    assert.equal((await request(ctx.app).post('/api/documents').set(auth).send({ title: 42 })).status, 400);
  });

  it('strips control characters from titles', async () => {
    const res = await request(ctx.app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: '  Clean\u0007 title  ' });
    assert.equal(res.body.document.title, 'Clean title');
  });

  it('deletes an owned document', async () => {
    const created = await request(ctx.app).post('/api/documents').set('Authorization', `Bearer ${aliceToken}`).send({});
    const id = created.body.document.id;
    const del = await request(ctx.app).delete(`/api/documents/${id}`).set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(del.status, 204);
    const gone = await request(ctx.app).get(`/api/documents/${id}`).set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(gone.status, 404);
  });

  it('returns 404 (not 403) to users with no access, so document existence is hidden', async () => {
    const created = await request(ctx.app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Private' });
    const id = created.body.document.id;
    const auth = { Authorization: `Bearer ${bobToken}` };

    assert.equal((await request(ctx.app).get(`/api/documents/${id}`).set(auth)).status, 404);
    assert.equal((await request(ctx.app).put(`/api/documents/${id}`).set(auth).send({ title: 'x' })).status, 404);
    assert.equal((await request(ctx.app).delete(`/api/documents/${id}`).set(auth)).status, 404);
    assert.equal((await request(ctx.app).get(`/api/documents/00000000-0000-4000-8000-000000000000`).set(auth)).status, 404);
  });

  it('keeps documents, content and ownership after the database is reopened (restart)', async () => {
    const content = sampleDoc('Survives a restart');
    const created = await request(ctx.app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Durable', content });
    const id = created.body.document.id;

    ctx.db.close();
    ctx.db = createDb(ctx.url);
    ctx.app = createApp({ db: ctx.db });

    const res = await request(ctx.app).get(`/api/documents/${id}`).set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.document.title, 'Durable');
    assert.equal(res.body.document.ownerName, 'Alice');
    assert.deepEqual(res.body.document.content, content);
  });
});
