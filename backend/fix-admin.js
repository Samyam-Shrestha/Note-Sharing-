import "dotenv/config";
import { pool } from "./src/db.js";

async function fix() {
  await pool.query("UPDATE users SET is_verified = TRUE WHERE role = 'admin'");
  console.log("Admin verified");
  process.exit(0);
}
fix();
