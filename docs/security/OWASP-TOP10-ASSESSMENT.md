# Amplivo — OWASP Top 10 (2021) End-to-End Assessment

**Date:** 2026-08-08
**Targets:**
- Static: `Backend/` (FastAPI, 449 routes) + `frontend/` (Next.js 16)
- Live API: `https://amplivo.onrender.com`
- Live frontend: `https://amplivo.vercel.app`
- Public domain `https://www.amplivo.in` — **PARKED (Hostinger), app NOT deployed there**

**Method:** static review, automated dependency audits (pip-audit + npm audit), live black-box probes, full backend pytest suite, Playwright e2e, Lighthouse. Strix automated scan **blocked by infrastructure** (managed API 500 on all writes; local CLI needs Docker + LLM key) — the assessment below is the delivered pentest, fully manual + tooled (see STRIX-PENTEST-RESULTS.md).

## Result Summary

| OWASP 2021 | Control | Tested | Verdict | Evidence |
|---|---|---|---|---|
| A01 Broken Access Control | RBAC + tenant scoping | Live + suite | **PARTIAL/FAIL** | Object-level scoping holds (foreign client/lead → 403); but client role reads **global internal `/activity-logs`** (cross-user). See BAC-1 |
| A02 Cryptographic Failures | bcrypt-12, JWT HS256, TLS1.2/1.3 | Live + suite | **PASS (RED FLAG: secret in repo)** | JWT secret default `CHANGE_ME_IN_PROD`; DB password leaked; HSTS ok |
| A03 Injection | ORM-only SQL | Live + suite | **PASS** | All queries via SQLAlchemy ORM; 5 SQLi payloads → 401/403, no 500/error leak |
| A04 Insecure Design | Rate limit, lockout, CSRF | Live + suite | **PASS** | 429 after burst; CSRF 403 on missing token; lockout tests green |
| A05 Security Misconfiguration | Headers/CORS/docs | Live | **PARTIAL** | Strong headers on API; `/api/v1/docs` + full OpenAPI exposed on prod |
| A06 Vulnerable Components | PyPI/npm audit | Static | **FAIL (HIGH)** | pyjwt 12 CVEs, starlette 9, python-multipart 6, frontend 4 high (next/sharp/postcss/nanoid) |
| A07 Identification/Auth | JWT rotation, lockout, token in localStorage | Live + suite | **PARTIAL** | Auth solid; access token in localStorage = XSS-exfiltratable (see upload XSS) |
| A08 Integrity (software & data) | File upload/CSRF | Live | **FAIL (CRITICAL)** | Upload allows `.html` (no MIME/allowlist) → **stored XSS confirmed in prod** |
| A09 Logging & Monitoring | see GAPS report | Static | **FAIL / GAP** | Structured stderr JSON + audit_logs exist; NO central collector/tracing/alerting |
| A10 SSRF | outbound fetch | Static | **PASS** | Only fixed Brevo endpoint; no user-controlled URL fetch |

## Critical Findings

