import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseInline,
  markdownToTiptap,
  plainTextToTiptap,
  titleFromFilename,
  isAcceptedUpload,
} from '../services/importer.js';

describe('importer text parsing', () => {
  it('parses bold and italic markup without touching snake_case or math', () => {
    const nodes = parseInline('Use **bold**, *italic*, and snake_case_name or 2*3*4.');
    const marks = nodes.filter((n) => n.marks).map((n) => [n.text, n.marks[0].type]);
    assert.deepEqual(marks, [
      ['bold', 'bold'],
      ['italic', 'italic'],
    ]);
    const plain = nodes.filter((n) => !n.marks).map((n) => n.text).join('');
    assert.ok(plain.includes('snake_case_name'));
    assert.ok(plain.includes('2*3*4'));
  });

  it('maps markdown headings to levels 1-3 and clamps deeper headings', () => {
    const doc = markdownToTiptap('# One\n## Two\n###### Six');
    assert.deepEqual(
      doc.content.map((n) => n.attrs.level),
      [1, 2, 3],
    );
  });

  it('joins soft-wrapped lines into one paragraph and splits on blank lines', () => {
    const doc = markdownToTiptap('line one\nline two\n\nnew paragraph');
    assert.equal(doc.content.length, 2);
    assert.equal(doc.content[0].content[0].text, 'line one line two');
  });

  it('always returns a valid, non-empty document', () => {
    assert.deepEqual(markdownToTiptap(''), { type: 'doc', content: [{ type: 'paragraph' }] });
    assert.deepEqual(plainTextToTiptap('   \n\n  '), { type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('keeps plain text literal, including asterisks and hashes', () => {
    const doc = plainTextToTiptap('# not a heading **not bold**');
    assert.equal(doc.content[0].type, 'paragraph');
    assert.equal(doc.content[0].content[0].text, '# not a heading **not bold**');
  });

  it('derives a safe title from the filename', () => {
    assert.equal(titleFromFilename('Q3 plan.final.docx'), 'Q3 plan.final');
    assert.equal(titleFromFilename('\u0000\u0007.txt'), 'Imported document');
    assert.equal(titleFromFilename('x'.repeat(300) + '.md').length, 200);
  });

  it('accepts only the allowlisted extension and MIME combinations', () => {
    assert.equal(isAcceptedUpload('a.md', 'text/markdown'), true);
    assert.equal(isAcceptedUpload('a.md', 'text/html'), false);
    assert.equal(isAcceptedUpload('a.html', 'text/plain'), false);
    assert.equal(isAcceptedUpload('a.TXT', 'text/plain'), true);
    assert.equal(isAcceptedUpload('script.js', 'application/javascript'), false);
  });
});
