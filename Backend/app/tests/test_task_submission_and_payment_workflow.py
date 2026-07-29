"""End-to-end regression coverage for two production bugs fixed in this pass:

1. Account Manager -> CRM submission workflow: there was no way for a CRM
   user to even list submissions across tasks (only per-task, and only if
   the task id was already known), and the CRM "approve" / "request
   changes" actions never called the backend at all (pure local state).
2. CRM Payments dashboard always showing zero: GET /finance/payments was
   gated to the "finance" role only, so a "crm" user's request 403'd and
   the dashboard silently rendered as if no payments existed.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.finance.models import Invoice, Payment
from app.modules.tasks.models import Project, Task
from app.tests.test_rbac_route_guards import make_authed_client, _get_or_create_role


async def _make_employee_and_task(db_session: AsyncSession) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    from app.models.user import User
    from app.utils.password import hash_password

    role = await _get_or_create_role(db_session, "employee")
    employee = User(
        id=uuid.uuid4(), email=f"emp-{uuid.uuid4().hex[:8]}@amplivo.com",
        username=f"emp_{uuid.uuid4().hex[:8]}", full_name="Test Employee",
        hashed_password=hash_password("Whatever123!"), is_active=True, is_verified=True, role_id=role.id,
    )
    db_session.add(employee)
    await db_session.flush()

    project = Project(id=uuid.uuid4(), name="Test Project", status="active")
    db_session.add(project)
    await db_session.flush()

    task = Task(
        id=uuid.uuid4(), task_number=f"TASK-{uuid.uuid4().hex[:6]}", title="Build the thing",
        project_id=project.id, status="in_progress", priority="medium", progress=50,
        assigned_to=employee.id,
    )
    db_session.add(task)
    await db_session.commit()
    return employee.id, project.id, task.id


@pytest.mark.asyncio
async def test_account_manager_submission_reaches_crm_review_queue(client: AsyncClient, db_session: AsyncSession) -> None:
    employee_id, project_id, task_id = await _make_employee_and_task(db_session)

    from app.models.user import User
    from app.utils.jwt import create_access_token
    employee_token = create_access_token(employee_id)
    client.headers["Authorization"] = f"Bearer {employee_token}"

    submit_resp = await client.post(
        f"/api/v1/tasks/{task_id}/submissions",
        json={"title": "Homepage redesign v1", "work_summary": "Done.", "completion_percentage": 100},
    )
    assert submit_resp.status_code == 201, submit_resp.text
    submission_id = submit_resp.json()["id"]

    # A CRM user must be able to see it in the cross-task review queue - this
    # endpoint (GET /submissions) did not exist before this fix; the only
    # option was GET /tasks/{task_id}/submissions, which requires already
    # knowing the task id, so there was no way to build a queue at all.
    crm_client = await make_authed_client(db_session, client, "crm")
    queue_resp = await crm_client.get("/api/v1/submissions")
    assert queue_resp.status_code == 200, queue_resp.text
    queue = queue_resp.json()
    assert queue["total"] >= 1
    item = next(i for i in queue["items"] if i["id"] == submission_id)
    assert item["task_title"] == "Build the thing"
    assert item["project_name"] == "Test Project"
    assert item["status"] == "pending_review"

    # CRM approves - must actually persist (previously approveSubmission()
    # on the frontend never called this endpoint at all).
    review_resp = await crm_client.post(
        f"/api/v1/submissions/{submission_id}/review", json={"approve": True},
    )
    assert review_resp.status_code == 200, review_resp.text
    assert review_resp.json()["status"] == "approved"

    # Reflected back on the employee's own view of the task.
    client.headers["Authorization"] = f"Bearer {employee_token}"
    task_resp = await client.get(f"/api/v1/tasks/{task_id}")
    assert task_resp.status_code == 200
    assert task_resp.json()["status"] == "completed"
    assert task_resp.json()["progress"] == 100


@pytest.mark.asyncio
async def test_crm_role_can_list_payments(client: AsyncClient, db_session: AsyncSession) -> None:
    invoice = Invoice(
        id=uuid.uuid4(), invoice_number=f"INV-{uuid.uuid4().hex[:6]}", invoice_type="standard",
        status="sent", issue_date=date.today(), due_date=date.today() + timedelta(days=14),
        subtotal=1000.0, tax_total=0.0, total_amount=1000.0, currency="INR",
    )
    db_session.add(invoice)
    await db_session.flush()
    payment = Payment(
        id=uuid.uuid4(), invoice_id=invoice.id, amount=1000.0, payment_date=date.today(),
        payment_method="bank_transfer", status="completed",
    )
    db_session.add(payment)
    await db_session.commit()

    crm_client = await make_authed_client(db_session, client, "crm")
    resp = await crm_client.get("/api/v1/finance/payments")
    # Before the fix this was 403 for every "crm" user, which is exactly why
    # the CRM Payments Dashboard always rendered ₹0 / "No payments found"
    # regardless of what was actually in the payments table.
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] >= 1
    assert any(p["id"] == str(payment.id) for p in body["items"])

    finance_client = await make_authed_client(db_session, client, "finance")
    resp2 = await finance_client.get("/api/v1/finance/payments")
    assert resp2.status_code == 200

    client_client = await make_authed_client(db_session, client, "client")
    resp3 = await client_client.get("/api/v1/finance/payments")
    assert resp3.status_code == 403
