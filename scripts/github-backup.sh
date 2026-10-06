#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date -u +%Y-%m-%d_%H-%M)"
# Keep heavy/PHI backups in runner temp; Actions uploads a private artifact.
WORK="${RUNNER_TEMP:-/tmp}/posture-clinic-backup-$STAMP"
PORTAL_DIR="$WORK/portal"
DB_DIR="$WORK/database"
PUBLIC_MARK="$ROOT/backups/.last-backup-utc.txt"

PY=python3
if ! command -v python3 >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PY=python
  else
    echo "ERROR: python3 is required on the runner" >&2
    exit 1
  fi
fi

mkdir -p "$PORTAL_DIR" "$DB_DIR" "$ROOT/backups"

if [ -d "$ROOT/netlify-deploy" ]; then
  SRC="$ROOT/netlify-deploy"
else
  SRC="$ROOT"
fi

if [ -d "$SRC" ]; then
  # Ignore non-fatal tar warnings (file changed while reading) so the job can finish.
  set +e
  tar -czf "$PORTAL_DIR/portal-files.tar.gz" \
    --exclude="backups" --exclude=".git" --exclude=".github" --exclude="node_modules" \
    -C "$SRC" .
  TAR_RC=$?
  set -e
  if [ "$TAR_RC" -gt 1 ]; then
    echo "ERROR: tar failed with exit $TAR_RC" >&2
    exit "$TAR_RC"
  fi
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

  # Build JSON with Python so % and quotes in payloads cannot break printf.
  "$PY" - "$STAMP" "$DB_JSON" "$SNAP" "$INTAKE" <<'PY'
import json, sys
stamp, path, snap_raw, intake_raw = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
try:
    snap = json.loads(snap_raw)
except Exception:
    snap = []
try:
    intake = json.loads(intake_raw)
except Exception:
    intake = []
payload = {
    "stamp": stamp,
    "kind": "database",
    "clinic_snapshot": snap,
    "intake_submissions": intake,
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(payload, f)
post = {"stamp": stamp, "kind": "database", "data": payload}
with open(path + ".post.json", "w", encoding="utf-8") as f:
    json.dump(post, f)
PY

  curl -fsS -X POST "${SUPABASE_URL%/}/rest/v1/clinic_backups" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    --data-binary @"$DB_JSON.post.json" >/dev/null || echo "WARN: could not post database row to clinic_backups" >&2
  rm -f "$DB_JSON.post.json"

  "$PY" - "$STAMP" "$PORTAL_DIR/supabase-row.json" <<'PY'
import json, sys
stamp, out = sys.argv[1], sys.argv[2]
row = {
    "stamp": stamp,
    "kind": "portal",
    "data": {"artifact": "actions-artifact", "stamp": stamp},
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(row, f)
PY
  curl -fsS -X POST "${SUPABASE_URL%/}/rest/v1/clinic_backups" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    --data-binary @"$PORTAL_DIR/supabase-row.json" >/dev/null || echo "WARN: could not post portal row to clinic_backups" >&2
else
  printf '{"stamp":"%s","error":"Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY GitHub secrets"}\n' "$STAMP" > "$DB_JSON"
  echo "WARN: missing Supabase secrets — wrote placeholder database backup only" >&2
fi

# Mirror into repo backups/ for artifact path discovery (do not commit PHI JSON).
mkdir -p "$ROOT/backups/portal/$STAMP" "$ROOT/backups/database/$STAMP"
cp -f "$PORTAL_DIR/portal-files.tar.gz" "$ROOT/backups/portal/$STAMP/" 2>/dev/null || true
printf '{"stamp":"%s","storedIn":"supabase clinic_backups + private Actions artifact","phi":"redacted-in-workspace"}\n' "$STAMP" \
  > "$ROOT/backups/database/$STAMP/README.json"
cp -f "$DB_JSON" "$ROOT/backups/database/$STAMP/patients-database.json" 2>/dev/null || true
printf '%s\n' "$STAMP" > "$PUBLIC_MARK"

echo "Backup complete: $STAMP (Supabase + private artifact; do not commit patients-database.json)"
