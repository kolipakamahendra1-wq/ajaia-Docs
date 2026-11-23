const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

function escapeLike(term) {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function toSummary(row, role) {
  return {
    id: row.id,
    title: row.title,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDetail(row, role) {
  return { ...toSummary(row, role), content: JSON.parse(row.content) };
}

/** Returns { owned, shared } lists, optionally filtered by title. */
export async function listDocumentsForUser(db, userId, search = '') {
  const pattern = search ? `%${escapeLike(search)}%` : null;
  const titleClause = pattern ? "AND d.title LIKE ? ESCAPE '\\'" : '';
  const base = 'SELECT d.id, d.title, d.owner_id, d.created_at, d.updated_at, u.name AS owner_name';

  const owned = await db.execute({
    sql: `${base} FROM documents d JOIN users u ON u.id = d.owner_id
          WHERE d.owner_id = ? ${titleClause} ORDER BY d.updated_at DESC`,
    args: pattern ? [userId, pattern] : [userId],
  });

  const shared = await db.execute({
    sql: `${base}, s.role AS share_role FROM document_shares s
          JOIN documents d ON d.id = s.document_id
          JOIN users u ON u.id = d.owner_id
          WHERE s.user_id = ? ${titleClause} ORDER BY d.updated_at DESC`,
    args: pattern ? [userId, pattern] : [userId],
  });

  return {
    owned: owned.rows.map((r) => toSummary(r, 'owner')),
    shared: shared.rows.map((r) => toSummary(r, r.share_role)),
  };
}

/** Resolves the document and the caller's role, or null when the caller has no access. */
export async function getDocumentWithRole(db, docId, userId) {
  const result = await db.execute({
    sql: `SELECT d.*, u.name AS owner_name, s.role AS share_role
          FROM documents d
          JOIN users u ON u.id = d.owner_id
          LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = ?
          WHERE d.id = ?`,
    args: [userId, docId],
  });
  const row = result.rows[0];
  if (!row) return null;
  if (row.owner_id === userId) return { document: row, role: 'owner' };
  if (row.share_role) return { document: row, role: row.share_role };
  return null;
}

export async function insertDocument(db, { id, ownerId, title, content }) {
  await db.execute({
    sql: 'INSERT INTO documents (id, owner_id, title, content) VALUES (?, ?, ?, ?)',
    args: [id, ownerId, title, JSON.stringify(content)],
  });
}

export async function updateDocument(db, docId, { title, content }) {
  const sets = [];
  const args = [];
  if (title !== undefined) {
    sets.push('title = ?');
    args.push(title);
  }
  if (content !== undefined) {
    sets.push('content = ?');
    args.push(JSON.stringify(content));
  }
  sets.push(`updated_at = ${NOW}`);
  args.push(docId);
  await db.execute({ sql: `UPDATE documents SET ${sets.join(', ')} WHERE id = ?`, args });
}

export async function deleteDocument(db, docId) {
  await db.execute({ sql: 'DELETE FROM documents WHERE id = ?', args: [docId] });
}

export async function listShares(db, docId) {
  const result = await db.execute({
    sql: `SELECT s.user_id, s.role, s.created_at, u.email, u.name
          FROM document_shares s JOIN users u ON u.id = s.user_id
          WHERE s.document_id = ? ORDER BY u.name`,
    args: [docId],
  });
  return result.rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    name: r.name,
    role: r.role,
    createdAt: r.created_at,
  }));
}

export async function upsertShare(db, docId, userId, role) {
  await db.execute({
    sql: `INSERT INTO document_shares (document_id, user_id, role) VALUES (?, ?, ?)
          ON CONFLICT (document_id, user_id) DO UPDATE SET role = excluded.role`,
    args: [docId, userId, role],
  });
}

export async function deleteShare(db, docId, userId) {
  const result = await db.execute({
    sql: 'DELETE FROM document_shares WHERE document_id = ? AND user_id = ?',
    args: [docId, userId],
  });
  return result.rowsAffected > 0;
}
