import asyncio
import os
os.environ["DB_SSL_MODE"] = "disable"

from httpx import AsyncClient, ASGITransport
from app.main import app

transport = ASGITransport(app=app)

ROLES = [
    ("Admin", "admin@amplivo.in", "Amplivo!Admin2026", ["/api/v1/users", "/api/v1/companies"]),
    ("Client", "client@amplivo.in", "Amplivo!Client2026", ["/api/v1/portal/announcements", "/api/v1/portal/resources"]),
    ("Sales", "sales@amplivo.in", "Amplivo!Sales2026", ["/api/v1/leads", "/api/v1/finance/invoices"]),
    ("HR", "hr@amplivo.in", "Amplivo!Hr2026", ["/api/v1/careers", "/api/v1/users/departments"]),
    ("Employee", "employee@amplivo.in", "Amplivo!Emp2026", ["/api/v1/tasks", "/api/v1/timesheets"]),
]

async def test_role(client, role, email, pwd, eps):
    r = await client.post("/api/v1/auth/login", json={"identifier": email, "password": pwd})
    if r.status_code != 200:
        print(f"[FAIL] {role} ({email}) login -> {r.status_code}")
        return
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = await client.get("/api/v1/auth/me", headers=headers)
    print(f"[PASS] {role} logged in! User: {me.json().get('full_name')} (Role: {me.json().get('role_name')})")
    for ep in eps:
        res = await client.get(ep, headers=headers)
        print(f"       {role} -> GET {ep} -> {res.status_code}")

async def main():
    async with AsyncClient(transport=transport, base_url="http://testserver", timeout=30) as client:
        await asyncio.gather(*(test_role(client, r, e, p, eps) for r, e, p, eps in ROLES))

if __name__ == "__main__":
    asyncio.run(main())
