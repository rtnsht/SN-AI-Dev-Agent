/**
 * Detect Postgres / PostgREST "missing column" errors so we can retry without a column
 * (e.g. migration not applied) without masking unrelated failures.
 */
export function isMissingColumnError(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const o = err as { code?: string; message?: string; details?: string; hint?: string };
  const code = String(o.code ?? "");
  // PostgreSQL undefined_column
  if (code === "42703") return true;
  const blob = [o.message, o.details, o.hint].filter(Boolean).join(" ");
  if (/42703/.test(blob)) return true;
  if (/column .* does not exist/i.test(blob)) return true;
  if (/Could not find the ['"]?[\w.]+['"]? column/i.test(blob)) return true;
  return false;
}
