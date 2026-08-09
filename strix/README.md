# Strix — AI security scanning (Amplivo)

Strix is the project's AI penetration-testing layer. It complements Playwright's
functional E2E tests (`frontend`): Playwright proves the app works; Strix proves
it is hard to break (OWASP Top 10, IDOR, auth/session flaws, business-logic
bugs, and more).

## Prerequisites

- **Docker Desktop** with the **WSL2 backend** enabled and running
  (Strix runs an isolated sandbox container `ghcr.io/usestrix/sandbox:latest`).
- **Python 3.12+** and **pipx** (`pip install --user pipx`).
- An **LLM API key**: OpenAI, Anthropic, Gemini/Vertex, Bedrock, or a local
  model. OpenCode cannot serve as the LLM backend for Strix — it has no
  inference endpoint to point LiteLLM at.

## Install

```bash
pipx install strix-agent          # CLI = `strix`
npx skills add usestrix/strix     # optional: agent skills for coding agents
```

## Configure

Copy `.env.example` to `.env` and set `STRIX_LLM` + `LLM_API_KEY`. Never commit
the real `.env` (it is git-ignored).

```bash
# PowerShell (or cmd):
set STRIX_LLM=openai/gpt-5.4
set LLM_API_KEY=sk-...
```

## Scan targets

```bash
# White-box source-aware scan of this repo's code
strix -t ../frontend -t ../Backend --scan-mode standard --instruction-file ./instructions.md

# Black-box live app (after deployment)
strix -t https://api.amplivo.in -t https://www.amplivo.in --instruction-file ./instructions.md

# Headless CI (exits non-zero when vulnerabilities are found)
strix -n -t ../ --scan-mode quick
```

## View results

```bash
strix view            # local dashboard for the most recent run
strix view <run-name> # specific run
```

## Notes

- First run pulls the ~2 GB sandbox image (Docker must be running).
- Runs write to `strix_runs/` (git-ignored).
- See `instructions.md` for the exact scope, demo credentials, and focus
  areas used for Amplivo.