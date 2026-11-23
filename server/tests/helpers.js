// Test setup. Environment variables must be set before server modules load config.js,
// so the server modules are imported dynamically after the env is configured.
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-0123456789';
process.env.DEMO_PASSWORD = 'test-password-123';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { createDb } = await import('../database/client.js');
const { initSchema } = await import('../database/init.js');
const { seedDemoUsers } = await import('../database/seed.js');
const { createApp } = await import('../app.js');
const { default: supertest } = await import('supertest');

export { createDb, createApp };
export const request = (app) => supertest(app);
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

function removeDbFiles(file) {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(file + suffix, { force: true });
    } catch {
      // Windows can keep the file locked briefly after close().
    }
  }
}

function sweepOldTestDbs() {
  if (!fs.existsSync('./data')) return;
  for (const name of fs.readdirSync('./data')) {
    if (name.startsWith('test-')) removeDbFiles('./data/' + name);
  }
}

/** A fresh file-backed libSQL database with schema and demo users, under server/data/. */
export async function createTestContext() {
  sweepOldTestDbs();
  const url = `file:./data/test-${crypto.randomUUID()}.db`;
  const ctx = { url, db: createDb(url) };
  await initSchema(ctx.db);
  await seedDemoUsers(ctx.db, DEMO_PASSWORD);
  ctx.app = createApp({ db: ctx.db });
  ctx.close = async () => {
    ctx.db.close();
    const file = url.slice('file:'.length);
    removeDbFiles(file); // best effort; leftovers are swept on the next run
  };
  return ctx;
}

export async function login(app, email) {
  const res = await supertest(app).post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return res.body.token;
}

export const paragraph = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
export const sampleDoc = (text = 'Hello world') => ({ type: 'doc', content: [paragraph(text)] });

// ---- Minimal DOCX fixture builder (a real ZIP with three OOXML parts) ----------

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name);
    const comp = zlib.deflateRawSync(data);
    const crc = zlib.crc32(data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0x21, 12); // date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, comp);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

/** Builds a valid DOCX whose body is the given paragraphs. Each item: string or {text, bold}. */
export function makeDocx(paragraphs) {
  const runs = paragraphs
    .map((p) => {
      const { text, bold } = typeof p === 'string' ? { text: p, bold: false } : p;
      const rPr = bold ? '<w:rPr><w:b/></w:rPr>' : '';
      return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
    })
    .join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${runs}</w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  return zip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes) },
    { name: '_rels/.rels', data: Buffer.from(rels) },
    { name: 'word/document.xml', data: Buffer.from(documentXml) },
  ]);
}
