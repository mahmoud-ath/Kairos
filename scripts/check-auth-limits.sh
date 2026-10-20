#!/usr/bin/env bash
#
# Report — and optionally set — the Supabase Auth rate limits.
#
# Kairos has its own per-account limiter for the app's mutations (see
# docs/rate-limiting.md), but `/login`, `/register` and password reset talk to
# Supabase directly from the browser: those requests never pass through the app.
# So the GoTrue limits are the *only* control on credential stuffing and on
# outbound email, and they are not exposed by the public `/auth/v1/settings`
# endpoint — they need the Management API.
#
# Usage
#   scripts/check-auth-limits.sh                # print current values
#   scripts/check-auth-limits.sh --apply        # set the recommended values
#
# Requires a personal access token (https://supabase.com/dashboard/account/tokens)
# in SUPABASE_ACCESS_TOKEN, and the project ref in SUPABASE_PROJECT_REF (or derived
# from NEXT_PUBLIC_SUPABASE_URL).
set -euo pipefail

api="https://api.supabase.com/v1"
apply=0
[[ "${1:-}" == "--apply" ]] && apply=1

token="${SUPABASE_ACCESS_TOKEN:-}"
if [[ -z "$token" ]]; then
  cat <<'MSG'
No SUPABASE_ACCESS_TOKEN, so the current limits cannot be read.

  · Create a personal access token: https://supabase.com/dashboard/account/tokens
  · Then:  SUPABASE_ACCESS_TOKEN=sbp_… scripts/check-auth-limits.sh

What to check by hand (Dashboard → Authentication → Rate Limits), and why it
matters for this app:

  Email sent        10 per hour   signup confirmation / password reset. The
                                  default of 30/hour is the one an attacker uses
                                  to burn your mail quota and get you blocked.
  Sign-ups          10 per hour   the app is public, so this is the only brake on
  & sign-ins                      scripted account creation.
  Token refreshes   150 per 5 min  left at the default; a real session refreshes
                                  several times an hour.
  Token verifications 30 per hour  default.

Also worth a look on the same page: "Enable email confirmations" — Kairos runs
with it OFF (mailer_autoconfirm), so a stolen address cannot be used to send mail
at signup, but it also means an address is not proven to exist.
MSG
  exit 0
fi

ref="${SUPABASE_PROJECT_REF:-}"
if [[ -z "$ref" ]]; then
  url="${NEXT_PUBLIC_SUPABASE_URL:-}"
  [[ -z "$url" ]] && url=$(grep -oE 'https://[a-z0-9]+\.supabase\.co' .env.local 2>/dev/null | head -1 || true)
  ref="${url#https://}"; ref="${ref%%.supabase.co}"
fi
if [[ -z "$ref" ]]; then
  echo "ABORT: unknown project ref — set SUPABASE_PROJECT_REF." >&2
  exit 1
fi

fields='rate_limit_email_sent|rate_limit_sms_sent|rate_limit_verify|rate_limit_token_refresh|rate_limit_sign_in_sign_ups|rate_limit_token_verifications|rate_limit_web3'

current=$(curl -sS "$api/projects/$ref/config/auth" -H "Authorization: Bearer $token")

echo "project: $ref"
echo
echo "$current" | tr ',' '\n' | grep -E "^\"?($fields)" | sed 's/^"//; s/":/ = /; s/"$//'
echo

if [[ $apply -eq 0 ]]; then
  echo "Dry run. Re-run with --apply to set the recommended values:"
  echo "  email sent 10/h · sign-ups 10/h · verifications 30/h · refresh 150/5min"
  exit 0
fi

body=$(cat <<'JSON'
{
  "rate_limit_email_sent": 10,
  "rate_limit_sign_in_sign_ups": 10,
  "rate_limit_verify": 30,
  "rate_limit_token_verifications": 30,
  "rate_limit_token_refresh": 150
}
JSON
)

code=$(curl -sS -o /tmp/kairos-auth-limits.json -w '%{http_code}' -X PATCH \
  "$api/projects/$ref/config/auth" \
  -H "Authorization: Bearer $token" -H "Content-Type: application/json" \
  -d "$body")

if [[ "$code" != "200" ]]; then
  echo "FAILED ($code):" >&2
  head -c 400 /tmp/kairos-auth-limits.json >&2
  exit 1
fi

echo "Applied. Verify with: scripts/check-auth-limits.sh"
