"""Second service-layer coverage batch.

Targets the orchestration-heavy paths that the HTTP CRUD tests never reach:
the sales->CRM->finance advance-invoice pipeline, client-portal account
creation, meeting lifecycle, analytics, and campaigns sub-resources.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta  # noqa: F401

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import lead_pipeline
from app.models.user import User
from app.modules.users.models import Role
from app.utils.password import hash_password

from app.modules.leads.models import Lead
from app.modules.leads.repository import LeadRepository, LeadActivityRepository
from app.modules.leads.service import LeadService
from app.modules.crm.repository import ClientRepository, ProposalRepository
from app.modules.crm.service import ClientService, ProposalService


def _new(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


async def _make_user(db: AsyncSession, role_slug: str | None = None) -> User:
    role_id = None
    if role_slug:
        role = (await db.execute(select(Role).where(Role.slug == role_slug))).scalar_one_or_none()
        if role is None:
            role = Role(name=role_slug.capitalize(), slug=role_slug, is_system=False)
            db.add(role)
            await db.flush()
        role_id = role.id
    user = User(
        id=uuid.uuid4(),
        email=f"{role_slug or 'user'}-{uuid.uuid4().hex[:8]}@amplivo.com",
        username=f"{role_slug or 'user'}_{uuid.uuid4().hex[:8]}",
        full_name="Pipeline Test User",
        hashed_password=hash_password("Whatever123!"),
        is_active=True,
        is_verified=True,
        role_id=role_id,
    )
    db.add(user)
    await db.flush()
    return user


async def _make_lead(db: AsyncSession, title: str | None = None, email: str | None = None, **attrs) -> Lead:
    lead = Lead(title=title or _new("lead"), status=lead_pipeline.NEW_LEAD, email=email or f"{_new('l')}@x.com")
    for key, value in attrs.items():
        setattr(lead, key, value)
    db.add(lead)
    await db.flush()
    return lead


# ── Sales -> Finance pipeline ──────────────────────────────────────────
from app.modules.finance.service import InvoiceService, PaymentService  # noqa: E402
from app.modules.finance.repository import InvoiceRepository, PaymentRepository  # noqa: E402


async def test_full_advance_pipeline(db_session: AsyncSession):
    """The money-path per lead: advance invoice -> crm approve (emails are
    outbox-only) -> client submits payment -> finance verify -> crm verify ->
    client_verification message + client portal account + project created."""
    from app.modules.users.repository import RoleRepository
    admin = await _make_user(db_session, "admin")
    if await RoleRepository(db_session).get_by_slug("client") is None:
        db_session.add(Role(name="Client", slug="client", is_system=False))
        await db_session.flush()
    if await RoleRepository(db_session).get_by_slug("finance") is None:
        db_session.add(Role(name="Finance", slug="finance", is_system=False))
        await db_session.flush()
    lead = await _make_lead(db_session, status=lead_pipeline.PROJECT_CREATED)
    lead.company_name = "Pipeline Co"
    lead.contact_name = "Jane"
    await db_session.flush()

    inv_svc = InvoiceService(db_session, InvoiceRepository(db_session))
    invoice = await inv_svc.create_advance_invoice_for_lead(
        lead_id=lead.id, proposal_id=None, total_deal_amount=100000.0, tax_rate=18.0,
        due_date=date(2026, 9, 1), currency="INR", notes="advance", actor_id=admin.id)
    assert invoice.invoice_number.startswith("ADV-")
    assert invoice.invoice_type == "advance"
    assert invoice.subtotal == 25000.0
    assert invoice.total_amount == 29500.0
    await db_session.commit()

    # duplicate advance invoice is rejected
    with pytest.raises(Exception):
        await inv_svc.create_advance_invoice_for_lead(
            lead_id=lead.id, proposal_id=None, total_deal_amount=100000.0, tax_rate=18.0,
            due_date=date(2026, 9, 1), currency="INR", notes="advance", actor_id=admin.id)

    # CRM approval of advance invoice
    approved = await inv_svc.crm_approve_advance(invoice.id, actor_id=admin.id)
    assert approved.status in ("CRM_APPROVED", "EMAIL_SENT")
    await db_session.commit()

    # client submits payment proof
    pay_svc = PaymentService(db_session, PaymentRepository(db_session))
    payment = await pay_svc.submit_client_payment(invoice.id, {
        "amount": 29500.0, "payment_date": date(2026, 8, 10), "payment_method": "bank_transfer",
        "reference_number": "TX-123",
    }, token_id=None)
    assert payment.status == "submitted"

    # finance verifies
    fv = await pay_svc.finance_verify(payment.id, actor_id=admin.id)
    assert fv.status == "finance_verified"

    # CRM verifies -> triggers client account creation
    await pay_svc.crm_verify(payment.id, actor_id=admin.id)
    await db_session.refresh(payment)
    assert payment.status == "crm_verified"


async def test_pipeline_guard_branches(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    lead = await _make_lead(db_session)
    await db_session.flush()
    inv_svc = InvoiceService(db_session, InvoiceRepository(db_session))
    invoice = await inv_svc.create_advance_invoice_for_lead(
        lead_id=lead.id, proposal_id=None, total_deal_amount=100000.0, tax_rate=18.0,
        due_date=date(2026, 9, 1), currency="INR", notes=None, actor_id=admin.id)
    await db_session.commit()
    pay_svc = PaymentService(db_session, PaymentRepository(db_session))
    payment = await pay_svc.submit_client_payment(invoice.id, {
        "amount": 29500.0, "payment_date": date(2026, 8, 10), "payment_method": "bank_transfer",
        "status": "pending"}, token_id=None)
    await db_session.commit()
    # reject path
    rejected = await pay_svc.reject_payment(payment.id, reason="evidence unclear", actor_id=admin.id)
    assert rejected.status == "rejected"
    await db_session.commit()
    # wrong-state guard for finance_verify
    orphan = await pay_svc.submit_client_payment(invoice.id, {
        "amount": 100.0, "payment_date": date(2026, 8, 10), "payment_method": "cash"}, token_id=None)
    await db_session.commit()
    with pytest.raises(Exception):
        await pay_svc.crm_verify(orphan.id, actor_id=admin.id)


async def test_final_invoice_for_project(db_session: AsyncSession):
    from app.modules.tasks.repository import ProjectRepository

    admin = await _make_user(db_session, "admin")
    lead = await _make_lead(db_session)
    lead.company_name = "FinalCo"
    await db_session.flush()
    project = await ProjectRepository(db_session).create_from_dict({"name": _new("proj"), "status": "active", "manager_id": admin.id})
    await db_session.flush()
    inv_svc = InvoiceService(db_session, InvoiceRepository(db_session))
    invoice = await inv_svc.create_final_invoice_for_project(
        project_id=project.id, task_submission_id=None, total_deal_amount=100000.0, tax_rate=18.0,
        due_date=date(2026, 9, 1), currency="INR", notes=None, actor_id=admin.id)
    assert invoice.invoice_number.startswith("FIN-")
    assert invoice.subtotal == 75000.0
    # idempotent advance check
    assert await inv_svc.get_advance_for_lead(lead.id) is None


# ── Client portal account creation ─────────────────────────────────────
from app.services.client_account_service import ClientAccountService  # noqa: E402
from app.modules.users.repository import RoleRepository, UserProfileRepository  # noqa: E402


async def test_client_account_creation(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    role = await RoleRepository(db_session).get_by_slug("client")
    if role is None:
        role = Role(name="Client", slug="client", is_system=False)
        db_session.add(role)
        await db_session.flush()
    lead = await _make_lead(db_session, contact_name="PortalPerson2")
    lead.company_name = "Acme"
    await db_session.flush()
    service = ClientAccountService(db_session)
    user = await service.create_portal_account_for_client(lead.id, actor_id=admin.id)
    assert user.email == lead.email
    await db_session.commit()


# ── Meetings lifecycle ─────────────────────────────────────────────────
from app.modules.meetings.service import MeetingService  # noqa: E402
from app.modules.meetings.repository import MeetingRepository  # noqa: E402


async def test_meeting_lifecycle(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    lead = await _make_lead(db_session)
    await db_session.commit()
    svc = MeetingService(db_session, MeetingRepository(db_session))
    meeting = await svc.create_meeting({
        "lead_id": lead.id, "title": "Intro call", "meeting_type": "video_call",
        "scheduled_at": datetime(2026, 8, 20, 10, 0), "duration_minutes": 30,
        "status": "scheduled", "agenda": "scope"},
        created_by=admin.id)
    assert meeting.id
    await db_session.commit()
    assert await svc.get_meeting(meeting.id)
    items, total = await svc.list_meetings(lead_id=lead.id)
    assert total == 1
    updated = await svc.update_meeting(meeting.id, {"title": "Call 2"})
    assert updated.title == "Call 2"
    rescheduled = await svc.reschedule_meeting(meeting.id, new_time=datetime(2026, 8, 21, 10, 0), reason="conflict", actor_id=admin.id)
    assert rescheduled.status == "scheduled"
    cancelled = await svc.cancel_meeting(meeting.id, reason="lead pause", actor_id=admin.id)
    assert cancelled.status == "cancelled"
    completed = await svc.complete_meeting(meeting.id, notes="deal", follow_up_required=False, actor_id=admin.id)
    assert completed.status == "completed"
    # a meeting on a NEW_LEAD lead transitions the lead status
    lead2 = await _make_lead(db_session)
    meeting2 = await svc.create_meeting({
        "lead_id": lead2.id, "title": "First", "meeting_type": "video_call",
        "scheduled_at": datetime(2026, 8, 22, 10, 0), "status": "scheduled"},
        created_by=admin.id)
    await db_session.flush()
    from app.core import lead_pipeline
    lead_check = await db_session.get(Lead, lead2.id)
    assert lead_check.status == lead_pipeline.MEETING_SCHEDULED
    await svc.delete_meeting(meeting.id)
    with pytest.raises(Exception):
        await svc.get_meeting(meeting.id)
    with pytest.raises(Exception):
        await svc.delete_meeting(meeting.id)


# ── Campaigns sub-resources ────────────────────────────────────────────
from app.modules.campaigns.service import CampaignService, CampaignPlatformService, CampaignAssetService, CampaignMetricService  # noqa: E402
from app.modules.campaigns.repository import CampaignRepository, CampaignPlatformRepository, CampaignAssetRepository, CampaignMetricRepository  # noqa: E402
from app.modules.crm.service import ClientService as CrmClientService  # noqa: E402
from app.modules.crm.repository import ClientRepository as CrmClientRepository  # noqa: E402


async def test_campaign_subresources(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    client = await ClientService(db_session, ClientRepository(db_session)).create_client(
        {"company_name": _new("camp"), "status": "active"}, created_by=admin.id)
    await db_session.commit()
    c_svc = CampaignService(CampaignRepository(db_session))
    c = await c_svc.create_campaign({
        "name": _new("camp"), "client_id": client.id, "status": "active",
        "type": "paid", "manager_id": admin.id,
        "start_date": date(2026, 8, 1), "end_date": date(2026, 9, 1)})
    assert c.id
    await db_session.commit()
    items, total = await c_svc.list_campaigns(client_id=client.id, status="active")
    assert total >= 1
    assert await c_svc.get_campaign(c.id)
    p_svc = CampaignPlatformService(CampaignPlatformRepository(db_session))
    p = await p_svc.create_platform(c.id, {"platform_name": "google", "budget_allocation": 1000.0})
    assert p.id
    a_svc = CampaignAssetService(CampaignAssetRepository(db_session))
    a = await a_svc.create_asset(c.id, {"name": "hero", "asset_type": "creative", "file_url": "https://x/a.png"}, uploaded_by=admin.id)
    assert a.id
    m_svc = CampaignMetricService(CampaignMetricRepository(db_session))
    m = await m_svc.create_metric(c.id, {"clicks": 120, "impressions": 5000, "spend": 100.0})
    assert m.id
    assert await p_svc.get_platform(p.id)
    assert await p_svc.list_platforms(c.id)
    await p_svc.update_platform(p.id, {"budget": 2000.0})
    await a_svc.update_asset(a.id, {"title": "renamed"})
    await m_svc.update_metric(m.id, {"clicks": 250})
    await p_svc.delete_platform(p.id)
    await a_svc.delete_asset(a.id)
    await m_svc.delete_metric(m.id)
    await c_svc.delete_campaign(c.id)
    with pytest.raises(Exception):
        await c_svc.get_campaign(c.id)
    with pytest.raises(Exception):
        await c_svc.create_campaign({"name": "x", "client_id": uuid.uuid4()})
    with pytest.raises(Exception):
        await c_svc.update_campaign(c.id, {"manager_id": uuid.uuid4()})


# ── Analytics ──────────────────────────────────────────────────────────
from app.modules.analytics.service import DashboardService, ReportService, DataIntegrationService  # noqa: E402
from app.modules.analytics.repository import DashboardRepository, ReportRepository, DataIntegrationRepository  # noqa: E402


async def test_analytics_services(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    d_svc = DashboardService(DashboardRepository(db_session))
    d = await d_svc.create_dashboard({"name": _new("dash"), "layout_config": "{}"}, owner_id=admin.id)
    assert d.id
    assert await d_svc.get_dashboard(d.id, admin.id)
    items, total = await d_svc.list_dashboards(owner_id=admin.id, current_user_id=admin.id)
    assert total >= 1
    await d_svc.update_dashboard(d.id, {"name": "Dash2"}, user_id=admin.id)
    await d_svc.delete_dashboard(d.id, user_id=admin.id)
    with pytest.raises(Exception):
        await d_svc.get_dashboard(uuid.uuid4(), admin.id)
    r_svc = ReportService(ReportRepository(db_session))
    r = await r_svc.create_report({"name": _new("rep"), "report_type": "finance", "status": "pending"}, generated_by=admin.id)
    assert r.id
    assert await r_svc.get_report(r.id, None)
    items, total = await r_svc.list_reports(report_type="finance")
    assert total >= 1
    await r_svc.update_report(r.id, {"status": "generated"}, client_id=None)
    await r_svc.delete_report(r.id, client_id=None)
    with pytest.raises(Exception):
        await r_svc.get_report(uuid.uuid4(), None)
    i_svc = DataIntegrationService(DataIntegrationRepository(db_session))
    i = await i_svc.create_integration({"provider_name": "google_analytics", "status": "active"})
    assert i.id
    assert await i_svc.get_integration(i.id, None)
    items, total = await i_svc.list_integrations(provider_name="google_analytics")
    assert total >= 1
    await i_svc.update_integration(i.id, {"status": "error"}, client_id=None)
    await i_svc.delete_integration(i.id, client_id=None)
    with pytest.raises(Exception):
        await i_svc.get_integration(uuid.uuid4(), None)


# ── Lead / careers analytics dashboards ────────────────────────────────
from app.modules.leads.analytics_service import SalesAnalyticsService  # noqa: E402
from app.modules.careers.analytics_service import CareersAnalyticsService  # noqa: E402


@pytest.mark.skip(reason="uses Postgres-only date_trunc, unsupported by the SQLite test DB")
async def test_sales_analytics(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    lead = await _make_lead(db_session)
    lead.status = lead_pipeline.PROJECT_COMPLETED
    lead.estimated_value = 50000.0
    lead.converted_at = datetime(2026, 7, 15)
    await db_session.flush()
    await db_session.commit()
    svc = SalesAnalyticsService(db_session)
    stats = await svc.get_dashboard_stats(current_user_id=admin.id, role_slug="admin")
    assert isinstance(stats, dict)
    report = await svc.get_report("performance", current_user_id=admin.id, role_slug="admin")
    assert isinstance(report, dict)


def _pad(emoji):
    return emoji


@pytest.mark.skip(reason="uses Postgres-only date_trunc, unsupported by the SQLite test DB")
async def test_careers_analytics(db_session: AsyncSession):
    svc = CareersAnalyticsService(db_session)
    stats = await svc.get_dashboard_stats()
    assert isinstance(stats, dict)
    report = await svc.get_report("hiring_funnel")
    assert isinstance(report, dict)