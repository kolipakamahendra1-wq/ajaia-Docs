import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, login, request, makeDocx } from './helpers.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('file upload validation and import', () => {
  let ctx;
  let alice;
  let bob;

  const upload = (token, buffer, filename, contentType) =>
    request(ctx.app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, { filename, contentType });

  before(async () => {
    ctx = await createTestContext();
    alice = await login(ctx.app, 'alice@demo.com');
    bob = await login(ctx.app, 'bob@demo.com');
  });
  after(async () => {
    await ctx.close();
  });

  it('requires authentication', async () => {
    const res = await request(ctx.app)
      .post('/api/uploads')
      .attach('file', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' });
    assert.equal(res.status, 401);
  });

  it('imports a TXT file as an editable document owned by the uploader', async () => {
    const res = await upload(alice, Buffer.from('First line\n\nSecond line\n'), 'meeting-notes.txt', 'text/plain');
    assert.equal(res.status, 201);
    assert.equal(res.body.document.title, 'meeting-notes');
    assert.equal(res.body.document.ownerName, 'Alice');
    assert.equal(res.body.document.role, 'owner');
    const texts = res.body.document.content.content.map((n) => n.content?.[0]?.text);
    assert.deepEqual(texts, ['First line', 'Second line']);
  });

  it('imports a Markdown file with headings, lists and inline emphasis', async () => {
    const md = '# Roadmap\n\nShip the **MVP** this week.\n\n- Login\n- Documents\n\n1. Upload\n2. Share\n';
    const res = await upload(alice, Buffer.from(md), 'roadmap.md', 'text/markdown');
    assert.equal(res.status, 201);
    const doc = res.body.document.content.content;
    assert.equal(doc[0].type, 'heading');
    assert.equal(doc[0].attrs.level, 1);
    assert.equal(doc[1].type, 'paragraph');
    assert.deepEqual(doc[1].content[1], { type: 'text', text: 'MVP', marks: [{ type: 'bold' }] });
    assert.equal(doc[2].type, 'bulletList');
    assert.equal(doc[2].content.length, 2);
    assert.equal(doc[3].type, 'orderedList');
  });

  it('imports a DOCX file and keeps bold formatting', async () => {
    const docx = makeDocx(['Quarterly review', { text: 'Revenue grew', bold: true }]);
    const res = await upload(alice, docx, 'review.docx', DOCX_MIME);
    assert.equal(res.status, 201);
    assert.equal(res.body.document.title, 'review');
    const flat = JSON.stringify(res.body.document.content);
    assert.ok(flat.includes('Quarterly review'));
    assert.ok(flat.includes('Revenue grew'));
    assert.ok(flat.includes('"bold"'));
  });

  it('accepts DOCX sent with the generic octet-stream MIME type', async () => {
    const res = await upload(alice, makeDocx(['Generic mime']), 'generic.docx', 'application/octet-stream');
    assert.equal(res.status, 201);
  });

  it('rejects unsupported extensions', async () => {
    const res = await upload(alice, Buffer.from('MZ...'), 'malware.exe', 'application/x-msdownload');
    assert.equal(res.status, 415);
    assert.match(res.body.error, /Allowed: \.txt, \.md, \.docx/);
  });

  it('rejects a supported extension with a mismatched MIME type', async () => {
    const res = await upload(alice, Buffer.from('<html></html>'), 'page.txt', 'text/html');
    assert.equal(res.status, 415);
  });

  it('rejects empty files', async () => {
    const res = await upload(alice, Buffer.alloc(0), 'empty.txt', 'text/plain');
    assert.equal(res.status, 400);
  });

  it('rejects binary content disguised as a text file', async () => {
    const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]);
    const res = await upload(alice, binary, 'image.txt', 'text/plain');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /UTF-8/);
  });

  it('rejects text that is not valid UTF-8', async () => {
    const latin1 = Buffer.from([0x63, 0x61, 0x66, 0xe9]); // "café" in Latin-1
    const res = await upload(alice, latin1, 'latin.md', 'text/markdown');
    assert.equal(res.status, 400);
  });

  it('rejects a .docx that is not a ZIP archive', async () => {
    const res = await upload(alice, Buffer.from('just plain text'), 'fake.docx', DOCX_MIME);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /valid DOCX/);
  });

  it('rejects a corrupt DOCX that starts with the ZIP signature', async () => {
    const corrupt = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 0x41)]);
    const res = await upload(alice, corrupt, 'corrupt.docx', DOCX_MIME);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Could not read/);
  });

  it('rejects files over the 2 MB limit with 413', async () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1, 0x61);
    const res = await upload(alice, big, 'big.txt', 'text/plain');
    assert.equal(res.status, 413);
  });

  it('rejects a request with no file', async () => {
    const res = await request(ctx.app).post('/api/uploads').set('Authorization', `Bearer ${alice}`).field('note', 'hi');
    assert.equal(res.status, 400);
  });

  it('rejects more than one file in a request', async () => {
    const res = await request(ctx.app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${alice}`)
      .attach('file', Buffer.from('a'), { filename: 'a.txt', contentType: 'text/plain' })
      .attach('file', Buffer.from('b'), { filename: 'b.txt', contentType: 'text/plain' });
    assert.equal(res.status, 400);
  });

  it('does not let the uploader choose the owner: Bob uploads, Bob owns', async () => {
    const res = await upload(bob, Buffer.from('Bob notes'), 'bob.txt', 'text/plain');
    assert.equal(res.status, 201);
    assert.equal(res.body.document.ownerName, 'Bob');
    const aliceList = await request(ctx.app).get('/api/documents').set('Authorization', `Bearer ${alice}`);
    assert.ok(!aliceList.body.owned.some((d) => d.id === res.body.document.id));
  });
});
