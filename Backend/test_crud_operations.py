import asyncio
import os
import uuid
os.environ["DB_SSL_MODE"] = "disable"

from httpx import AsyncClient, ASGITransport
from app.main import app

transport = ASGITransport(app=app)

async def test_crud():
    print("=" * 80)
    print("END-TO-END CRUD OPERATIONS VERIFICATION (POST -> SUPABASE DB)")
    print("=" * 80)
    
    async with AsyncClient(transport=transport, base_url="http://testserver", timeout=30) as client:
        # 1. Admin Login
        res_admin = await client.post("/api/v1/auth/login", json={"identifier": "admin@amplivo.in", "password": "Amplivo!Admin2026"})
        token_admin = res_admin.json()["access_token"]
        headers_admin = {"Authorization": f"Bearer {token_admin}"}
        
        # Admin creates Company
        c_res = await client.post("/api/v1/companies", json={"name": f"Test Enterprise {uuid.uuid4().hex[:6]}", "is_active": True}, headers=headers_admin)
        print(f"1. Admin Create Company -> Status: {c_res.status_code}")
        if c_res.status_code == 201:
            print(f"   Company Created: {c_res.json().get('id')} - {c_res.json().get('name')}")
            
        # Admin creates Branch
        b_res = await client.post("/api/v1/branches", json={"name": f"Hyderabad Branch {uuid.uuid4().hex[:4]}", "code": f"HYD-{uuid.uuid4().hex[:4]}", "city": "Hyderabad", "country": "India"}, headers=headers_admin)
        print(f"2. Admin Create Branch -> Status: {b_res.status_code}")
        if b_res.status_code == 201:
            print(f"   Branch Created: {b_res.json().get('id')} - {b_res.json().get('name')}")
            
        # 2. Sales Login
        res_sales = await client.post("/api/v1/auth/login", json={"identifier": "sales@amplivo.in", "password": "Amplivo!Sales2026"})
        token_sales = res_sales.json()["access_token"]
        headers_sales = {"Authorization": f"Bearer {token_sales}"}
        
        # Sales creates Lead
        l_res = await client.post("/api/v1/leads", json={"title": "High Value Enterprise Lead", "contact_name": "John Doe", "email": "john@enterprise.com", "company_name": "Enterprise Corp", "lead_status": "new", "value": 50000.0}, headers=headers_sales)
        print(f"3. Sales Create Lead -> Status: {l_res.status_code}")
        if l_res.status_code == 201:
            print(f"   Lead Created: {l_res.json().get('id')} - {l_res.json().get('title')}")
            
        # Sales creates Client
        cl_res = await client.post("/api/v1/clients", json={"company_name": f"Client Corp {uuid.uuid4().hex[:6]}", "email": f"info@{uuid.uuid4().hex[:6]}.com", "status": "active"}, headers=headers_sales)
        print(f"4. Sales Create Client -> Status: {cl_res.status_code}")
        client_id = None
        if cl_res.status_code == 201:
            client_id = cl_res.json().get('id')
            print(f"   Client Created: {client_id} - {cl_res.json().get('company_name')}")
            
        # Sales creates Invoice if client created
        if client_id:
            inv_res = await client.post("/api/v1/finance/invoices", json={"client_id": client_id, "invoice_number": f"INV-{uuid.uuid4().hex[:6]}", "issue_date": "2026-07-22", "due_date": "2026-08-22", "total_amount": 12500.0, "status": "draft"}, headers=headers_sales)
            print(f"5. Sales Create Invoice -> Status: {inv_res.status_code}")
            if inv_res.status_code == 201:
                print(f"   Invoice Created: {inv_res.json().get('id')} - {inv_res.json().get('invoice_number')}")

        # 3. HR Login
        res_hr = await client.post("/api/v1/auth/login", json={"identifier": "hr@amplivo.in", "password": "Amplivo!Hr2026"})
        token_hr = res_hr.json()["access_token"]
        headers_hr = {"Authorization": f"Bearer {token_hr}"}
        
        job_res = await client.post("/api/v1/careers", json={"title": "Senior React Developer", "department": "Engineering", "location": "Remote", "job_type": "full_time", "status": "open", "description": "Awesome role"}, headers=headers_hr)
        print(f"6. HR Create Job Opening -> Status: {job_res.status_code}")
        if job_res.status_code == 201:
            print(f"   Job Opening Created: {job_res.json().get('id')} - {job_res.json().get('title')}")

        # 4. Public / Client Contact Submission
        cont_res = await client.post("/api/v1/contact-submissions", json={"name": "Alice Smith", "email": "alice@example.com", "phone": "+919876543210", "message": "Interested in ERP solution"})
        print(f"7. Public Contact Submission -> Status: {cont_res.status_code}")
        if cont_res.status_code == 201:
            print(f"   Contact Submission Created: {cont_res.json().get('id')}")

if __name__ == "__main__":
    asyncio.run(test_crud())
