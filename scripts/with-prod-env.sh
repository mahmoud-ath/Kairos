#!/usr/bin/env bash
#
# Run one command against production, and nothing else.
#
# The incident this exists for: `set -a; . ./.env.production.local` exports the
# production `DATABASE_URL` into an *interactive shell*, and every later command in
# that terminal — including `bun run test:integration` — silently talks to real
# user data. There is no undo for a `migrate reset`.
#
# So this script is the only sanctioned way to reach production, and it is built so
# that it cannot leak:
#
#   1. the variables are read into **this script's** environment, never the
#      caller's — the command runs as a child process and they die with it;
#   2. the file is read, not sourced, so a stray `rm -rf /` in it cannot execute;
#   3. the target host is printed before anything runs, and the command is refused
#      unless the host is the one named in `KAIROS_PROD_DB_HOST` (default
#      `db.prisma.io`) or the caller sets `KAIROS_ALLOW_ANY_PROD_DB=1`;
#   4. `--dry-run` stops after the checks.
#
# Usage
#   scripts/with-prod-env.sh <command> [args...]
#   scripts/with-prod-env.sh --print <command> [args...]   # show the plan, run nothing
#   scripts/with-prod-env.sh --dry-run <command> [args...] # checks only
#
# Examples
#   scripts/with-prod-env.sh bunx prisma migrate status
#   scripts/with-prod-env.sh bunx prisma migrate deploy
#   scripts/with-prod-env.sh bunx tsx scripts/check-rate-limit-store.ts
#
# The file lives OUTSIDE the repository on purpose (see
# docs/security-environment.md): a `.env.production*` in the repo root is picked up
# by `next start` as well, which is how a laptop ends up querying the production
# database without anyone asking for it.
set -euo pipefail

PROD_ENV_FILE="${KAIROS_PROD_ENV_FILE:-$HOME/.config/kairos/production.env}"
PROD_DB_HOST="${KAIROS_PROD_DB_HOST:-db.prisma.io}"

print_plan=0
dry_run=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --print) print_plan=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    -h|--help) sed -n '2,36p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --) shift; break ;;
    *) break ;;
  esac
done

if [[ $# -eq 0 ]]; then
  echo "usage: $(basename "$0") [--print|--dry-run] <command> [args...]" >&2
  exit 64
fi

if [[ ! -f "$PROD_ENV_FILE" ]]; then
  cat >&2 <<MSG
ABORT: no production environment file at
  $PROD_ENV_FILE

Create it yourself, outside the repository, with only the values you need:

  mkdir -p "\$(dirname "$PROD_ENV_FILE")"
  install -m 600 /dev/null "$PROD_ENV_FILE"
  \$EDITOR "$PROD_ENV_FILE"
  # DATABASE_URL=...   (pooled host)
  # DIRECT_URL=...     (direct host, used by prisma migrate)
MSG
  exit 1
fi

# Refuse a file the rest of the machine can read: it holds production credentials.
if perms=$(stat -c '%a' "$PROD_ENV_FILE" 2>/dev/null); then
  if [[ "$perms" != "600" && "$perms" != "400" ]]; then
    echo "ABORT: $PROD_ENV_FILE is mode $perms — run: chmod 600 $PROD_ENV_FILE" >&2
    exit 1
  fi
fi

# Read, do not source. Only the names this project uses are accepted, so a typo
# cannot quietly become "no variables at all" and point the command at a local
# database instead.
declare -a loaded=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
  [[ "$line" =~ ^[[:space:]]*([A-Z0-9_]+)[[:space:]]*=[[:space:]]*(.*)$ ]] || continue
  name="${BASH_REMATCH[1]}"
  value="${BASH_REMATCH[2]}"
  # Strip one layer of matching quotes.
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  case "$name" in
    DATABASE_URL|DIRECT_URL|NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|VAPID_PRIVATE_KEY|VAPID_SUBJECT|NEXT_PUBLIC_VAPID_PUBLIC_KEY|KAIROS_CRON_SECRET|CRON_SECRET)
      export "$name=$value"
      loaded+=("$name")
      ;;
    *) echo "note: ignoring unrecognised key $name in $PROD_ENV_FILE" >&2 ;;
  esac
done < "$PROD_ENV_FILE"

if [[ ${#loaded[@]} -eq 0 ]]; then
  echo "ABORT: $PROD_ENV_FILE defined no recognised variables." >&2
  exit 1
fi

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "ABORT: DIRECT_URL is missing — migrations must not run over the pooled host." >&2
  exit 1
fi

host_of() {
  printf '%s' "${1#*://}" | sed -E 's|^[^@]*@||; s|[:/?].*$||'
}

direct_host=$(host_of "$DIRECT_URL")

case "$direct_host" in
  localhost|127.0.0.1|::1|db)
    echo "ABORT: DIRECT_URL points at '$direct_host', which is not production." >&2
    exit 1
    ;;
esac

if [[ "$direct_host" != "$PROD_DB_HOST" && "${KAIROS_ALLOW_ANY_PROD_DB:-0}" != "1" ]]; then
  cat >&2 <<MSG
ABORT: DIRECT_URL host is '$direct_host', but this project's production database is
  '$PROD_DB_HOST'.

If that is really intended, set KAIROS_ALLOW_ANY_PROD_DB=1 for this call.
MSG
  exit 1
fi

cat <<MSG
── production ───────────────────────────────────────────────────────────
  env file   $PROD_ENV_FILE
  database   $direct_host
  variables  ${loaded[*]}
  command    $*
─────────────────────────────────────────────────────────────────────────
MSG

if [[ $print_plan -eq 1 || $dry_run -eq 1 ]]; then
  echo "Checked only — nothing was run."
  exit 0
fi

# The child gets exactly the variables above plus PATH/HOME, and nothing else:
# a stale local DATABASE_URL or an inherited NODE_ENV cannot ride along, so the
# command cannot accidentally target two databases at once.
passthrough=(PATH="$PATH" HOME="$HOME")
for name in "${loaded[@]}"; do
  passthrough+=("$name=${!name}")
done

exec env -i "${passthrough[@]}" "$@"
