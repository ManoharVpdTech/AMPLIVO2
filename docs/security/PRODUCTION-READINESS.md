# Amplivo — Production Readiness Checklist

**Date:** 2026-08-09 · **Owner:** deployment operator · **Complements** `SECURITY-TEST-RESULTS.md`, `SECRET-MANAGEMENT.md`, `GIT-SECRET-HISTORY-REPORT.md`

Everything on this page is code-verified with the credentials the repository
can hold; the remaining items are **deployment / dashboard** actions that need
a human (or a Render/Vercel connection only the owner has).

## ✅ Code-verified ready

| Area | Evidence |
|---|---|
| Full backend suite | **216 passed** (`pytest app/tests`) incl. 22 security-regression tests |
| Frontend typecheck | `tsc --noEmit` passes |
| Frontend production build | `next build` succeeds (Sentry instrumentation included) |
| Secrets regression guard | CI `secret-scan` job: Gitleaks + SHA-256 digest guard; local green, positive control fires |
| Fail-closed prod boot | empty `JWT_SECRET_KEY` / placeholder `DATABASE_URL` → boot error via settings validator |
| /docs + openapi off in prod | constructor-gated (`docs_url=None` when `ENVIRONMENT=production`) |
| File upload allowlist | `.html`/`.svg`/MIME-mismatch rejected; physical file unlinked on delete |
| Session/RBAC | 37 route-guard tests pass; activity-log tenant scoping (BAC-1) fixed & covered |
| XFF-spoof mitigation | `TRUSTED_PROXIES`-gated `X-Forwarded-For` parsing |

## ⏳ — Operator actions

1. **Set secrets in dashboards**
   - Render: `DATABASE_URL`, `JWT_SECRET_KEY`, `SENTRY_DSN`, `LOG_FORWARD_URL`(+`TOKEN`)
   - Vercel: `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_API_URL`
   - Never commit these; `.env*.local` gitignored.
2. **Rotate & purge history**
   - Change Supabase DB password + JWT secret; update then delete old values everywhere.
   - `git filter-repo --invert-paths --path…` per `GIT-SECRET-HISTORY-REPORT.md` → force-push → rotate again.
3. **Live probes to repeat after deploy**
   - `GET /api/v1/auth/me` unauthenticated → 401/403, no stack
   - `GET /api/v1/docs` → should be 404 in prod
   - upload `.html` → rejected; `GET /uploads/<name>.html` → blocked
   - burst login → 429 with `Retry-After`
4. **Dependencies** — re-run and push `pip-audit` / `npm audit` gates in CI for every release.

## Recurring (every release)

- [ ] `python -m pytest Backend` (full)
- [ ] `pip-audit` + `npm audit` → 0
- [ ] `frontend: tsc --noEmit && npm run build`
- [ ] gitleaks-run green on PR
- [ ] secret-digest guard green
- [ ] e2e (Playwright) green

## Risk register (known open)

| Item | Owner | Due |
|---|---|---|
| STRIX managed scan (infra) | ops | after deploy |
| SonarQube static pass | ops | needs token |
| Enable `LOG_FORWARD_URL` at a collector | ops | post-deploy |