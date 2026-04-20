import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Security: force SSL in transit for database traffic.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED === "true"
  }
});
