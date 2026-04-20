import { pool } from "../db.js";
import { decryptNoteContent, encryptNoteContent } from "../crypto.js";

export async function ensureNotesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
      is_archived BOOLEAN NOT NULL DEFAULT FALSE,
      is_trashed BOOLEAN NOT NULL DEFAULT FALSE,
      acl JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  // Ensure columns exist if the table was created previously
  await pool.query(`
    ALTER TABLE notes ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_trashed BOOLEAN NOT NULL DEFAULT FALSE;
  `);
}

export function defaultAcl(ownerId) {
  return {
    owner: [ownerId],
    viewer: [],
    editor: []
  };
}

function canView(userId, acl, ownerId) {
  return ownerId === userId || acl.owner?.includes(userId) || acl.viewer?.includes(userId) || acl.editor?.includes(userId);
}

function canEdit(userId, acl, ownerId) {
  return ownerId === userId || acl.owner?.includes(userId) || acl.editor?.includes(userId);
}

export async function listAccessibleNotes(userId) {
  const result = await pool.query("SELECT * FROM notes ORDER BY updated_at DESC");
  return result.rows
    .filter((row) => canView(userId, row.acl, row.owner_id))
    .map((row) => ({ ...row, content: decryptNoteContent(row.content) }));
}

export async function createNote({ ownerId, title, content, tags = [] }) {
  const acl = defaultAcl(ownerId);
  // Security: note content is encrypted before persisting to DB.
  const encryptedContent = encryptNoteContent(content);
  const result = await pool.query(
    `INSERT INTO notes (owner_id, title, content, tags, acl) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb) RETURNING *`,
    [ownerId, title, encryptedContent, JSON.stringify(tags), JSON.stringify(acl)]
  );
  return { ...result.rows[0], content };
}

export async function updateNote({ id, userId, title, content, tags, is_pinned, is_archived, is_trashed }) {
  const existing = await pool.query("SELECT * FROM notes WHERE id = $1", [id]);
  const row = existing.rows[0];
  if (!row || !canEdit(userId, row.acl, row.owner_id)) return null;

  const newTitle = title !== undefined ? title : row.title;
  const newContent = content !== undefined ? content : decryptNoteContent(row.content);
  const encryptedContent = encryptNoteContent(newContent);
  const newTags = tags !== undefined ? JSON.stringify(tags) : JSON.stringify(row.tags);
  const newIsPinned = is_pinned !== undefined ? is_pinned : row.is_pinned;
  const newIsArchived = is_archived !== undefined ? is_archived : row.is_archived;
  const newIsTrashed = is_trashed !== undefined ? is_trashed : row.is_trashed;

  const result = await pool.query(
    `UPDATE notes SET title = $1, content = $2, tags = $3::jsonb, is_pinned = $4, is_archived = $5, is_trashed = $6, updated_at = NOW() WHERE id = $7 RETURNING *`,
    [newTitle, encryptedContent, newTags, newIsPinned, newIsArchived, newIsTrashed, id]
  );
  return { ...result.rows[0], content: newContent };
}

export async function deleteNote({ id, userId }) {
  const existing = await pool.query("SELECT * FROM notes WHERE id = $1", [id]);
  const row = existing.rows[0];
  if (!row || row.owner_id !== userId) return false;
  await pool.query("DELETE FROM notes WHERE id = $1", [id]);
  return true;
}

export async function shareNote({ id, userId, targetUserId, role }) {
  const existing = await pool.query("SELECT * FROM notes WHERE id = $1", [id]);
  const row = existing.rows[0];
  if (!row || row.owner_id !== userId) return null;

  const acl = { ...row.acl };
  acl.viewer = acl.viewer || [];
  acl.editor = acl.editor || [];
  acl.owner = acl.owner || [row.owner_id];
  acl.viewer = acl.viewer.filter((uid) => uid !== targetUserId);
  acl.editor = acl.editor.filter((uid) => uid !== targetUserId);

  if (role === "viewer") acl.viewer.push(targetUserId);
  if (role === "editor") acl.editor.push(targetUserId);

  const result = await pool.query("UPDATE notes SET acl = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *", [
    JSON.stringify(acl),
    id
  ]);
  return { ...result.rows[0], content: decryptNoteContent(result.rows[0].content) };
}
