#!/usr/bin/env node
/**
 * Apply one or more SQL migration files to a remote Supabase Postgres database.
 *
 * Usage:
 *   cd webapp && node scripts/apply-supabase-migrations.cjs
 *   cd webapp && node scripts/apply-supabase-migrations.cjs 018_engine_config.sql 019_share_prompt_tracking.sql
 *
 * Requires in webapp/.env (or environment):
 *   DATABASE_URL or SUPABASE_DB_URL or DIRECT_URL
 * Use Supabase Dashboard → Project Settings → Database → Connection string (URI).
 * Prefer "Direct connection" or "Session mode" pooler; URL usually includes ?sslmode=require.
 */

const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DIRECT_URL;

async function main() {
  if (!connectionString) {
    console.error(
      "Missing DATABASE_URL, SUPABASE_DB_URL, or DIRECT_URL in webapp/.env.\n" +
        "Get the URI from Supabase → Project Settings → Database → Connection string."
    );
    process.exit(1);
  }

  const { Client } = require("pg");
  const client = new Client({
    connectionString,
    // Supabase uses TLS; sslmode=require in URL is typical; this is a safe default if missing
    ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  const argFiles = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const defaultFiles = [
    "018_engine_config.sql",
    "019_share_prompt_tracking.sql",
    "020_share_prompt_tracking_rls.sql",
  ];
  const files = argFiles.length > 0 ? argFiles : defaultFiles;
  const dir = path.join(__dirname, "../supabase/migrations");

  for (const f of files) {
    const full = path.join(dir, f);
    if (!fs.existsSync(full)) {
      console.error("Migration file not found:", full);
      await client.end().catch(() => {});
      process.exit(1);
    }
    const sql = fs.readFileSync(full, "utf8");
    console.log("Applying", f, "...");
    await client.query(sql);
    console.log("OK", f);
  }

  await client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
