"""Test end-to-end authenticated workflows for all roles."""
import asyncio
import os
os.environ["DB_SSL_MODE"] = "disable"

from httpx import AsyncClient, ASGITransport
from app.main import app

transport = ASGITransport(app=app)

USERS_TO_TEST = [
    {"role": "Admin", "email": "admin@amplivo.in", "password": "Amplivo!Admin2026"},
    {"role": "Client", "email": "client@amplivo.in", "password": "Amplivo!Client2026"},
    {"role": "Sales", "email": "sales@amplivo.in", "password": "Amplivo!Sales2026"},
    {"role": "HR", "email": "hr@amplivo.in", "password": "Amplivo!Hr2026"},
    {"role": "Employee", "email": "employee@amplivo.in", "password": "Amplivo!Emp2026"},
]

ROLE_ENDPOINTS = {
    "Admin": [
        ("/api/v1/users", "GET"),
        ("/api/v1/roles", "GET"),
        ("/api/v1/companies", "GET"),
        ("/api/v1/analytics/dashboards", "GET"),
    ],
    "Client": [
        ("/api/v1/portal/announcements", "GET"),
        ("/api/v1/portal/resources", "GET"),
    ],
    "Sales": [
        ("/api/v1/leads", "GET"),
        ("/api/v1/finance/invoices", "GET"),
        ("/api/v1/campaigns", "GET"),
    ],
    "HR": [
        ("/api/v1/careers", "GET"),
        ("/api/v1/users/departments", "GET"),
    ],
    "Employee": [
        ("/api/v1/tasks", "GET"),
        ("/api/v1/timesheets", "GET"),
        ("/api/v1/notifications", "GET"),
    ],
}

async def run():
    print("=" * 80)
    print("AUTHENTICATED ROLE-BASED WORKFLOW VERIFICATION")
    print("=" * 80)
    
    async with AsyncClient(transport=transport, base_url="http://testserver", timeout=30) as client:
        for user_info in USERS_TO_TEST:
            role = user_info["role"]
            email = user_info["email"]
            password = user_info["password"]
            
            print(f"\n--- Testing Role: {role} ({email}) ---")
            
            # Login
            res = await client.post("/api/v1/auth/login", json={"identifier": email, "password": password})
            if res.status_code != 200:
                print(f"  [FAIL] Login failed: {res.status_code} {res.text}")
                continue
            
            data = res.json()
            token = data.get("access_token")
            print(f"  [PASS] Login successful! Token received: {token[:20]}...")
            
            headers = {"Authorization": f"Bearer {token}"}
            
            # Test Me endpoint
            me_res = await client.get("/api/v1/auth/me", headers=headers)
            if me_res.status_code == 200:
                print(f"  [PASS] GET /auth/me -> 200 ({me_res.json().get('email')})")
            else:
                print(f"  [FAIL] GET /auth/me -> {me_res.status_code} {me_res.text}")
            
            # Test role-specific endpoints
            endpoints = ROLE_ENDPOINTS.get(role, [])
            for ep, method in endpoints:
                if method == "GET":
                    r = await client.get(ep, headers=headers)
                    if r.status_code in (200, 201):
                        print(f"  [PASS] {method} {ep} -> {r.status_code}")
                    else:
                        print(f"  [FAIL] {method} {ep} -> {r.status_code} {r.text[:150]}")

if __name__ == "__main__":
    asyncio.run(run())
