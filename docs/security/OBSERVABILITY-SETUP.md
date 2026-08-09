# Amplivo — Observability & Monitoring Setup

**Date:** 2026-08-09 · **Closes the HIGH gap from `LOGGING-MONITORING-GAPS.md` (A09)**

This document describes the monitoring/error-tracking layer shipped in this
pass. Every integration is **env-gated** — with no keys configured, the app
behaves exactly as before (verified: existing test suite unchanged). The
follow-up entries in `LOGGING-MONITORING-GAPS.md` that still require third‑party
accounts are called out at the bottom.

## 1. Error tracking — Sentry

| Component | Files | Activation |
|---|---|---|
| Backend SDK | `Backend/app/core/sentry.py`, wired in `Backend/app/main.py` lifespan | `SENTRY_DSN` set |
| Backend unhandled-500 capture | `Backend/app/middleware/error_boundary.py` → `capture_exception` | same gate |
| Backend requirement | `sentry-sdk[fastapi]==2.24.1` in `Backend/requirements.txt` | installed + import-verified |
| Frontend server/edge | `frontend/src/sentry.server.config.ts` via `src/instrumentation.ts` | `SENTRY_DSN` |
| Frontend browser | `frontend/src/sentry.client.config.ts` (loaded through `src/instrumentation.ts`) | `NEXT_PUBLIC_SENTRY_DSN` |
| Client-shell crash | `frontend/src/app/global-error.tsx` → `Sentry.captureException` | gated by client DSN |

Design guarantees:

- **Inert without a DSN.** `init_sentry()` returns immediately when `SENTRY_DSN`
  is unset; the frontend SDK only initializes when the build-time env var is
  present. No network, no threads, no side effects (local/dev/CI untouched).
- **Privacy-scrubbed before send.** `before_send` in
  `Backend/app/core/sentry.py` drops `Authorization`/`Cookie`/`x-csrf-token`
  headers, redacts any field named like a credential, and removes email/username
  from user context. `send_default_pii=False` on both sides.
- **Boot failure cannot take the app down.** A broken DSN logs a warning and
  continues.

Render secrets to add (dashboard, never commit):
- Backend service: `SENTRY_DSN`, optional `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`.
- Vercel: `NEXT_PUBLIC_SENTRY_DSN` (build-time, browser bundle).

## 2. Central log forwarding — HTTP batch forwarder

New `Backend/app/core/log_forwarder.py`: a daemon thread consumes a bounded
queue (20 000 events) and ships JSON log records to a forward URL as batched
HTTP POSTs. Field names containing secrets are redacted before the request is
built. Entirely disabled unless `LOG_FORWARD_URL` is configured.

| Setting | Default | Meaning |
|---|---|---|
| `LOG_FORWARD_URL` | *(unset)* | external collector endpoint |
| `LOG_FORWARD_TOKEN` | *(unset)* | bearer token sent to collector |
| `LOG_FORWARD_MAX_BATCH_BYTES` | `100000` | flush threshold |
| `LOG_FORWARD_FLUSH_INTERVAL_SECONDS` | `10.0` | time-based flush |

Wired in `Backend/app/main.py` lifespan: every app log record still goes to
stderr (existing JSON logging) **and** is eligible for the forwarder queue.

## 3. Metrics, health, retention (existing controls, now complete)

| Control | Where | Status |
|---|---|---|
| `/metrics` Prometheus | `prometheus-fastapi-instrumentator 7.1.0` | present |
| `/health`, `/health/ready`, `/health/database` | `main.py` | present |
| Audit-log retention (90 day TTL) | `AUDIT_LOG_RETENTION_DAYS` + lifespan purge task | present |
| Structured JSON → stderr | `app/core/logging_config.py` | present |
| Request/correlation IDs | `RequestIDMiddleware` | present |

## 4. Client-IP trust hardening (rate-limit integrity)

`get_client_ip()` in `Backend/app/utils/request_context.py` now only honors

- `X-Forwarded-For` when the **direct socket peer** is in `TRUSTED_PROXIES`
  (default: loopback + RFC1918 + IPv6 ULA/link-local). A public client can no
  longer spoof the header to dodge rate limiting or pollute audit IPs.

## 5. Still requires external accounts (not code — owner)

1. **Central log collector** (Axiom / Loki / CloudWatch / Logz): point
   `LOG_FORWARD_URL` at it.
2. **Uptime/alert rules**: Render uptime check → `/health/ready`; SLO alert e.g.
   pager when ≥2% 5xx in 5 min; alert on 429 storms.
3. **Sentry project(s)**: create backend + frontend projects, paste the two DSNs.

## Verification evidence

- Backend full suite: **216 passed, 0 failed** (194 pre-existing + 22 new
  security-regression tests) — see `SECURITY-TEST-RESULTS.md`.
- Frontend: `tsc --noEmit` clean; `next build` succeeds with `instrumentation.ts`
  active; ESLint rule for `dangerouslySetInnerHTML` verified firing.