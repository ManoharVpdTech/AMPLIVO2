import asyncio
import os
os.environ["DB_SSL_MODE"] = "disable"

from httpx import AsyncClient, ASGITransport
from app.main import app

transport = ASGITransport(app=app)

ROLES_TEST = [
    ("Admin", "admin@amplivo.in", "Amplivo!Admin2026", ["/api/v1/users", "/api/v1/roles", "/api/v1/companies", "/api/v1/analytics/dashboards"]),
    ("Client", "client@amplivo.in", "Amplivo!Client2026", ["/api/v1/portal/announcements", "/api/v1/portal/resources"]),
    ("Sales", "sales@amplivo.in", "Amplivo!Sales2026", ["/api/v1/leads", "/api/v1/finance/invoices", "/api/v1/campaigns"]),
    ("HR", "hr@amplivo.in", "Amplivo!Hr2026", ["/api/v1/careers", "/api/v1/users/departments"]),
    ("Employee", "employee@amplivo.in", "Amplivo!Emp2026", ["/api/v1/tasks", "/api/v1/timesheets", "/api/v1/notifications"]),
]

async def test():
    print("=" * 80)
    print("ALL ROLES END-TO-END AUTH & CRUD VERIFICATION")
    print("=" * 80)
    async with AsyncClient(transport=transport, base_url="http://testserver", timeout=20) as client:
        for role, email, pwd, eps in ROLES_TEST:
            r = await client.post("/api/v1/auth/login", json={"identifier": email, "password": pwd})
            if r.status_code != 200:
                print(f"[FAIL] {role} login: {r.status_code} {r.text[:100]}")
                continue
            token = r.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            me = await client.get("/api/v1/auth/me", headers=headers)
            user_data = me.json()
            print(f"[PASS] {role} login -> User: {user_data.get('email')} (Role: {user_data.get('role_name')})")
            
            for ep in eps:
                res = await client.get(ep, headers=headers)
                print(f"       -> GET {ep} -> {res.status_code}")

if __name__ == "__main__":
    asyncio.run(test())
