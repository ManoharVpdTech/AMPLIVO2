# Amplivo — Secret Management Policy & Implementation

**Date:** 2026-08-09 · **Complements `SECRETS-LEAK-REPORT.md` + `GIT-SECRET-HISTORY-REPORT.md`**

This document defines how Amplivo stores, injects, and protects secrets after
the leak remediation. It never contains a secret.

## Principles

1. **No secrets in the repository** — not in code, not in configs, not in docs.
2. **Env-gated features** — credentials come from environment / secret store
   only; missing values degrade gracefully or fail-closed, never boot insecure.
3. **Fail-closed in production** — missing/placeholder `JWT_SECRET_KEY` or
   `DATABASE_URL` aborts boot (`Backend/app/core/config.py` validator) instead
   of running with a known key.
4. **CI regression guard** — a committed credential is caught within the same
   tree it lands in; history exposure is a separate operator process.

## Inventory

| Secret | Production source | Committed default (dev only) | Boot behavior when absent |
|---|---|---|---|
| `DATABASE_URL` | Render env var | `postgresql+asyncpg://postgres:postgres@localhost:5432/amplivo_erp` | **fail-closed** if production + placeholder/empty |
| `JWT_SECRET_KEY` | Render env var | `""` (empty) | **fail-closed** if production + empty/placeholder |
| `SENTRY_DSN` | Render env var | none | feature inert (no SDK init) |
| `LOG_FORWARD_URL`/`TOKEN` | Render env var | *(unset)* | forwarder disabled |
| `BREVO_API_KEY`, Supabase keys, AWS/GCP keys | env vars (dashboard/secret store) | none committed | feature-specific |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel build env | none | SDK not bundled |

## CI protection (regression-proof)

`.github/workflows/ci-cd.yml` `secret-scan` job (runs on every push/PR):

1. **Gitleaks** (default rules, full history via `fetch-depth: 0`) — catches
   any credential pattern.
2. **Known-leaked credential digest guard** —
   `scripts/secret-digest-guard.py` (Python stdlib):
   - SHA-256 fingerprint of the previously leaked password literal is stored in
     the script; **the plaintext is never committed**.
   - Every tracked file is scanned as alphanumeric tokens (catches the string
     embedded in URLs/paths), any match → exit nonzero → build fails.
   - Local verification: "OK: scanned 761 tracked files" exit 0 on the current
     tree; a planted copy was positively detected (1 hit).

Both steps reject the PR before merge; the fingerprint guard specifically
prevents the past credential from ever reappearing.

## Lifecycle (operator checklist)

1. **Onboarding**: add secrets via Render/Vercel env dashboard; keep
   `frontend/.env*.local` + `Backend/.env` out of git (gitignored).
2. **Live rotation**: rotate in provider dashboard → set new env value →
   redeploy → **delete the old value everywhere in history** (below).
3. **History purge** (one-time, owner): follow the exact
   `git filter-repo` block in `GIT-SECRET-HISTORY-REPORT.md`, then rotate the
   credential *again* because any historical value is exposed.
4. **Mark deprecated** the leak reports once purge + rotation are complete.

## Enforcement in tooling

- **Frontend**: custom ESLint rule `amplivo/no-dangerous-html`
  (`eslint-rules/no-dangerous-html.js`) rejects `dangerouslySetInnerHTML` on
  anything except `<style>` (static CSS only) — closes the XSS route to
  sessionStorage-held tokens.
- **Backend**: `TRUSTED_PROXIES` guards `X-Forwarded-For`; login/audit PII is
  scrubbed by the Sentry `before_send`.
- **Dependency hygiene**: `pip-audit` + `npm audit` gate in CI; both
  currently clean (0 vulnerabilities).