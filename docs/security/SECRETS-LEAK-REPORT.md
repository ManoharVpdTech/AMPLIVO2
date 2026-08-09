# Amplivo — Secrets Leak Report

**Date:** 2026-08-08 · **Severity: CRITICAL**

## Executive Summary

The production Supabase **database password is committed in plaintext** in the repository — in 6 files of the working tree and in **7 commits across the entire git history**, including the very first commits. Anyone with read access to the repo (it is **public** on GitHub: `johnalexanderkondepoguVPD/AMPLIVO`) can connect to the production PostgreSQL database and read/write all Amplivo customer, finance, lead, HR and client-portal data.

A secondary issue: `JWT_SECRET_KEY` has a hard-coded default of `CHANGE_ME_IN_PRODUCTION`, which would allow arbitrary JWT forgery on any host that boots without an overriding env var.

## Affected Database

- Project ref: `postgres.fhxkiprlcdwbgtaxlffk` (Supabase)
- Pooler: `aws-0-ap-northeast-1.pooler.supabase.com:6543` (config default) / `:5432` (scripts)
- **Password: `REDACTED`**

## Leak Chain — Git History

Password present in these commits (verified with `git log -S`):

| Commit | Date | Title |
|---|---|---|
| `5a177f6` | 2026-07-23 | first commit |
| `b8c535f` | 2026-07-23 | fixed deploy |
| `9a48a0c` | 2026-07-24 | Sync backend … |
| `3a35ef7` | 2026-07-24 | automated lead creation … |
| `4945de8` | 2026-07-28 | backend core modules … |
| `2eacd52` | 2026-07-28 | automation bugs … |
| `324516d` | 2026-07-29 | first commit |

The password has been in the repository **since the initial commit**.

## Working-Tree Occurrences (6 files)

| File | Line | Usage |
|---|---|---|
| `Backend/app/core/config.py` | 19 | `DATABASE_URL` **default** — the runtime connection string (live) |
| `Backend/audit.py` | 6 | hard-coded connection string |
| `Backend/test_db.py` | 6 | hard-coded connection string |
| `Backend/test_api.py` | 10 | hard-coded connection string |
| `Backend/create_missing_tables.py` | 69 | asyncpg direct connect |
| `docs/DEPLOYMENT_REPORT.md` | 51 | documents the same exposure |

## Other Secret Hygiene

| Item | Status |
|---|---|
| `JWT_SECRET_KEY` default `CHANGE_ME_IN_PRODUCTION` | ⚠️ weak default (config.py) — forgery risk if env missing |
| `SUPABASE_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY` | present as empty `None` placeholders only — resolved from env in prod (good) |
| `BREVO_API_KEY` | env-only; referenced `email_service.py:155` — not committed |
| Frontend `.env.*` / keys | none found in TS/TSX (`sk-`, `AIza`, `AKIA`, `service_role` absent) |
| `npm`/pip lockfiles | contain versions only (no secrets) |

## Frontend / Vercel exposure check
- Frontend CSR bundle (`2-l48-xoi2h9u.js`) revealed only the public API base `https://amplivo.onrender.com/api/v1` — no secrets baked into client bundles.

## Required remediation

1. **Rotate the Supabase DB password immediately** (Supabase dashboard → Project Settings → Database). The leaked one is effectively public.
2. Rotate `JWT_SECRET_KEY` (Render env) and set `JWT_SECRET_KEY` in every `.env`.
3. **Purge from git history** (public repo):
   - `git filter-repo --replace-text` (removes from all 7 commits) or
   - history rewrite with `git filter-branch`/`BFG` then **push --force** and rotate.
4. Remove passwords from the 5 script files; load via `os.environ`.
5. Add `.env` (already gitignored, verify) and never commit env files.
6. Guard Scans/CI: add a secret-linter (e.g. gitleaks) to PRs.
7. If the DB password is rotated, ALL deployments (Render `amplivo`, local env, seeds, scripts) must update `.env` — the app reads it at runtime via `settings`.