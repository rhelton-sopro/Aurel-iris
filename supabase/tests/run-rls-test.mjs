// supabase/tests/run-rls-test.mjs
// Runner for cross_therapist_rls.sql against a Postgres database (local or remote linked Supabase).
//
// Usage:
//   SUPABASE_DB_URL='postgresql://...' node supabase/tests/run-rls-test.mjs
//
// Reads the SQL file as a single script, sends it to the server via pg's Client.query()
// (which uses the simple query protocol — supports multi-statement scripts and DO blocks
// unlike supabase db query which uses extended/prepared protocol).
//
// Captures NOTICE messages (raise notice in plpgsql) via the 'notice' event on Client,
// and on any error (raise exception, network, etc) exits non-zero with the offending message.
//
// This script is part of plan 01-05 (RLS verification). Re-runnable idempotently because
// the SQL ends in ROLLBACK — DB state is restored after each run.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "cross_therapist_rls.sql");
const sql = readFileSync(sqlPath, "utf8");

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("ERROR: SUPABASE_DB_URL não setado. Exporte a connection string do Supabase remoto antes de rodar.");
  process.exit(2);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }, // Supabase cert é válido mas a CA chain não vem por padrão no Node
});

const notices = [];
client.on("notice", (msg) => {
  notices.push(msg.message || msg.toString());
  console.log("NOTICE:", msg.message || msg.toString());
});

try {
  await client.connect();
  console.log("Connected to remote Supabase. Running cross_therapist_rls.sql...");
  await client.query(sql);
  console.log("\nSQL executed without errors.");
  console.log(`\nNotices captured: ${notices.length}`);

  const expected = [
    "CONTROL PASS: fixture inseriu 2 clients e 2 readings",
    "PASS: Terapeuta A le proprio cliente",
    "PASS: Terapeuta B le proprio cliente",
  ];
  let allMatched = true;
  for (const needle of expected) {
    const matched = notices.some((n) => n.includes(needle));
    console.log(`  [${matched ? "✓" : "✗"}] ${needle}`);
    if (!matched) allMatched = false;
  }

  const failPatterns = ["CONTROL FAIL", "OWN-DATA FAIL", "RLS FAIL"];
  for (const fail of failPatterns) {
    const found = notices.some((n) => n.includes(fail));
    if (found) {
      console.error(`\nFAIL pattern detected in notices: ${fail}`);
      allMatched = false;
    }
  }

  if (!allMatched) {
    console.error("\nRLS_REMOTE_FAIL");
    process.exit(1);
  }
  console.log("\nRLS_REMOTE_OK");
} catch (err) {
  console.error("\nQuery failed:", err.message);
  if (err.where) console.error("Where:", err.where);
  if (err.detail) console.error("Detail:", err.detail);
  process.exit(1);
} finally {
  await client.end();
}
