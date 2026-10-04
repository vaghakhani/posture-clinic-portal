#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date -u +%Y-%m-%d_%H-%M)"
PORTAL_DIR="$ROOT/backups/portal/$STAMP"
DB_DIR="$ROOT/backups/database/$STAMP"

if [ -d "$ROOT/netlify-deploy" ]; then
  SRC="$ROOT/netlify-deploy"
else
  SRC="$ROOT"
fi

mkdir -p "$PORTAL_DIR" "$DB_DIR"

if [ -d "$SRC" ]; then
  tar -czf "$PORTAL_DIR/portal-files.tar.gz" \
    --exclude="backups" --exclude=".git" --exclude=".github" \
    -C "$SRC" .
  printf '%s\n' "$STAMP" > "$PORTAL_DIR/created-at-utc.txt"
fi

DB_JSON="$DB_DIR/patients-database.json"
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  SNAP=$(curl -fsS "${SUPABASE_URL%/}/rest/v1/clinic_snapshot?id=eq.main&select=data,updated_at" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Accept: application/json") || SNAP="[]"
  INTAKE=$(curl -fsS "${SUPABASE_URL%/}/rest/v1/intake_submissions?select=id,status,data,submitted_at,reviewed_at" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Accept: application/json") || INTAKE="[]"
  printf '{"stamp":"%s","kind":"database","clinic_snapshot":%s,"intake_submissions":%s}\n' "$STAMP" "$SNAP" "$INTAKE" > "$DB_JSON"

  python - "$STAMP" "$DB_JSON" <<'PY'
import json, sys
stamp, path = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
out = {"stamp": stamp, "kind": "database", "data": data}
with open(path + ".post.json", "w", encoding="utf-8") as f:
    json.dump(out, f)
PY
  curl -fsS -X POST "${SUPABASE_URL%/}/rest/v1/clinic_backups" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    --data-binary @"$DB_JSON.post.json" >/dev/null || true
  rm -f "$DB_JSON.post.json"

  python - "$STAMP" <<'PY'
import json, sys
stamp = sys.argv[1]
print(json.dumps({
  "stamp": stamp,
  "kind": "portal",
  "data": {"github_path": "backups/portal/" + stamp}
}))
PY > "$PORTAL_DIR/supabase-row.json"
  curl -fsS -X POST "${SUPABASE_URL%/}/rest/v1/clinic_backups" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    --data-binary @"$PORTAL_DIR/supabase-row.json" >/dev/null || true
else
  printf '{"stamp":"%s","error":"Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY GitHub secrets"}\n' "$STAMP" > "$DB_JSON"
fi

find "$ROOT/backups/portal" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
find "$ROOT/backups/database" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
