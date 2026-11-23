import mammoth from 'mammoth';
import { AppError } from '../middleware/errors.js';

/** Accepted extensions mapped to the MIME types browsers commonly send for them. */
const ACCEPTED = {
  '.txt': ['text/plain', 'application/octet-stream'],
  '.md': ['text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
  ],
};

export const ALLOWED_EXTENSIONS = Object.keys(ACCEPTED);

export function extensionOf(filename = '') {
  const i = filename.lastIndexOf('.');
  return i < 0 ? '' : filename.slice(i).toLowerCase();
}

/** Early rejection in Multer's fileFilter. Content is verified again in extractDocument. */
export function isAcceptedUpload(filename, mimetype) {
  const ext = extensionOf(filename);
  return ACCEPTED[ext] !== undefined && ACCEPTED[ext].includes(mimetype);
}

export function titleFromFilename(filename = '') {
  const base = filename.replace(/\.[^.]+$/, '');
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  return clean || 'Imported document';
}

// ---- TipTap JSON builders ---------------------------------------------------

const paragraph = (nodes = []) => (nodes.length ? { type: 'paragraph', content: nodes } : { type: 'paragraph' });
const textNode = (text, marks) => (marks ? { type: 'text', text, marks } : { type: 'text', text });

/**
 * Inline markup: **bold** / __bold__ and *italic* / _italic_.
 * Underscore/asterisk runs inside words (snake_case, 2*3*4) are left alone.
 */
const INLINE_RE = /\*\*(.+?)\*\*|__(.+?)__|(?<![\w*])\*(?![\s*])(.+?)\*(?![\w*])|(?<![\w])_(?![\s_])(.+?)_(?![\w])/g;

export function parseInline(text) {
  const nodes = [];
  let last = 0;
  INLINE_RE.lastIndex = 0;
  let m;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(textNode(text.slice(last, m.index)));
    const isBold = m[1] !== undefined || m[2] !== undefined;
    const inner = m[1] ?? m[2] ?? m[3] ?? m[4];
    nodes.push(textNode(inner, [{ type: isBold ? 'bold' : 'italic' }]));
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) nodes.push(textNode(text.slice(last)));
  return nodes.filter((n) => n.text !== '');
}

/** Converts a markdown string (also used for DOCX via Mammoth) into TipTap JSON. */
export function markdownToTiptap(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const content = [];
  let pending = [];

  const flush = () => {
    if (pending.length) {
      content.push(paragraph(parseInline(pending.join(' '))));
      pending = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (!line.trim()) {
      flush();
      i += 1;
    } else if (heading) {
      flush();
      const level = Math.min(heading[1].length, 3);
      content.push({ type: 'heading', attrs: { level }, content: parseInline(heading[2]) });
      i += 1;
    } else if (bullet || ordered) {
      flush();
      const itemRe = bullet ? /^\s*[-*+]\s+(.*)$/ : /^\s*\d+[.)]\s+(.*)$/;
      const items = [];
      while (i < lines.length) {
        const m = itemRe.exec(lines[i]);
        if (!m) break;
        items.push({ type: 'listItem', content: [paragraph(parseInline(m[1]))] });
        i += 1;
      }
      content.push({ type: bullet ? 'bulletList' : 'orderedList', content: items });
    } else {
      pending.push(line.trim());
      i += 1;
    }
  }
  flush();

  return { type: 'doc', content: content.length ? content : [paragraph()] };
}

/** Plain text is kept literally: each non-empty line becomes a paragraph. */
export function plainTextToTiptap(text) {
  const content = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => paragraph([textNode(line)]));
  return { type: 'doc', content: content.length ? content : [paragraph()] };
}

// ---- Extraction -------------------------------------------------------------

function isProbablyUtf8Text(buffer) {
  if (buffer.includes(0)) return false; // NUL bytes mean binary
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function isZip(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

/**
 * Validates and extracts an uploaded file entirely in memory. Nothing is written to disk
 * and nothing is executed. Throws AppError for invalid input.
 */
export async function extractDocument({ originalname, buffer }) {
  const ext = extensionOf(originalname);
  if (!ACCEPTED[ext]) {
    throw new AppError(415, 'Unsupported file type. Allowed: .txt, .md, .docx');
  }
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'The uploaded file is empty');
  }

  let content;
  if (ext === '.docx') {
    if (!isZip(buffer)) throw new AppError(400, 'File is not a valid DOCX document');
    try {
      const { value } = await mammoth.convertToMarkdown({ buffer });
      content = markdownToTiptap(value);
    } catch {
      throw new AppError(400, 'Could not read this DOCX file');
    }
  } else {
    if (!isProbablyUtf8Text(buffer)) throw new AppError(400, 'Text files must be UTF-8 encoded');
    const text = buffer.toString('utf8');
    content = ext === '.md' ? markdownToTiptap(text) : plainTextToTiptap(text);
  }

  return { title: titleFromFilename(originalname), content };
}
