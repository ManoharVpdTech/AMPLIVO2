# Amplivo — Logging & Monitoring Gap Audit

**Date:** 2026-08-08 · **OWASP A09** · Severity: **HIGH GAP**

## Current State (verified from source)

| Capability | Present? | Where |
|---|---|---|
| Structured logs (JSON, ISO-8601 UTC) | ✅ | `Backend/app/core/logging_config.py` — single-line JSON → **stderr** |
| Request/correlation IDs | ✅ | `RequestIDMiddleware` + `login_history`; surfaced in error bodies (`request_id`/`correlation_id`) |
| End-to-end request timing | ✅ | `PerformanceLoggerMiddleware` — method/path/status/duration; 5xx & slow >1s logged |
| DB bootstrap check + slow/warn | ✅ | startup `check_database_connection`; `DB_STARTUP_TIMEOUT_SECONDS` |
| Audit log (business events) | ✅ | `AuditService` (~82 call sites): login/logout/register/password-reset/email-verify/session; written to `audit_logs` table transactionally |
| Error normalization | ✅ | `error_response()` returns `{error_code,message,request_id,correlation_id}` — no stack trace to client |
| Unhandled-500 capture | ✅ | `UnhandledErrorMiddleware` logs `logger.exception` + returns generic 500 |

## Missing — what a SOC/engineer would expect (all absent)

- ❌ **No error-tracking / alerting vendor** (no Sentry, Datadog, New Relic, Grafana agent) — search for `sentry|datadog|opentelemetry|otel|prometheus|grafana|metric` returns only business-route `/metrics` names.
- ❌ **No central log collector / queryable store** — logs go only to **stderr**, i.e. Render's ephemeral log pane; no forwarding to Loki/CloudWatch/Logz/Axiom. On restart they're gone.
- ❌ **No `/metrics` (Prometheus/OpenMetrics) endpoint** on the API — infra can't scrape request totals, 5xx-rate, p90 latency, DB pool usage.
- ❌ **No alert rules** — no paging on 5xx spike, rate-limit saturation, lockout storm, auth anomalies, failed-health.
- ❌ **No telemetry/tracing** (grpc/traceheaders) across the Next.js client + API, so cross-service latency can't be attributed.
- ❌ **No structured error propagation on the frontend** — `frontend/src/app/global-error.tsx` renders a static "Something went wrong" page; the `error` object/digest is buried in global-error, no Sentry/Bugsnag capture, no toast; NVE/sentry not linked.
- ⚠️ **No PII policy in logs** — emails, phone are logged in some auth payload fields? (request bodies are not logged, but bearer tokens are not logged either — good; confirm nothing logs `password`).
- ⚠️ **Log retention not defined** — no eviction/TTL for `audit_logs`; growing unbounded.
- ⚠️ **RBAC-sensitive data** — audit only covers auth events, not file/quote/etc. — so crypto "who did what" in the business modules is not audited.

## Recommendation Matrix (priority)

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | Add Sentry backend SDK (init in lifespan, captures non-held 500s + breaks the URL-swap error) | S | Detect prod errors in realtime → alert |
| 2 | Add Render-side **health/audit log integration**: stream stderr JSON → external provider (Axiom/Loki) | S | persistent searchable logs |
| 3 | Add `GET /metrics` (Prometheus format via `prometheus-fastapi-instrumentator`), instrument middleware totals | S | dashboards + alerting |
| 4 | Add SLO alert rules on Render (e.g. ≥2% 5xx in 5 min → page) + `health`, `/docs` off in prod | S | ops alerting |
| 5 | Frontend: add Sentry Browser + `global-error` capture + a global toast/error handler | M | catch client crash |
| 6 | Add TTL/cleanup job for `audit_logs` (e.g. 90 days) + retention policy in code | S | stored growth bound |
| 7 | Expand audit coverage to file/CRM/money-motion events | M | full "who did what" |

## What already works (defend it)
- Single JSON log line per event → **easy to ship** to any aggregator later.
- Correlation ID in both request and response → cross-service correlation already solvable.
- 429 paths have `Retry-After` — observability admins can alert on rate-limit storms.
- `UnhandledErrorMiddleware` prevents context leak; no stack trace in client body.

**Bottom line:** logging is event-structured and well-formed, but there is no monitoring, alerting, or retention. Logs exist only as long as the Render instance lives. Treat A09 as a *gaps* not a passing control.