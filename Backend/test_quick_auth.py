import asyncio
import os
os.environ["DB_SSL_MODE"] = "disable"

from httpx import AsyncClient, ASGITransport
from app.main import app

transport = ASGITransport(app=app)

async def test():
    async with AsyncClient(transport=transport, base_url="http://testserver", timeout=15) as client:
        r = await client.post("/api/v1/auth/login", json={"identifier": "admin@amplivo.in", "password": "Amplivo!Admin2026"})
        print(f"Login status: {r.status_code}")
        if r.status_code == 200:
            token = r.json()["access_token"]
            print("Token obtained successfully!")
            headers = {"Authorization": f"Bearer {token}"}
            me = await client.get("/api/v1/auth/me", headers=headers)
            print(f"Me status: {me.status_code}, User: {me.json()}")
            
            users = await client.get("/api/v1/users", headers=headers)
            print(f"Users endpoint: {users.status_code}")
            
            companies = await client.get("/api/v1/companies", headers=headers)
            print(f"Companies endpoint: {companies.status_code}")
            
            dashboards = await client.get("/api/v1/analytics/dashboards", headers=headers)
            print(f"Analytics Dashboards endpoint: {dashboards.status_code}")

if __name__ == "__main__":
    asyncio.run(test())
