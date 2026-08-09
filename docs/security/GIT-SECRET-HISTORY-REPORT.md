# Amplivo — Git Secret-History Report

**Date:** 2026-08-09 · **Severity: CRITICAL (residual: history purge pending)**

## Purpose

This report documents every credential that has ever been committed to this
repository, how each was removed from the working tree, what fingerprint guard
now prevents regression, and the **still-required manual Git history purge**
that ONLY a human operator should perform. This report never contains a secret.

## 1. Previously leaked production DB password

| Attribute | Value |
|---|---|
| Nature | Supabase PostgreSQL connection password (production) |
| First leaked | Initial commit `5a177f6` |
| Plaintext currently stored in repo | **No** (removed in `e7220d4`) |
| Plaintext present in history | **Yes** — purge required |
| Regression guard | SHA-256 fingerprint in CI (`scripts/secret-digest-guard.py`) |

### 1a. Commits that contained the literal (verified with `git log -S`)

| Commit | Date | Role |
|---|---|---|
| `5a177f6` | 2026‑07‑23 | first commit (introduced) |
| `b8c535f` | 2026‑07‑23 | fixed deploy |
| `9a48a0c` | 2026‑07‑24 | backend sync |
| `3a35ef7` | 2026‑07‑24 | automated lead creation |
| `4945de8` | 2026‑07‑28 | backend core modules |
| `2eacd52` | 2026‑07‑28 | automation bugs |
| `324516d` | 2026‑07‑29 | "first commit" (duplicate tree) |
| `e7220d4` | 2026‑08‑08 | remediation — removed it from working tree |

### 1b. Files in which the literal ever appeared

| File | Status now |
|---|---|
| `.github/workflows/ci-cd.yml` | Removed; digest‑guard added (this PR) |
| `Backend/app/core/config.py` | Removed (`e7220d4`); env‑only, fail‑closed |
| `Backend/audit.py` | Removed (`e7220d4`) |
| `Backend/create_missing_tables.py` | Removed (`e7220d4`) |
| `Backend/test_api.py` | Removed (`e7220d4`) |
| `Backend/test_db.py` | Removed (`e7220d4`) |
| `docs/DEPLOYMENT_REPORT.md` | Removed (`e7220d4`) |
| `render.yaml` | Removed (`e7220d4`); now env‑only |

### 1c. Required operator action (NOT automated — up to you)

The literal still exists in git **history** for the affected commits above.
Because history rewrite (e.g. `git filter-repo`) modifies shared published
history and invalidates CI digests, it is intentionally **not** performed
automatically. When you choose to purge:

```bash
# Requires contributor/owner privileges and rewrites all hashes after these commits.
git filter-repo --invert-paths --path Backend/audit.py \
  --path Backend/create_missing_tables.py --path Backend/test_api.py \
  --path Backend/test_db.py --path docs/DEPLOYMENT_REPORT.md \
  --path render.yaml --path .github/workflows/ci-cd.yml
# Then force-push all branches/tags and invalidate the Supabase password downstream.
```

**Critical:** after history purge, update the DB password **again** — any value
that ever existed in shared history must be treated as exposed, regardless of
deletion.

## 2. Live Google Maps API key

| Attribute | Value |
|---|---|
| Nature | Google Maps JavaScript API key (live in Lighthouse JSON) |
| Files | `frontend/lighthouse-before.json`, `frontend/lighthouse-after.json` |
| Committed in | `4df93c6` (initial frontend commit) and later trees |
| Working tree | Sanitized — key replaced with `REDACTED_MAPS_API_KEY` (done) |
| Git tracked | Removed via `git rm --cached`; `/lighthouse-*.json` gitignored |
| Git history | still contains the literal in old blobs (see action below) |
| App code | no other occurrence — key not referenced by frontend code |

### Required operator action

- **Restrict/rotate the Google Cloud key** in Google Cloud Console:
  1. HTTP referrer restrictions (only `https://amplivo.vercel.app/*`)
  2. API restrictions (Maps JavaScript / Geocoding only)
  3. If it may have been scanned, regenerate the key.
- Optionally remove the files from history with the same `git filter-repo` pass.

## 3. Regression protection now in place (Scope reached CI)

| Layer | Mechanism |
|---|---|
| Generic secrets | Gitleaks default rules, full history (`fetch-depth: 0`) |
| This specific credential | `scripts/secret-digest-guard.py` — SHA‑256 fingerprint of the literal aligned on every tracked file; the plaintext is stored nowhere in the repository |
| Working-tree guard | same script returns **nonzero** if the fingerprint token reappears, blocks the commit via CI failure |
| Addressed to repo | only the fingerprint string of the literal, never the literal itself |

The script:
- computes SHA‑256 over alphanumeric tokens (not whole lines) so the literal is
  caught even embedded in URLs, strings, and paths;
- does not print any secret at any point (prints only OK/ERROR line);
- is fast (python stdlib only, no subprocess per blob).

## 4. Snapshot of the scan at the time of this report

| Scan | Result |
|---|---|
| `git grep -E 'AIza…' HEAD -- frontend` | only the two lighthouse JSONs |
| Disk CAT of lighthouse JSONs (post‑sanitize) | 0 live‑key tokens |
| Full‑tree regex sweep (untracked+nested + ignored) | 0 (DB‑pw literal, AWZ‑keys → none) |
| `git log -S <leaked literal>` | only the 7 historical commits above + removal commit |

## 5. Definitions of done / remaining

| Item | Status |
|---|---|
| Working tree clean of all live secrets | ✅ DONE |
| Lighthouse JSON untracked + gitignored | ✅ DONE |
| CI digest guard green on current tree | ✅ DONE (tested locally) |
| Credential rotated at Supabase / Render | ⏳ OPERATOR (owner) |
| Git history purge via `git filter-repo` | ⏳ OPERATOR (owner, optional/in-sequence) |

Once history purge + rotation are done, delete/archive this report or mark it
*deprecated* — its guidance is then only historical.