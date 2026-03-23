# Apply migrations 018, 019, 020 to Supabase

## Option A — SQL Editor (fastest if you don’t use `DATABASE_URL` locally)

1. Open **Supabase Dashboard** → your project → **SQL Editor** → **New query**.
2. Paste the full contents of [`migrations/_bundle_018_019_020.sql`](./migrations/_bundle_018_019_020.sql).
3. Run the query. You should see success with no errors.

Safe to run more than once: uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` where relevant.

## Option B — Script from your machine (uses Postgres URI)

1. In Supabase: **Project Settings** → **Database** → copy the **URI** connection string (direct or session pooler; include password).
2. Add to `webapp/.env`:

   ```bash
   DATABASE_URL=postgresql://postgres.[ref]:[YOUR-PASSWORD]@...?sslmode=require
   ```

3. From repo root:

   ```bash
   cd webapp && npm install && npm run db:apply:018-020
   ```

   Or: `node scripts/apply-supabase-migrations.cjs`

## What each migration does

| File | Purpose |
|------|---------|
| `018_engine_config.sql` | `public.engine_config` table + default rows for AI round limits / planner |
| `019_share_prompt_tracking.sql` | `public.share_prompt_tracking` + `updated_at` trigger |
| `020_share_prompt_tracking_rls.sql` | Enable RLS on `share_prompt_tracking` (no policies; server uses service role) |

Do **not** commit `DATABASE_URL` with a real password to git.
