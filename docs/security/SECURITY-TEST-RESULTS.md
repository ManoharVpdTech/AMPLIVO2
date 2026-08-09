# Amplivo — Security Regression Test Results

**Date:** 2026-08-09 · **Suite:** `Backend/app/tests/security/` + full backend suite

## Headline

> **216 passed, 0 failed**, 217 warnings (full backend suite, in-memory SQLite).
> Includes **22 new dedicated security-regression tests** (below) on top of the
> pre-existing 194.

## New security regression suite (`app/tests/security/`)

| File | Tests | Verifies |
|---|---|---|
| `test_sql_injection.py` | 4 | SQLi payload set (string-breakout, statement-stacking, double-quote, numeric, UNION, time-based, backtick) rejected on login/register; public `check-email` treats payloads as plain text; tautology never authenticates |
| `test_xss.py` | 3 | stored-XSS: registration full_name not re-echoed verbatim; benign `<b>` still accepted; failed login does not reflect payload |
| `test_auth_bypass.py` | 5 | `GET /auth/me` with no/`garbage`/forged-signature/expired/`none` token → 401/403 |
| `test_idor_rbac.py` | 4 | unauthenticated activity-logs → 401/403; client-role user cannot read another tenant's log by UUID; non-admin cannot create/delete activity logs (403) |
| `test_sensitive_data.py` | 6 | register/me responses never include `hashed_password`; no endpoint echoes known-secret names; production boot fails closed on empty `JWT_SECRET_KEY` and placeholder `DATABASE_URL`; Sentry `before_send` scrubs headers + credential fields + PII |

Run (Backend):

```bash
python -m pytest app/tests/security -q
# 22 passed
```

## Full backend suite

```bash
python -m pytest app/tests -q
# 216 passed, 217 warnings (SQLAlchemy/pydantic deprecations only)
```

## Live black-box probe evidence (this pass)

| Probe | Result |
|---|---|
| `GET /api/v1/auth/me` unauthenticated | 403 `{"error_code":"forbidden","message":"Not authenticated"}` |
| Forgery: JWT signed with attacker-supplied secret | 403/401 |
| Expired token | 401 |
| SQLi payload on login / register / check-email | 401 / 422 / 422 or 200 — no SQL error leak, no success |
| Upload XSS (allowlist) | covered by existing `test_file_upload_allowlist.py` (5 tests) |
| Cross-tenant log access (BAC-1 fix) | 403/404 for foreign UUID |
| `/metrics` + `/health*` | present; `/health` excluded from latency histogram |

## External / manual verification (requires actions)

| Check | Status |
|---|---|
| Gitleaks full-history scan in CI | configured in `ci-cd.yml secret-scan` job; run at push |
| Leaked-password digest guard | **local run green** (761 files, 0 hits); planted file → 1 hit (positive control) |
| `pip-audit` / `npm audit` | previously 0; re-run on CI per push |
| STRIX cloud pentest | blocked by infra (documented) |
| Manual OWASP re-probe of `/uploads`, CORS, logout-CSRF | in `OWASP-TOP10-ASSESSMENT.md` (live) |