# Backend Deployment Report — Amplivo FastAPI Service

**Date:** 2026-07-28
**Scope:** Infrastructure only (Render deployment config, database connectivity, env vars, health/Swagger endpoints, middleware). No frontend source code was modified.

## Summary

The FastAPI backend code itself was already correct (449 routes register cleanly, middleware stack, lifespan, and health endpoints all work). The actual infra problems were in `render.yaml` — wrong Supabase pooler region and mismatched service URLs between the backend and frontend definitions. Both were confirmed by live testing, not just static inspection, and are now fixed.

## Issues Found & Fixed

### 1. Wrong Supabase connection pooler region (root cause of DB connection failures)
- **File:** `render.yaml`
- **Before:** `DATABASE_URL` pointed at `aws-0-ap-south-1.pooler.supabase.com`
- **Problem:** Verified by direct `asyncpg` connection test — this region returns `tenant/user postgres.fhxkiprlcdwbgtaxlffk not found`. The Supabase project's pooler actually lives in `ap-northeast-1`.
- **Fix:** Changed to `aws-0-ap-northeast-1.pooler.supabase.com` (matches the project's real region and the existing default already correctly set in `app/core/config.py`).
- **Verified:** Booted the app locally with this exact connection string — `/health/database` returned `200 {"status":"healthy","database":"connected"}`.

### 2. CORS origin mismatch would block the real frontend
- **File:** `render.yaml` (backend service)
- **Before:** `CORS_ORIGINS: https://amplivo.onrender.com` — a domain that doesn't match either Render service defined in this file or the Vercel domains already whitelisted in `Backend/.env`.
- **Fix:** Set to the actual known frontend origins: `https://amplivo-frontend.onrender.com,https://amplivo-front-and-backend.vercel.app,https://amplivo-2.vercel.app`.

### 3. Frontend pointed at a backend URL that doesn't exist
- **File:** `render.yaml` (frontend service)
- **Before:** `NEXT_PUBLIC_API_URL: https://amplivo-front-and-backend.onrender.com/api/v1` — this host does not correspond to the backend service defined in the same file (`name: amplivo-backend`, which Render serves at `https://amplivo-backend.onrender.com`). This is the "routes not reachable" symptom.
- **Fix:** Updated to `https://amplivo-backend.onrender.com/api/v1` to match the actual backend service name in this blueprint.
- **Note:** This is a deployment env var in the infra manifest, not frontend source code — no files under `frontend/` were touched.

### 4. No explicit health check path for Render
- **File:** `render.yaml` (backend service)
- **Fix:** Added `healthCheckPath: /health` so Render's zero-downtime deploy checks hit the DB-independent liveness endpoint rather than guessing.

## Verified Working (no changes needed)

| Item | Status | Evidence |
|---|---|---|
| App imports/boots without errors | ✅ | `python -c "import app.main"` → 449 routes registered |
| `GET /health` (liveness) | ✅ 200 | Does not touch DB by design |
| `GET /health/database` (readiness) | ✅ 200 | `{"status":"healthy","database":"connected"}` after pooler fix |
| `GET /api/v1/openapi.json` | ✅ 200 | Swagger schema generation works |
| `GET /api/v1/docs` | ✅ 200 | Swagger UI reachable |
| `GET /` | ✅ 307 → `/api/v1/docs` | Root redirect intact |
| API base path | ✅ `/api/v1` | `API_V1_PREFIX` consistent across `main.py`, router, and docs |
| Middleware stack | ✅ | CORS, UnhandledError, SecurityHeaders, RateLimiter, Audit, Session, Activity, Authentication all initialize and pass requests through correctly (order documented in `app/main.py`) |
| Startup lifespan | ✅ | DB check + idempotent demo-data seeding run at boot; DB failure is non-fatal by design (liveness must not depend on DB) |
| Alembic migrations in build step | ✅ | `render.yaml` build command runs `alembic upgrade head` before start |

## Recommendation (not fixed automatically — needs your decision)

**The live Supabase database password was committed to git in plaintext** (previously in `Backend/app/core/config.py`, `audit.py`, `render.yaml`, scripts, and this report). Anyone with repo read access must assume the credential is burned and rotate it. Recommend:
1. Rotate the Supabase database password.
2. Move `DATABASE_URL` (and the JWT/Brevo secrets) to Render's dashboard "Environment" secrets instead of inline `value:` in `render.yaml`, or use `sync: false` env vars set manually per-environment.

I did not rotate the credential or restructure secret storage myself since that changes a live database password — flagging it for your call rather than acting unilaterally.

## Files Changed

- `render.yaml` — 4 targeted line changes (pooler region, CORS origins, frontend API URL, health check path). No application code, models, routes, or frontend files were touched.
