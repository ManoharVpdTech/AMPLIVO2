"""Direct service-layer coverage tests.

These drive the service + repository layers of the high-volume modules
(users, leads, crm, finance, careers, tasks, meetings, notifications)
without HTTP overhead, exercising create/update/delete/list flows and the
FK validation branches that otherwise stay uncovered.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime  # noqa: F401

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.modules.users.models import Role
from app.utils.password import hash_password


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
        full_name="Service Test User",
        hashed_password=hash_password("Whatever123!"),
        is_active=True,
        is_verified=True,
        role_id=role_id,
    )
    db.add(user)
    await db.flush()
    return user


async def _commit(db: AsyncSession) -> None:
    await db.commit()


# ── Users module ────────────────────────────────────────────────────────
from app.modules.users.service import (  # noqa: E402
    RoleService,
    PermissionService,
    BranchService,
    DepartmentService,
    TeamService,
    DesignationService,
    UserManagementService,
    UserProfileService,
)
from app.modules.users.repository import (  # noqa: E402
    RoleRepository,
    RolePermissionRepository,
    PermissionRepository,
    BranchRepository,
    DepartmentRepository,
    TeamRepository,
    DesignationRepository,
    UserManagementRepository,
    UserProfileRepository,
)


async def test_role_service_crud(db_session: AsyncSession):
    repo = RoleRepository(db_session)
    svc = RoleService(db_session, repo, RolePermissionRepository(db_session))
    role = await svc.create_role({"name": _new("r"), "slug": _new("r").lower(), "is_system": False})
    assert role.id
    assert await svc.get_role(role.id)
    items, total = await svc.list_roles(search=role.slug)
    assert total >= 1
    await svc.update_role(role.id, {"name": "Renamed"})
    await svc.delete_role(role.id)
    with pytest.raises(Exception):
        await svc.get_role(role.id)


async def test_role_system_guards(db_session: AsyncSession):
    role = Role(name="Sys", slug=_new("sys").lower(), is_system=True)
    db_session.add(role)
    await db_session.flush()
    svc = RoleService(db_session, RoleRepository(db_session), RolePermissionRepository(db_session))
    with pytest.raises(Exception):
        await svc.update_role(role.id, {"name": "nope"})
    with pytest.raises(Exception):
        await svc.delete_role(role.id)
    # update after delete raises
    with pytest.raises(Exception):
        await svc.get_role(uuid.uuid4())


async def test_role_permission_assign(db_session: AsyncSession):
    svc = RoleService(db_session, RoleRepository(db_session), RolePermissionRepository(db_session))
    role = await svc.create_role({"name": _new("r"), "slug": _new("r").lower(), "is_system": False})
    perm = await PermissionService(PermissionRepository(db_session)).create_permission({
        "slug": _new("p"), "module": "crm", "action": "read"})
    await svc.assign_permission(role.id, perm.id)
    perms = await svc.get_role_permissions(role.id)
    assert any(p.id == perm.id for p in perms)
    await svc.revoke_permission(role.id, perm.id)
    with pytest.raises(Exception):
        await svc.assign_permission(role.id, uuid.uuid4())


async def test_permission_service(db_session: AsyncSession):
    svc = PermissionService(PermissionRepository(db_session))
    p = await svc.create_permission({"slug": _new("p").lower(), "module": "crm", "action": "read"})
    got = await svc.get_permission(p.id)
    assert got.id == p.id
    items, total = await svc.list_permissions(module="crm")
    assert total >= 1
    with pytest.raises(Exception):
        await svc.create_permission({"slug": p.slug, "module": "crm", "action": "read"})
    with pytest.raises(Exception):
        await svc.create_permission({"slug": _new("x"), "module": "crm", "action": "read"})


async def test_branch_service_crud(db_session: AsyncSession):
    svc = BranchService(BranchRepository(db_session))
    b = await svc.create_branch({"name": _new("b"), "code": _new("BR"), "city": "Hyd", "country": "IN"})
    assert b.id
    assert await svc.get_branch(b.id)
    items, total = await svc.list_branches(search=b.code, is_active=True)
    assert total >= 1
    await svc.update_branch(b.id, {"name": "Branch Two"})
    await svc.delete_branch(b.id)
    with pytest.raises(Exception):
        await svc.get_branch(b.id)


async def test_department_service_crud(db_session: AsyncSession):
    svc = DepartmentService(DepartmentRepository(db_session))
    d = await svc.create_department({"name": _new("d"), "slug": _new("d").lower()})
    assert d.id
    items, total = await svc.list_departments(search=d.slug)
    assert total >= 1
    await svc.update_department(d.id, {"name": "Dept2"})
    with pytest.raises(Exception):
        await svc.create_department({"slug": d.slug, "name": "dup"})
    await svc.delete_department(d.id)


async def test_department_head_validation(db_session: AsyncSession):
    svc = DepartmentService(DepartmentRepository(db_session))
    with pytest.raises(Exception):
        await svc.create_department({"name": _new("d"), "slug": _new("d").lower(), "head_user_id": uuid.uuid4()})


async def test_team_service_requires_department(db_session: AsyncSession):
    dept_svc = DepartmentService(DepartmentRepository(db_session))
    dept = await dept_svc.create_department({"name": _new("d"), "slug": _new("d").lower()})
    svc = TeamService(TeamRepository(db_session))
    team = await svc.create_team({"name": _new("team"), "slug": _new("team").lower(), "department_id": dept.id})
    assert team.id
    items, total = await svc.list_teams(department_id=dept.id, is_active=None)
    assert total >= 1
    await svc.update_team(team.id, {"name": "Team B"})
    await svc.delete_team(team.id)
    with pytest.raises(Exception):
        await svc.create_team({"name": "NoDept", "slug": "n"})
    with pytest.raises(Exception):
        await svc.create_team({"name": "BadDept", "slug": "b", "department_id": uuid.uuid4()})
    with pytest.raises(Exception):
        await svc.get_team(uuid.uuid4())


async def test_designation_service_crud(db_session: AsyncSession):
    svc = DesignationService(DesignationRepository(db_session))
    d = await svc.create_designation({"title": _new("title")})
    assert d.id
    items, total = await svc.list_designations(search=d.title, is_active=None)
    assert total >= 1
    await svc.update_designation(d.id, {"title": "Title2"})
    await svc.create_designation({"title": "X"})
    with pytest.raises(Exception):
        await svc.create_designation({"title": "X"})
    await svc.delete_designation(d.id)


async def test_user_management_service(db_session: AsyncSession):
    u = await _make_user(db_session, "admin")
    await _commit(db_session)
    svc = UserManagementService(db_session, UserManagementRepository(db_session))
    items, total = await svc.list_users(search=u.email.split("@")[0])
    assert total == 1
    assert await svc.get_user(u.id)
    updated = await svc.update_user(u.id, {"full_name": "Renamed User"})
    assert updated.full_name == "Renamed User"
    deactivated = await svc.deactivate_user(u.id)
    assert deactivated.is_active is False
    activated = await svc.activate_user(u.id)
    assert activated.is_active is True
    with pytest.raises(Exception):
        await svc.update_user(u.id, {"role_id": uuid.uuid4()})
    with pytest.raises(Exception):
        await svc.update_user(u.id, {"department_id": uuid.uuid4()})
    with pytest.raises(Exception):
        await svc.update_user(u.id, {"branch_id": uuid.uuid4()})


async def test_user_management_validation(db_session: AsyncSession):
    u = await _make_user(db_session, "admin")
    await _commit(db_session)
    svc = UserManagementService(db_session, UserManagementRepository(db_session))
    await svc.update_user(u.id, {"reporting_manager_id": u.id})


async def test_user_profile_bootstrap(db_session: AsyncSession):
    u = await _make_user(db_session)
    await _commit(db_session)
    svc = UserProfileService(db_session, UserProfileRepository(db_session))
    profile = await svc.get_profile(u.id)
    assert profile.user_id == u.id
    updated = await svc.create_or_update_profile(u.id, {"full_name": "Profiled", "phone": "9999999999"})
    assert updated.full_name == "Profiled"
    again = await svc.create_or_update_profile(u.id, {"full_name": "Again"})
    assert again.full_name == "Again"
    with pytest.raises(Exception):
        await svc.get_profile(uuid.uuid4())


# ── Leads module ─────────────────────────────────────────────────────────
from app.modules.leads.service import (  # noqa: E402
    LeadSourceService,
    LeadService,
    LeadActivityService,
    LeadFollowupService,
    SalesPipelineService,
)
from app.modules.leads.repository import (  # noqa: E402
    LeadSourceRepository,
    LeadRepository,
    LeadActivityRepository,
    LeadFollowupRepository,
    SalesPipelineRepository,
)


async def test_lead_sources_crud(db_session: AsyncSession):
    svc = LeadSourceService(LeadSourceRepository(db_session))
    s = await svc.create_source({"name": _new("src"), "slug": _new("s").lower()})
    assert await svc.get_source(s.id)
    items, total = await svc.list_sources(search=s.slug)
    assert total >= 1
    await svc.update_source(s.id, {"name": "Source2"})
    await svc.delete_source(s.id)
    with pytest.raises(Exception):
        await svc.get_source(s.id)


async def test_lead_service_full_flow(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    assignee = await _make_user(db_session, "sales")
    await _commit(db_session)
    src = await LeadSourceService(LeadSourceRepository(db_session)).create_source({"name": "Organic", "slug": _new("o")})
    svc = LeadService(db_session, LeadRepository(db_session), LeadActivityRepository(db_session))
    lead = await svc.create_lead({
        "title": _new("lead"), "status": "new", "priority": "high",
        "source_id": src.id, "assigned_to": assignee.id, "company_name": "Acme",
    }, created_by=admin.id)
    assert lead.id
    await _commit(db_session)
    # list by assigned_to + source
    items, total = await svc.list_leads(assigned_to=assignee.id, source_id=src.id)
    assert total >= 1
    assert await svc.get_lead(lead.id)
    await svc.update_lead(lead.id, {"status": "qualified", "assigned_to": admin.id}, actor_id=admin.id)
    await svc.set_status(lead.id, "proposal")
    await svc.mark_lost(lead.id, reason="budget", actor_id=admin.id)
    await _commit(db_session)
    # assigned_notify path
    await svc.update_lead(lead.id, {"status": "new", "assigned_to": assignee.id}, actor_id=admin.id)


async def test_lead_convert_flow(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    await _commit(db_session)
    svc = LeadService(db_session, LeadRepository(db_session), LeadActivityRepository(db_session))
    lead = await svc.create_lead({
        "title": _new("conv"), "status": "qualified", "priority": "medium",
        "company_name": "ConvertCo", "contact_name": "Jane", "email": "jane@conv.com",
    }, created_by=admin.id)
    await _commit(db_session)
    converted = await svc.convert_lead(lead.id, None, actor_id=admin.id)
    assert converted.status == "converted"
    assert converted.converted_client_id is not None
    assert converted.converted_project_id is not None
    with pytest.raises(Exception):
        await svc.convert_lead(lead.id, None, actor_id=admin.id)


async def test_lead_delete_removes_proposals(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    await _commit(db_session)
    svc = LeadService(db_session, LeadRepository(db_session), LeadActivityRepository(db_session))
    lead = await svc.create_lead({"title": _new("dl"), "status": "new", "priority": "low"}, created_by=admin.id)
    await _commit(db_session)
    await svc.delete_lead(lead.id)
    with pytest.raises(Exception):
        await svc.get_lead(lead.id)


async def test_lead_fk_validation(db_session: AsyncSession):
    user = await _make_user(db_session)
    await _commit(db_session)
    svc = LeadService(db_session, LeadRepository(db_session), LeadActivityRepository(db_session))
    with pytest.raises(Exception):
        await svc.create_lead({"title": "bad", "status": "new", "client_id": uuid.uuid4()}, created_by=user.id)
    with pytest.raises(Exception):
        await svc.create_lead({"title": "bad", "status": "new", "assigned_to": uuid.uuid4()}, created_by=user.id)
    with pytest.raises(Exception):
        await svc.create_lead({"title": "bad", "status": "new", "source_id": uuid.uuid4()}, created_by=user.id)


async def test_lead_activities_and_followups(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    other = await _make_user(db_session, "sales")
    await _commit(db_session)
    lead = await LeadService(db_session, LeadRepository(db_session), LeadActivityRepository(db_session)).create_lead(
        {"title": _new("l"), "status": "new", "priority": "low"}, created_by=admin.id)
    await _commit(db_session)
    act_svc = LeadActivityService(db_session, LeadActivityRepository(db_session))
    act = await act_svc.create_activity(lead.id, {"activity_type": "call", "description": "talked"}, performed_by=admin.id)
    assert act.id
    assert await act_svc.list_activities(lead.id)
    with pytest.raises(Exception):
        await act_svc.create_activity(uuid.uuid4(), {"activity_type": "call"})
    fu_svc = LeadFollowupService(db_session, LeadFollowupRepository(db_session))
    fu = await fu_svc.create_followup(lead.id, {"followup_date": datetime(2026, 8, 10, 10, 0), "followup_type": "email", "status": "pending"})
    fu2 = await fu_svc.create_followup(lead.id, {"followup_date": datetime(2026, 8, 11, 10, 0), "followup_type": "email", "status": "pending", "assigned_to": other.id})
    assert await fu_svc.list_followups(lead.id)
    await fu_svc.update_followup(fu.id, {"status": "completed"})
    await fu_svc.update_followup(fu2.id, {"assigned_to": admin.id})
    await fu_svc.delete_followup(fu.id)
    with pytest.raises(Exception):
        await fu_svc.delete_followup(fu.id)
    with pytest.raises(Exception):
        await fu_svc.create_followup(uuid.uuid4(), {"followup_date": datetime(2026, 8, 12, 10, 0), "followup_type": "email"})


async def test_sales_pipeline_crud(db_session: AsyncSession):
    svc = SalesPipelineService(SalesPipelineRepository(db_session))
    stage = await svc.create_stage({"name": _new("stage"), "stage": "discovery", "order": 1})
    assert stage.id
    items, total = await svc.list_stages()
    assert total >= 1
    await svc.update_stage(stage.id, {"stage": "proposal"})
    await svc.delete_stage(stage.id)
    with pytest.raises(Exception):
        await svc.delete_stage(stage.id)


# ── CRM module ──────────────────────────────────────────────────────────
from app.modules.crm.service import ClientService, ClientContactService, ClientAddressService, ClientNoteService, ClientDocumentService, ProposalService  # noqa: E402
from app.modules.crm.repository import ClientRepository, ClientContactRepository, ClientAddressRepository, ClientNoteRepository, ClientDocumentRepository, ProposalRepository  # noqa: E402


async def test_crm_client_graph(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    await _commit(db_session)
    client = await ClientService(db_session, ClientRepository(db_session)).create_client(
        {"company_name": _new("co"), "status": "active", "assigned_to": admin.id}, created_by=admin.id)
    assert client.id
    await _commit(db_session)
    contact = await ClientContactService(db_session, ClientContactRepository(db_session)).create_contact(
        client.id, {"name": _new("ct"), "email": "ct@x.com"})
    assert contact.id
    address = await ClientAddressService(db_session, ClientAddressRepository(db_session)).create_address(
        client.id, {"address_type": "office", "address_line_1": "1 main", "city": "Hyd", "country": "IN"})
    assert address.id
    note = await ClientNoteService(db_session, ClientNoteRepository(db_session)).create_note(client.id, {"content": "hi"})
    assert note.id
    doc = await ClientDocumentService(db_session, ClientDocumentRepository(db_session)).create_document(client.id, {"title": "inc"})
    assert doc.id
    prop = await ProposalService(db_session, ProposalRepository(db_session)).create_proposal(client.id, {"title": _new("prop")})
    assert prop.id
    # reads
    assert await ClientService(db_session, ClientRepository(db_session)).get_client(client.id)
    items, total = await ClientService(db_session, ClientRepository(db_session)).list_clients(status="active")
    assert total >= 1
    await ClientService(db_session, ClientRepository(db_session)).update_client(client.id, {"status": "active"})
    assert await ClientContactService(db_session, ClientContactRepository(db_session)).list_contacts(client.id)
    assert await ClientAddressService(db_session, ClientAddressRepository(db_session)).list_addresses(client.id)
    assert await ClientNoteService(db_session, ClientNoteRepository(db_session)).list_notes(client.id)
    assert await ClientDocumentService(db_session, ClientDocumentRepository(db_session)).list_documents(client.id)
    assert await ProposalService(db_session, ProposalRepository(db_session)).list_proposals(client_id=client.id)
    with pytest.raises(Exception):
        await ClientService(db_session, ClientRepository(db_session)).get_client(uuid.uuid4())


async def test_crm_client_update_assignment(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    await _commit(db_session)
    client = await ClientService(db_session, ClientRepository(db_session)).create_client(
        {"company_name": _new("co"), "status": "active", "assigned_to": admin.id}, created_by=admin.id)
    await _commit(db_session)
    svc = ClientService(db_session, ClientRepository(db_session))
    await svc.update_client(client.id, {"assigned_to": admin.id})
    await svc.delete_client(client.id)
    with pytest.raises(Exception):
        await svc.get_client(client.id)


# ── Finance module ──────────────────────────────────────────────────────
from datetime import date  # noqa: E402
from app.modules.finance.service import InvoiceService, InvoiceItemService, PaymentService, ExpenseService  # noqa: E402
from app.modules.finance.repository import InvoiceRepository, InvoiceItemRepository, PaymentRepository, ExpenseRepository  # noqa: E402


async def test_finance_invoice_and_items(db_session: AsyncSession):
    svc = InvoiceService(db_session, InvoiceRepository(db_session))
    inv = await svc.create_invoice({
        "invoice_number": _new("INV-"), "invoice_type": "advance", "status": "draft",
        "issue_date": date(2026, 8, 1), "due_date": date(2026, 9, 1), "currency": "INR"}, actor_id=None)
    assert inv.id
    await _commit(db_session)
    items, total = await svc.list_invoices(status="draft")
    assert total >= 1
    assert await svc.get_invoice(inv.id)
    item_svc = InvoiceItemService(InvoiceItemRepository(db_session))
    item = await item_svc.create_item(inv.id, {"description": "Setup", "unit_price": 1000.0, "total": 1000.0})
    assert item.id
    lis = await item_svc.list_items(inv.id)
    assert len(lis) == 1
    await item_svc.update_item(item.id, {"description": "Setup checked"})
    await item_svc.delete_item(item.id)
    with pytest.raises(Exception):
        await svc.get_invoice(uuid.uuid4())
    # update invoice
    upd = await svc.update_invoice(inv.id, {"status": "draft"})
    assert upd.status == "draft"


async def test_finance_payments_and_expenses(db_session: AsyncSession):
    svc = InvoiceService(db_session, InvoiceRepository(db_session))
    inv = await svc.create_invoice({
        "invoice_number": _new("INV-"), "invoice_type": "current", "status": "draft",
        "issue_date": date(2026, 8, 1), "due_date": date(2026, 9, 1), "currency": "INR"})
    await _commit(db_session)
    pay_svc = PaymentService(db_session, PaymentRepository(db_session))
    pay = await pay_svc.create_payment(inv.id, {"amount": 1000.0, "payment_date": date(2026, 8, 5), "payment_method": "bank_transfer", "status": "submitted"})
    assert pay.id
    await _commit(db_session)
    payments = await pay_svc.list_payments(inv.id)
    assert len(payments) >= 1
    all_items, all_total = await pay_svc.list_all_payments(status="submitted")
    assert all_total >= 1
    assert await pay_svc.get_payment(pay.id)
    await pay_svc.update_payment(pay.id, {"status": "completed"})
    exp_svc = ExpenseService(ExpenseRepository(db_session))
    exp = await exp_svc.create_expense({"category": "travel", "amount": 500.0, "currency": "INR", "expense_date": date(2026, 8, 2)})
    assert exp.id
    await _commit(db_session)
    eitems, etotal = await exp_svc.list_expenses(category="travel")
    assert etotal >= 1
    assert await exp_svc.get_expense(exp.id)
    await exp_svc.update_expense(exp.id, {"category": "software"})


# ── Tasks module ────────────────────────────────────────────────────────
from app.modules.tasks.service import ProjectService, ProjectMemberService, TaskService, TaskCommentService, TaskAttachmentService, TaskSubmissionService  # noqa: E402
from app.modules.tasks.repository import ProjectRepository, ProjectMemberRepository, TaskRepository, TaskCommentRepository, TaskAttachmentRepository, TaskSubmissionRepository  # noqa: E402


async def test_task_module_flow(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    await _commit(db_session)
    p_svc = ProjectService(ProjectRepository(db_session), db_session)
    project = await p_svc.create_project({"name": _new("proj")})
    assert project.id
    m_svc = ProjectMemberService(ProjectMemberRepository(db_session), ProjectRepository(db_session), db_session)
    member = await m_svc.add_member(project.id, admin.id, actor_id=admin.id)
    assert member.id
    assert await m_svc.list_members(project.id)
    with pytest.raises(Exception):
        await m_svc.add_member(project.id, admin.id, actor_id=admin.id)
    await m_svc.remove_member(project.id, admin.id, actor_id=admin.id)
    with pytest.raises(Exception):
        await m_svc.remove_member(project.id, admin.id, actor_id=admin.id)
    t_svc = TaskService(TaskRepository(db_session), db_session)
    task = await t_svc.create_task({"title": _new("task"), "project_id": project.id, "assigned_to": admin.id})
    assert task.task_number.startswith("TASK-")
    await _commit(db_session)
    items, total = await t_svc.list_tasks(project_id=project.id)
    assert total >= 1
    await t_svc.update_task(task.id, {"status": "in_progress"})
    await t_svc.update_task(task.id, {"assigned_to": admin.id, "status": "in_progress"})
    c_svc = TaskCommentService(TaskCommentRepository(db_session))
    comment = await c_svc.create_comment(task.id, {"content": "progress"}, user_id=admin.id)
    assert comment.id
    await c_svc.update_comment(comment.id, {"content": "updated"})
    await c_svc.delete_comment(comment.id)
    a_svc = TaskAttachmentService(TaskAttachmentRepository(db_session))
    att = await a_svc.create_attachment(task.id, {"file_name": "a.txt", "file_url": "https://x/a.txt"})
    assert att.id
    await a_svc.delete_attachment(att.id)
    sub_svc = TaskSubmissionService(TaskSubmissionRepository(db_session), TaskRepository(db_session), db_session)
    sub = await sub_svc.create(task.id, {"title": "deliverable", "completion_percentage": 100}, submitted_by=admin.id)
    assert sub.id
    queue, qtotal = await sub_svc.list_queue()
    assert qtotal >= 1
    reviewed = await sub_svc.review(sub.id, approve=True, reviewer_feedback="good", reviewer_id=admin.id)
    assert reviewed.status == "approved"
    await sub_svc.resubmit(sub.id, {"title": "v2"}, submitted_by=admin.id)
    with pytest.raises(Exception):
        await sub_svc.create(uuid.uuid4(), {"title": "x"}, submitted_by=admin.id)


async def test_task_project_completion(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    await _commit(db_session)
    p_svc = ProjectService(ProjectRepository(db_session), db_session)
    project = await p_svc.create_project({"name": _new("proj")})
    assert project.id
    completed = await p_svc.complete_project(project.id, actor_id=admin.id)
    assert completed.status == "completed"


# ── Careers module ──────────────────────────────────────────────────────
from app.modules.careers.service import JobOpeningService, InterviewService, OfferService  # noqa: E402
from app.modules.careers.schemas import JobOpeningCreate, JobApplicationCreate, JobApplicationUpdate, InterviewCreate, InterviewUpdate, OfferCreate, InterviewCompleteRequest  # noqa: E402


async def test_careers_flow(db_session: AsyncSession):
    admin = await _make_user(db_session, "admin")
    await _commit(db_session)
    job_svc = JobOpeningService(db_session)
    job = await job_svc.create(JobOpeningCreate(title=_new("job"), location="HYD", employment_type="full_time"))
    assert job.id
    jobs = await job_svc.list_all()
    assert len(jobs) == 1
    assert await job_svc.get(job.id)
    app = await job_svc.create_application(JobApplicationCreate(
        job_opening_id=job.id, applicant_name="AA", applicant_email="aa@x.com", applicant_phone="+911234567890"))
    assert app.id
    apps = await job_svc.list_applications(job.id, status=None)
    assert len(apps) == 1
    all_apps = await job_svc.list_all_applications()
    assert len(all_apps) == 1
    assert await job_svc.get_application(app.id)
    updated = await job_svc.update_application(app.id, JobApplicationUpdate(status="screening"), actor_id=admin.id)
    assert updated.status == "screening"
    iv_svc = InterviewService(db_session)
    iv = await iv_svc.schedule(app.id, InterviewCreate(scheduled_at="2026-08-20T10:00:00", interview_type="technical"), created_by=admin.id)
    assert iv.id
    ivs = await iv_svc.list_for_application(app.id)
    assert len(ivs) == 1
    all_ivs = await iv_svc.list_all()
    assert len(all_ivs) == 1
    assert await iv_svc.get(iv.id)
    await iv_svc.update(iv.id, InterviewUpdate(status="completed"))
    completed = await iv_svc.complete(iv.id, InterviewCompleteRequest(feedback="great", recommendation="hire"), actor_id=admin.id)
    assert completed.status == "completed"
    off_svc = OfferService(db_session)
    off = await off_svc.generate(app.id, OfferCreate(salary="8 LPA", joining_date="2026-09-01"), created_by=admin.id)
    assert off.id
    offers = await off_svc.list_for_application(app.id)
    assert len(offers) == 1
    all_offers = await off_svc.list_all()
    assert len(all_offers) == 1
    assert await off_svc.get(off.id)
    sent = await off_svc.update_status(off.id, "sent", actor_id=admin.id)
    assert sent.status == "sent"
    signed = await off_svc.accept_and_hire(off.id, actor_id=admin.id)
    assert signed[0].status == "accepted"
    with pytest.raises(Exception):
        await off_svc.accept_and_hire(off.id, actor_id=admin.id)