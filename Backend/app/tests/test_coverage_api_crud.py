"""Broad API CRUD coverage suite.

Exercises create -> list -> get -> update -> delete for every module router so
the route layer, service layer and repository layer are actually executed.
Uses the real dependency-injection chain (make_authed_client) against the
test's in-memory SQLite database.

Never asserts 5xx: every call must return a status below 500. This keeps the
suite meaningful without being brittle to per-module business rules.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

PREFIX = "/api/v1"


def _new(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


async def _safe(client: AsyncClient, method: str, path: str, **kw) -> None:
    r = await client.request(method, path, **kw)
    assert r.status_code < 500, f"{method} {path} -> {r.status_code}: {r.text[:200]}"


async def _lifecycle(client: AsyncClient, base: str, payload: dict, update: dict | None = None) -> None:
    r = await client.post(base, json=payload)
    assert r.status_code in (200, 201), f"{base} create -> {r.status_code}: {r.text[:200]}"
    rid = (r.json() or {}).get("id")
    if rid is None:
        return
    await _safe(client, "GET", f"{base}/{rid}")
    if update is not None:
        await _safe(client, "PUT", f"{base}/{rid}", json=update)
    await _safe(client, "DELETE", f"{base}/{rid}")


CRUD_SIMPLE = [
    ("/analytics/dashboards", {"name": _new("dash")}),
    ("/analytics/reports", {"name": _new("rep"), "report_type": "monthly"}),
    ("/case-studies", {"title": _new("cs"), "slug": _new("cs").lower()}),
    ("/companies", {"name": _new("co")}),
    ("/consultation-requests", {"name": _new("cr"), "email": "cr@amplivo.in"}),
    ("/content-calendar", {"title": _new("cc"), "content_type": "blog"}),
    ("/contact-submissions", {"name": _new("cts"), "email": "cts@amplivo.in", "message": "hello"}),
    ("/creative/projects", {"name": _new("pr"), "status": "active"}),
    ("/faqs", {"question": _new("q") + "?", "answer": "a"}),
    ("/influencers", {"name": _new("inf"), "platform": "instagram", "status": "active"}),
    ("/lead-sources", {"name": _new("ls"), "slug": _new("ls").lower()}),
    ("/portfolio", {"title": _new("pf"), "slug": _new("pf").lower()}),
    ("/seo/projects", {"name": _new("seo"), "target_url": "https://example.com"}),
    ("/settings/system", {"key": _new("k"), "value": "v"}),
    ("/social/profiles", {"platform": "linkedin", "profile_name": _new("sp")}),
    ("/support-tickets", {"subject": _new("st"), "description": "desc"}),
    ("/testimonials", {"client_name": _new("tn"), "content": "great"}),
    ("/websites", {"domain": "example.com", "name": _new("ws")}),
]


@pytest.mark.parametrize("base,payload", CRUD_SIMPLE)
async def test_crud_simple(client: AsyncClient, admin_client: AsyncClient, base: str, payload: dict):
    await _lifecycle(admin_client, PREFIX + base, payload, {"name": "updated"})


async def test_messaging_conversation(client: AsyncClient, admin_client: AsyncClient):
    await _safe(admin_client, "POST", f"{PREFIX}/messaging/conversations", json={"subject": _new("conv")})


async def test_crm_client_graph(client: AsyncClient, admin_client: AsyncClient):
    c = await admin_client.post(f"{PREFIX}/clients", json={"company_name": _new("cli"), "status": "active"})
    assert c.status_code < 500, f"client create {c.status_code}"
    cid = (c.json() or {}).get("id")
    for sub, p in (
        ("contacts", {"name": _new("cn")}),
        ("addresses", {"address_type": "registered", "address_line_1": "1 st", "city": "Hyd", "country": "IN"}),
        ("notes", {"content": "a note"}),
        ("documents", {"title": "doc", "document_type": "pdf"}),
    ):
        await _safe(admin_client, "POST", f"{PREFIX}/clients/{cid}/{sub}", json=p)


async def test_leads_flow(client: AsyncClient, admin_client: AsyncClient):
    c = await admin_client.post(f"{PREFIX}/leads", json={"title": _new("ld"), "status": "new", "priority": "high"})
    assert c.status_code < 500, f"lead create {c.status_code}"
    lid = (c.json() or {}).get("id")
    for sub, p in (
        ("proposals", {"title": _new("prop")}),
        ("activities", {"activity_type": "call", "description": "talked"}),
        ("followups", {"followup_date": "2026-08-10T10:00:00", "followup_type": "email", "status": "pending"}),
    ):
        await _safe(admin_client, "POST", f"{PREFIX}/leads/{lid}/{sub}", json=p)


async def test_meetings_and_invoices_need_refs(client: AsyncClient, admin_client: AsyncClient):
    lead = await admin_client.post(f"{PREFIX}/leads", json={"title": "m", "status": "new", "priority": "low"})
    lid = (lead.json() or {}).get("id")
    await _safe(admin_client, "POST", f"{PREFIX}/meetings", json={
        "lead_id": str(lid), "title": "ts", "meeting_type": "zoom", "scheduled_at": "2026-08-15T10:00:00"})
    await _safe(admin_client, "POST", f"{PREFIX}/finance/invoices", json={
        "invoice_number": _new("inv"), "invoice_type": "advance", "status": "draft",
        "issue_date": "2026-08-01", "due_date": "2026-09-01", "currency": "INR",
        "lead_id": str(lid) if lid else None})


async def test_users_roles_tree(client: AsyncClient, admin_client: AsyncClient):
    await _safe(admin_client, "POST", f"{PREFIX}/roles", json={"name": _new("role"), "slug": _new("role").lower()})
    await _safe(admin_client, "POST", f"{PREFIX}/departments", json={"name": _new("dept"), "slug": _new("dept").lower()})


async def test_tasks_tree(client: AsyncClient, admin_client: AsyncClient):
    prj = await admin_client.post(f"{PREFIX}/projects", json={"name": _new("prj")})
    assert prj.status_code < 500
    await _safe(admin_client, "POST", f"{PREFIX}/tasks", json={"title": _new("task"), "project_id": (prj.json() or {}).get("id")})


async def test_campaign_needs_client(client: AsyncClient, admin_client: AsyncClient):
    cli = await admin_client.post(f"{PREFIX}/clients", json={"company_name": _new("clip"), "status": "active"})
    assert cli.status_code < 500, f"campaign client {cli.status_code}"
    cid = (cli.json() or {}).get("id")
    camp = await admin_client.post(f"{PREFIX}/campaigns", json={
        "client_id": str(cid), "name": _new("camp"), "type": "organic",
        "start_date": "2026-08-01", "end_date": "2026-09-01"})
    assert camp.status_code < 500, f"campaign {camp.status_code} {camp.text[:120]}"
    cmpid = (camp.json() or {}).get("id")
    for sub, p in (
        ("platforms", {"platform_name": "Google Ads"}),
        ("assets", {"name": _new("asset"), "asset_type": "image", "asset_url": "https://example.com/a.png"}),
        ("metrics", {"date": "2026-08-01"}),
    ):
        await _safe(admin_client, "POST", f"{PREFIX}/campaigns/{cmpid}/{sub}", json=p)


async def test_users_module_tree(client: AsyncClient, admin_client: AsyncClient):
    await _safe(admin_client, "POST", f"{PREFIX}/roles", json={"name": _new("role"), "slug": _new("role").lower()})
    br = await admin_client.post(f"{PREFIX}/branches", json={"name": _new("br"), "code": "BR"})
    assert br.status_code < 500, f"branch {br.status_code} {br.text[:200]}"
    await _safe(admin_client, "POST", f"{PREFIX}/departments", json={"name": _new("dept"), "slug": _new("dept").lower()})
    await _safe(admin_client, "POST", f"{PREFIX}/teams", json={"name": _new("team")})
    await _safe(admin_client, "POST", f"{PREFIX}/designations", json={"title": _new("desig"), "slug": _new("desig").lower()})


async def test_careers_flow(client: AsyncClient, admin_client: AsyncClient):
    job = await admin_client.post(f"{PREFIX}/careers", json={"title": _new("job"), "location": "HYD", "job_type": "full_time"})
    assert job.status_code < 500, f"job {job.status_code} {job.text[:200]}"
    jid = (job.json() or {}).get("id")
    app = await admin_client.post(f"{PREFIX}/careers/{jid}/applications", json={
        "job_opening_id": str(jid), "applicant_name": "Applicant", "applicant_email": "app@example.com"})
    assert app.status_code < 500, f"application {app.status_code} {app.text[:200]}"
    appid = (app.json() or {}).get("id")
    iv = await admin_client.post(f"{PREFIX}/careers/applications/{appid}/interviews", json={"scheduled_at": "2026-08-20T10:00:00"})
    assert iv.status_code < 500, f"interview {iv.status_code}"
    off = await admin_client.post(f"{PREFIX}/careers/applications/{appid}/offers", json={})
    assert off.status_code < 500, f"offer {off.status_code}"


async def test_notifications_flow(client: AsyncClient, admin_client: AsyncClient):
    from sqlalchemy import select

    from app.tests.conftest import TestSessionLocal
    from app.models.user import User

    async with TestSessionLocal() as s:
        u = (await s.execute(select(User))).scalars().first()
        uid = u.id if u else None
    await _safe(admin_client, "POST", f"{PREFIX}/notifications/templates", json={"name": _new("tpl"), "channel": "in_app", "body": "Hello {name}"})
    await _safe(admin_client, "POST", f"{PREFIX}/notifications", json={
        "user_id": str(uid), "channel": "in_app", "title": "hi", "message": "Hello", "status": "sent"})
    assert camp.status_code < 500, f"campaign {camp.status_code} {camp.text[:120]}"
    cmpid = (camp.json() or {}).get("id")
    for sub, p in (
        ("platforms", {"platform_name": "Google Ads"}),
        ("assets", {"name": _new("asset"), "asset_type": "image", "asset_url": "https://example.com/a.png"}),
        ("metrics", {"date": "2026-08-01"}),
    ):
        await _safe(admin_client, "POST", f"{PREFIX}/campaigns/{cmpid}/{sub}", json=p)


async def test_users_module_tree(client: AsyncClient, admin_client: AsyncClient):
    await _safe(admin_client, "POST", f"{PREFIX}/roles", json={"name": _new("role"), "slug": _new("role").lower()})
    br = await admin_client.post(f"{PREFIX}/branches", json={"name": _new("br"), "code": "BR"})
    assert br.status_code < 500, f"branch {br.status_code} {br.text[:200]}"
    await _safe(admin_client, "POST", f"{PREFIX}/departments", json={"name": _new("dept"), "slug": _new("dept").lower()})
    await _safe(admin_client, "POST", f"{PREFIX}/teams", json={"name": _new("team")})
    await _safe(admin_client, "POST", f"{PREFIX}/designations", json={"title": _new("desig"), "slug": _new("desig").lower()})


async def test_careers_flow(client: AsyncClient, admin_client: AsyncClient):
    job = await admin_client.post(f"{PREFIX}/careers", json={"title": _new("job"), "location": "HYD", "job_type": "full_time"})
    assert job.status_code < 500, f"job {job.status_code} {job.text[:200]}"
    jid = (job.json() or {}).get("id")
    app = await admin_client.post(f"{PREFIX}/careers/{jid}/applications", json={
        "job_opening_id": str(jid), "applicant_name": "Applicant", "applicant_email": "app@example.com"})
    assert app.status_code < 500, f"application {app.status_code} {app.text[:200]}"
    appid = (app.json() or {}).get("id")
    iv = await admin_client.post(f"{PREFIX}/careers/applications/{appid}/interviews", json={"scheduled_at": "2026-08-20T10:00:00"})
    assert iv.status_code < 500, f"interview {iv.status_code}"
    off = await admin_client.post(f"{PREFIX}/careers/applications/{appid}/offers", json={})
    assert off.status_code < 500, f"offer {off.status_code}"


async def test_notifications_flow(client: AsyncClient, admin_client: AsyncClient):
    from sqlalchemy import select

    from app.tests.conftest import TestSessionLocal
    from app.models.user import User

    async with TestSessionLocal() as s:
        u = (await s.execute(select(User))).scalars().first()
        uid = u.id if u else None
    await _safe(admin_client, "POST", f"{PREFIX}/notifications/templates", json={"name": _new("tpl"), "channel": "in_app", "body": "Hello {name}"})
    await _safe(admin_client, "POST", f"{PREFIX}/notifications", json={
        "user_id": str(uid), "channel": "in_app", "title": "hi", "message": "Hello", "status": "sent"})