### CRITICAL-1 — Stored XSS via unrestricted file upload (A08 / A07)
No `Content-Type`/extension **allowlist**. Uploader keeps `filename`'s suffix and serves whole `uploads/` dir via StaticFiles.
- Source: `Backend/app/modules/file_manager/routes.py:51-54`, `Backend/app/main.py:131`
- **Live PoC executed**: uploaded `test.html` (script) → 201; `GET /uploads/<uuid>.html` → `200 Content-Type: text/html`, script reachable by any visitor. Post-auth user can plant a script that runs in any browser that opens the URL (steal any visitor's cookies → account takeover for any role). Asset: `https://amplivo/...` publicly servable.
- Pre-existing row `4da87e08...html` in `files` table confirms this is a real path.

### CRITICAL-2 — Production DB password + JWT secret committed / weak defaults
- `Backend/app/core/config.py:19` — `DATABASE_URL` default embeds **live** Supabase password `REDACTED` (pooler `postgres.fhxkiprlcdwbgtaxlffk`). Same password at `audit.py:6`, `test_db.py:6`, `test_api.py:10`, `create_missing_tables.py:69`, `docs/DEPLOYMENT_REPORT.md:51`.
- **Git history leak chain (7 commits):** 324516d, 2eacd52, 4945de8, 3a35ef7, 9a48a0c, b8c535f, 5a177f6 — password present since *first commit*.
- `config.py` default `JWT_SECRET_KEY = "CHANGE_ME_IN_PRODUCTION"` — if `.env` missing on a host, HMAC key is public constant (catastrophic JWT forgery).

### HIGH-1 — Dependency vulnerabilities
- **Backend** 31 vulns / 6 pkgs with `pip-audit`:
  - `pyjwt==2.9.0` → 12 advisories (PYSEC-2025-183 & PYSEC-2026-1xx; fix ≥2.12/2.13)
  - `starlette==0.38.6` → 9 (fix ≥ 0.40/1.x)
  - `python-multipart==0.0.20` → 6 (fix ≥ 0.0.22-0.0.31)
  - orjson 2, brotli 1, python-dotenv 1
- **Frontend** — 4 high `npm audit --omit=dev`: `next` ≤16.0.3-preview depends on vulnerable `postcss` / `sharp`; `nanoid <3.3.17`.

### MED-1 — Production docs/OpenAPI shipped
`https://amplivo.onrender.com/api/v1/docs` 200 and `openapi.json` returns **552KB of schemas**. Reveals endpoints, models, and DB schema to unauthenticated visitors.
**Fix:** set `docs_url=None, redoc_url=None, openapi_url=None` when `ENVIRONMENT="production"`.

### BAC-1 — Client role reads global audit trail (`/activity-logs`) — Broken Access Control
Live probe with a **client-portal token**:
- `GET /api/v1/activity-logs` → **200** returning 100 internal audit rows for **4 distinct users** (none of them the caller's own id). These logs include entity IDs, action descriptions ("Task '…' status changed", "Lead '…' created"), user IDs and IPs of other tenants' operations.
- Contrast: same client token gets **403/404** on `/clients/{foreign}`, `/leads/{foreign}`, `/clients/{foreign}/invoices|documents` → object-level scoping works. Audit log is the broken endpoint (no tenant/user filter).
- Same client token also gets 200 on `/analytics/reports`, `/analytics/dashboards`, `/seo/projects` (low-risk read-only data), while `/users`, `/settings/system`, `/approvals/policies`, `/teams`, `/finance/payments` correctly return 403.
- **Impact:** any portal (client) credential enumerates internal security/activity events — aids targeted lateral attacks and exposes operational data across tenants.
- **Fix:** thread `scoped_client_id` into the activity-log list query (like file/clients), or allow only `user_id == current` for non-admin roles; add permission tag on route.

### BAC-2 — File DELETE removes metadata, not the file (broken function + persistent XSS)
- `DELETE /files/{id}` → 204 (row gone) but the **physical file keeps being served** at `/uploads/<name>`.
- Verified live: uploaded `xss-probe.html` → deleted (204) → `GET /uploads/<name>.html` **still 200 `text/html`** with live `<script>`.
- Source: `Backend/app/modules/file_manager/service.py:56-58` only calls `repo.delete(id)` — never `unlink`/quarantine. So an attacker's XSS payload survives "deletion" indefinitely, and this is a permanent clean-up blocker.
- **Fix:** on delete, remove the file from `UPLOADS_DIR` (or quarantine) before/after row removal; log failures; purge orphan files on startup sweep. Note CRITICAL-1 still applies (allowlist must block `.html` on upload in the first place).

> ⚠️ **RESIDUAL TEST ARTIFACT:** my `xss-probe.html` upload is **still live** at `https://amplivo.onrender.com/uploads/8f11f67e7e5c444483d8dfd436c48920.html` (deleting the DB row did not remove the file). Remove it manually from `UPLOADS_DIR` on the Render host (or purge the whole dir) once the delete bug is patched.

### MED-2 — Access token lives in localStorage (frontend)
`frontend/src/services/api.ts` + zustand-persist → JWT in `localStorage`. Amplified by the upload XSS: any script in a client/employee browser can `localStorage.getItem('amplivo_token')`. Preferred: httpOnly Secure cookie (bearer) or at least sessionStorage.

### MED-3 — Deployed domain parked / dead
- `www.amplivo.in` → Hostinger "Parked Domain" page (no app, no SE-friendly robots, header leak: no security headers at all on that host).
- Stale `frontend/vercel.json` -> `NEXT_PUBLIC_API_URL=https://amplivo-2.onrender.com/api/v1` (**404**); live frontend actually calls `https://amplivo.onrender.com/api/v1` (confirmed from deployed bundle `2-l48-xoi2h9u.js`).

## Verified Strengths (PASS rows, not just claims)

| Control | Evidence |
|---|---|
| Rate limiter | 25 burst → 429 w/ `Retry-After`; per-path tables (login/register/refresh/forms) |
| CSRF | live POST w/ csrf cookie but `.refresh` header omitted → 403 `csrf_token_invalid`; double-submit + bearer-immune |
| Account lockout | 5 failed → locked; suite: `test_account_lockout.py` passed |
| SQLi | ORM-only, all `engine.execute` pass bound intents; 5 live SQLi payloads → no error reflected |
| Security headers (API | CSP(`default-src 'self'`), HSTS, X-Frame-Options DENY, nosniff, Permissions-Policy, SameSite cookie |
| Auth crypto | bcrypt 12 rounds; refresh rotation + reuse detection; session inactivity expiry |
| RBAC | suite `test_rbac_route_guards` passed (37 tests) |
| Audit | auth event audit_log rows written transactionally — see test_audit_log.py passed |
| e2e | Playwright 19/19 (14 marketing pages, 3 role portals, login+error) |
| Lighthouse | accessible (98) / SEO 92 / perf 56 (next bundles) |

## Full evidence log (black-box, `amplivo.onrender.com`)

```
health  GET /  → 200 {status:ok}
docs    GET /api/v1/docs  → 200 (open)
openapi GET /api/v1/openapi.json → 200 (552,139 bytes)
login   400 (missing identifier) → 422 (valid)
login bad   → 401 {invalid_credentials} + request_id/correlation_id
burst6+    → 429 (rate limit) w/ frontends
lockout  client@… 5 wrong → 401 then 429s (rate limit before lock) — by design (defense-in-depth)
logout   POST w/ cookie no token → 403 csrf_token_invalid
SQLi     5 payloads → 401/403, no 500, no SQL error leak
CORS      OPTIONS hostile origin → 400 w/o ACAO echo (misspelled hits 400, ACAC not echoed) — GOOD
upload   POST /files/upload 201 → GET /uploads/<uuid>.html 200 text/html (STORED XSS)
cleanup  DELETE /files/<id> → 204 (test file removed)
xss-re   POST /files/upload (xss-probe.html) 201 → unauth GET /uploads/<id>.html 200 text/html + alert(1)
xss-del  DELETE /files/<id> → 204 but GET /uploads/<id>.html STILL 200 text/html (delete bug)
portal   client token: GET /activity-logs 200 (100 rows / 4 users) — cross-user leak
portal   client token: GET /clients/{foreign} 403, /leads/{foreign} 404, /clients/{foreign}/invoices 404 — scoped OK
portal   client token: GET /users 403, /settings/system 403, /approvals/policies 403, /finance/payments 403 — gated OK
portal   client token: GET /leads, /analytics/reports, /seo/projects → 200 (own-scope read-only)
```

## Priority Remediation Order

1. **Rotate Supabase DB password + JWT secret now**; purge from git (history rewrite + `git filter-repo` on all 7 commits); move to env/secret store.
2. **File upload allowlist** (`.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xlsx`, MIME check + magic bytes) + serve uploads with `Content-Disposition: attachment` / separate origin; **and make DELETE unlink the physical file** (BAC-2).
3. Upgrade `pyjwt`, `python-multipart`, `starlette` (and `next`/`postcss`), re-run audits.
4. Close `/api/v1/docs` + `openapi.json` in production.
5. **Fix `/activity-logs` tenant scoping** — client token must not see global audit trail (BAC-1).
6. Move access token out of localStorage.
7. Deploy the real frontend to `www.amplivo.in` (currently parked) and fix `vercel.json`.