# Security Remediation Status

**Date:** 2026-08-09
**Scope:** Full remediation pass triggered by the CRIT/MED findings from `STRIX-PENTEST-RESULTS.md`, `SECRETS-LEAK-REPORT.md`, and `LOGGING-MONITORING-GAPS.md` (backend + frontend + CI). All code-level items are done and verified; a short list of owner-only manual items remains below.

## Fixed & Verified (code)

| Item | Fix | Verification |
|---|---|---|
| **CRIT-1** Stored XSS via `/files/upload` | Extension + MIME allowlists (`_ALLOWED_EXTENSIONS`, `_ALLOWED_MIME_TYPES`, `_DENIED_MIME_PREFIXES`); empty/oversize (>20 MB) + bad filename rejection; server-generated `uuid+ext` stored names; path-traversal-guarded `_unlink_physical()` on delete | `test_file_upload_allowlist.py` — 5 tests, all pass |
| **CRIT-1b** `/uploads` served HTML/SVG inert | `_HardenedStaticFiles` forces `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment` on HTML/SVG/XML/JS/JSON | in `app/main.py`; covered by suite |
| **CRIT-2** hardcoded secrets (`REDACTED`, hardcoded `DATABASE_URL`/`JWT` in scripts & docs) | Removed from `.py`/`render.yaml`; scripts read `DATABASE_URL` from env; `DEPLOYMENT_REPORT.md` redacted; CI `secret-scan` job (gitleaks + `git log -S` guard) added | `git grep` clean; CI workflow updated |
| **MED-1** auth token persisted in `localStorage` | Frontend `authStore.ts` switched to `createJSONStorage(() => sessionStorage)` | `tsc --noEmit` passes |
| **MC-1** no metrics/docs exposure/retention control | `prometheus-fastapi-instrumentator 7.1.0` exports `/metrics` (excludes `/health`, `/health/ready`, `/`); docs/openapi pinned to non-production env only (constructor-gated); `_purge_old_audit_logs()` retention task (`AUDIT_LOG_RETENTION_DAYS=90`) in lifespan | `/api/v1/docs` dev-only test passes; suite green |
| Dependency CVEs (`npm audit` 6 high) | `npm audit fix` → **0 vulnerabilities**; backend pins bumped to non-yanked versions (fastapi 0.115.12, uvicorn 0.34.2, sqlalchemy 2.0.36, pydantic 2.10.4, pyjwt 2.10.1, etc.) | venv imports verified |

**Regression suite:** `Backend` `python -m pytest -q` → **194 passed, 0 failed** (includes 5 new upload-allowlist tests and the dev-docs route test).

## Owner Manual Items (not code — need your action)

1. **Rotate secrets.** Change the Supabase Postgres password and issue a new `JWT_SECRET_KEY`; update Render env vars (never commit).
2. **Purge git history** of the leaked `REDACTED` string (e.g. `git filter-repo --replace-text` + force-push) so old commits no longer carry the credential.
3. **Delete the live probe file** on Render: `/uploads/8f11f67e7e5c444483d8dfd436c48920.html`.
4. **Deploy** the patched `main.py`/`routes.py`/`requirements.txt` + frontend `vercel.json`/`authStore.ts`; set Render env secrets in the dashboard.
5. **Log sink / alerting** from `LOGGING-MONITORING-GAPS.md` requires third-party keys (e.g. external SIEM) — not implementable as code here.