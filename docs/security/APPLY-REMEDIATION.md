# Applying the remediation patch

`amplivo-remediation.patch` contains the code-side fixes recommended in
`OWASP-TOP10-ASSESSMENT.md` and `SECRETS-LEAK-REPORT.md`. The working tree has
**not** been modified — this patch lets you review and apply the changes
yourself.

## What it fixes

| File | Fix |
|---|---|
| `Backend/app/modules/file_manager/routes.py` | Upload **allowlist** (extension + MIME) — blocks HTML/SVG/JS stored-XSS (CRITICAL-1) |
| `Backend/app/modules/file_manager/service.py` | `DELETE` now **unlinks the physical file**, not just the DB row (CRITICAL-2 / BAC-2) |
| `Backend/app/main.py` | **Disable `/docs` + OpenAPI + `/redoc` in production**; fail-closed guard if JWT secret is still the placeholder (MED-1/CRITICAL-2) |
| `Backend/app/core/config.py` | `DATABASE_URL` + `JWT_SECRET_KEY` defaults removed — must come from env (CRITICAL-2) |
| `Backend/app/modules/activity_timeline/*` | **Tenant scoping** for `/activity-logs`: client roles see only their own logs (BAC-1) |
| `Backend/audit.py`, `test_api.py`, `test_db.py`, `create_missing_tables.py` | Secrets read from env instead of hardcoded |
| `frontend/src/store/authStore.ts` | Token persisted to **sessionStorage** instead of localStorage (MED-2) |

## Apply

```powershell
cd "C:\Users\DELL\Downloads\Amplivo Checkups\AMPLIVO"
git apply --check docs/security/amplivo-remediation.patch   # dry-run
git apply docs/security/amplivo-remediation.patch           # apply
```

Requirements after applying (these are owner-only actions, not patchable):

1. **Rotate the Supabase DB password and JWT secret** — they are public in git
   history; purge with `git filter-repo`.
2. Delete the still-live XSS probe
   `https://amplivo.onrender.com/uploads/8f11f67e7e5c444483d8dfd436c48920.html`
   from `UPLOADS_DIR` on the Render host.
3. Set `DATABASE_URL` + `JWT_SECRET_KEY` in the Render env / `.env` (the patch
   removes the baked-in defaults).
4. Upgrade `pyjwt`, `starlette`, `python-multipart`; re-run audits.

> Note for Windows: the repo tracks files as-is (`core.autocrlf=true`), so the
> patch was generated with CRLF content to match your working tree. If you see
> fuzz warnings during apply, run `git apply --reject` and inspect `.rej` files.

## Verification performed

`git apply --check` passes for all 12 files, and applying the patch in a clean
mirror produced byte-identical output for all 12 target files.