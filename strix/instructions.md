# Strix scan instructions for the Amplivo ERP + portals
#
# Scope & rules of engagement — only targets listed here may be scanned.
# All credentials below are the project's OWN seeded demo accounts.

## Targets
- Frontend codebase: ../frontend
- Backend codebase: ../Backend
- Deployed API: https://api.amplivo.in
- Deployed web: https://www.amplivo.in

## Priority areas
1. Auth & session: JWT handling, refresh-token rotation, password reset,
   email verification, account lockout, rate-limit bypass.
2. Broken access control: IDOR on client-portal resources, role escalation
   between admin / sales / crm / hr / employee / client / finance.
3. Tenant scoping: cross-client data access in the client portal modules.
4. Injection: SQL injection via asyncpg/SQLAlchemy, email template SSTI.
5. Business logic: payment verification flow (Finance then CRM), invoice
   advance/final workflow, creative approval chain.
6. File upload: uploads under /uploads (file types, path traversal).
7. Secrets: any credentials committed in the repo (e.g. config defaults).

## Authenticated testing credentials (our own demo users)
- admin@amplivo.in / Admin@123   (admin)
- sales@amplivo.in / Sales@123   (sales)
- crm@amplivo.in / Crm@1234      (crm)
- finance@amplivo.in / Finance@123
- employee@amplivo.in / Employee@123
- hr@amplivo.in / Hr@12345
- client@amplivo.in / Client@123 (seeded by seed_client_portal_demo.py)

## Run commands
# Local source-aware scan (white-box):
strix -t ../frontend -t ../Backend --scan-mode standard --instruction-file ./instructions.md

# Live API + web (black-box), after the apps are deployed:
strix -t https://api.amplivo.in -t https://www.amplivo.in --instruction-file ./instructions.md

# Quick headless PR-scoped scan:
strix -n -t ../ --scan-mode quick --scope-mode diff --diff-base origin/main

## Constraints
- Do not mutate production data. Use only the project's own test accounts.
- Stay within the stated targets and scope.