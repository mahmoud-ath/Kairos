#!/usr/bin/env bash
#
# Repository guards that ESLint cannot express.
#
# Two things are checked, both of which have bitten adjacent projects and would be
# invisible in a diff review:
#
# 1. **Raw SQL.** The app talks to PostgreSQL through Prisma Client, which is
#    parameterised by construction. One `$queryRawUnsafe` with a string built from
#    input would undo that in a single line, and `docs/database-roles.md` §7 counts
#    "no dynamic SQL" as the main compensating control for not having a
#    DML-only role. The only permitted raw statement is the rate-limit counter,
#    which interpolates values (never identifiers) through a tagged template.
#
# 2. **Production secrets in the working tree.** `.env.production.local` used to be
#    loaded by `next start`; it now lives outside the repository. A file with a
#    remote database host in it must not come back.
#
# Exit code 1 on a violation, with the file and line, so CI fails loudly.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

status=0
fail() { echo "✗ $*" >&2; status=1; }

# --- 1. raw SQL --------------------------------------------------------------

# Never acceptable anywhere in the app.
if hits=$(grep -rn --include='*.ts' --include='*.tsx' \
    -e '\$queryRawUnsafe' -e '\$executeRawUnsafe' -e 'Prisma\.raw' -e '\$runCommandRaw' \
    src/ 2>/dev/null); then
  fail "unsafe/dynamic SQL is not allowed:" ; echo "$hits" >&2
fi

# Tagged raw queries are allowed only where they are reviewed, and only as a
# tagged template (parameters), never as a string argument.
allowed_raw="src/server/rate-limit.ts"
if hits=$(grep -rln --include='*.ts' -e '\$queryRaw' -e '\$executeRaw' src/ 2>/dev/null \
    | grep -v "^$allowed_raw$"); then
  fail "raw SQL outside $allowed_raw — use Prisma Client, or extend this allowlist deliberately:"
  echo "$hits" >&2
fi

# --- 2. production env files in the tree -------------------------------------

for candidate in .env.production.local .env.production .env.vercel.local; do
  if [[ -f "$candidate" ]]; then
    fail "$candidate is in the repository root — production values belong in ~/.config/kairos/ (docs/security-environment.md)"
  fi
done

# --- 3. the guard script itself must stay executable and parse --------------

for script in scripts/with-prod-env.sh scripts/check-auth-limits.sh scripts/install-hooks.sh \
              .githooks/pre-commit; do
  if [[ -f "$script" ]] && ! bash -n "$script"; then
    fail "$script does not parse"
  fi
done

if [[ $status -eq 0 ]]; then
  echo "✓ repository guards passed (no dynamic SQL, no production env file in the tree)"
fi
exit $status
