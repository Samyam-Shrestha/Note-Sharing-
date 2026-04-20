import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey() {
  const keyHex = process.env.NOTE_ENCRYPTION_KEY;
  if (!keyHex) throw new Error("NOTE_ENCRYPTION_KEY is required");
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("NOTE_ENCRYPTION_KEY must be 32 bytes hex");
  return key;
}

export function encryptNoteContent(plainText) {
  // Security: unique IV per record to prevent nonce reuse.
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptNoteContent(payload) {
  if (!payload) return "";
  const [ivHex, tagHex, encryptedHex] = payload.split(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
