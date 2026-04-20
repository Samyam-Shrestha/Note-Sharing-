import bcrypt from "bcryptjs";
import { pool } from "../db.js";

const SALT_ROUNDS = 12;

export async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      verification_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  // Ensure columns exist if the table was created previously
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code TEXT;
  `);
}

export async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn("ADMIN_EMAIL or ADMIN_PASSWORD not found in .env. Admin account not created.");
    return;
  }

  const existing = await findUserByEmail(adminEmail);
  if (!existing) {
    await createUser(adminEmail, adminPassword, "admin", true, null);
    console.log(`Admin created: ${adminEmail} (credentials from .env)`);
  } else {
    // Force verification and sync password with .env
    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    await pool.query(
      "UPDATE users SET is_verified = TRUE, password_hash = $1 WHERE email = $2",
      [passwordHash, adminEmail]
    );
  }
}

export async function createUser(email, password, role = 'user', isVerified = false, verificationCode = null) {
  // Security: store bcrypt hashes, never plaintext passwords.
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await pool.query(
    "INSERT INTO users (email, password_hash, role, is_verified, verification_code) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, is_verified, verification_code, created_at",
    [email, passwordHash, role, isVerified, verificationCode]
  );
  return result.rows[0];
}

export async function verifyUser(email, code) {
  const result = await pool.query(
    "UPDATE users SET is_verified = TRUE, verification_code = NULL WHERE email = $1 AND verification_code = $2 RETURNING id",
    [email, code]
  );
  return result.rowCount > 0;
}

export async function findUserByEmail(email) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
}

export async function getAllUsers() {
  const result = await pool.query("SELECT id, email, role, is_verified, created_at FROM users ORDER BY created_at DESC");
  return result.rows;
}

export async function validatePassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}
