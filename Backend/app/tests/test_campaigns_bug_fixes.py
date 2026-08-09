import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.jwt import create_access_token
from app.models.user import User
from app.modules.crm.models import Client
from app.modules.users.models import Role


async def create_test_user_and_token(db: AsyncSession, role_slug: str = "staff", client_id: uuid.UUID | None = None) -> tuple[User, str]:
    from sqlalchemy import select
    res = await db.execute(select(Role).where(Role.slug == role_slug))
    role = res.scalar_one_or_none()
    if role is None:
        role = Role(id=uuid.uuid4(), name=role_slug.title(), slug=role_slug)
        db.add(role)
        await db.commit()
        await db.refresh(role)

    user = User(
        id=uuid.uuid4(),
        email=f"user_{uuid.uuid4().hex[:8]}@example.com",
        username=f"user_{uuid.uuid4().hex[:8]}",
        full_name="Test User",
        hashed_password="hashed_pass_placeholder",
        is_active=True,
        role_id=role.id,
        client_id=client_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return user, token


async def create_test_client(db: AsyncSession) -> Client:
    client_obj = Client(
        id=uuid.uuid4(),
        company_name=f"Test Client {uuid.uuid4().hex[:6]}",
        status="active",
    )
    db.add(client_obj)
    await db.commit()
    await db.refresh(client_obj)
    return client_obj


@pytest.mark.asyncio
async def test_cm_bug_001_idor_tenant_isolation(client: AsyncClient, db_session: AsyncSession) -> None:
    client_a = await create_test_client(db_session)
    client_b = await create_test_client(db_session)

    user_a, token_a = await create_test_user_and_token(db_session, role_slug="client", client_id=client_a.id)
    user_b, token_b = await create_test_user_and_token(db_session, role_slug="client", client_id=client_b.id)

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a campaign
    res = await client.post(
        "/api/v1/campaigns",
        headers=headers_a,
        json={"name": "Campaign A", "client_id": str(client_a.id), "type": "social"}
    )
    assert res.status_code == 201
    camp_a_id = res.json()["id"]

    # User B tries to GET User A's campaign -> 403 Forbidden
    res_get = await client.get(f"/api/v1/campaigns/{camp_a_id}", headers=headers_b)
    assert res_get.status_code == 403

    # User B tries to PUT User A's campaign -> 403 Forbidden
    res_put = await client.put(
        f"/api/v1/campaigns/{camp_a_id}",
        headers=headers_b,
        json={"name": "Hacked Name"}
    )
    assert res_put.status_code == 403

    # User B tries to DELETE User A's campaign -> 403 Forbidden
    res_del = await client.delete(f"/api/v1/campaigns/{camp_a_id}", headers=headers_b)
    assert res_del.status_code == 403


@pytest.mark.asyncio
async def test_cm_bug_002_003_fk_validation(client: AsyncClient, db_session: AsyncSession) -> None:
    _, token = await create_test_user_and_token(db_session, role_slug="marketing")
    headers = {"Authorization": f"Bearer {token}"}

    fake_id = str(uuid.uuid4())

    # Create campaign with invalid client_id -> 404 (not 500)
    res = await client.post(
        "/api/v1/campaigns",
        headers=headers,
        json={"name": "Bad FK Client", "client_id": fake_id, "type": "social"}
    )
    assert res.status_code == 404
    assert "Client" in res.json()["message"]

    # Create valid campaign first
    c_obj = await create_test_client(db_session)
    res_valid = await client.post(
        "/api/v1/campaigns",
        headers=headers,
        json={"name": "Valid Camp", "client_id": str(c_obj.id), "type": "social"}
    )
    assert res_valid.status_code == 201
    camp_id = res_valid.json()["id"]

    # Update campaign with invalid manager_id -> 404 (not 500)
    res_upd = await client.put(
        f"/api/v1/campaigns/{camp_id}",
        headers=headers,
        json={"manager_id": fake_id}
    )
    assert res_upd.status_code == 404
    assert "User" in res_upd.json()["message"]


@pytest.mark.asyncio
async def test_cm_bug_005_negative_values(client: AsyncClient, db_session: AsyncSession) -> None:
    c_obj = await create_test_client(db_session)
    _, token = await create_test_user_and_token(db_session, role_slug="marketing")
    headers = {"Authorization": f"Bearer {token}"}

    # Negative budget on create campaign -> 422
    res = await client.post(
        "/api/v1/campaigns",
        headers=headers,
        json={"name": "Neg Budget", "client_id": str(c_obj.id), "type": "social", "budget": -50.0}
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_cm_bug_007_large_numbers_validation(client: AsyncClient, db_session: AsyncSession) -> None:
    c_obj = await create_test_client(db_session)
    _, token = await create_test_user_and_token(db_session, role_slug="marketing")
    headers = {"Authorization": f"Bearer {token}"}

    res_camp = await client.post(
        "/api/v1/campaigns",
        headers=headers,
        json={"name": "Camp for metrics", "client_id": str(c_obj.id), "type": "social"}
    )
    camp_id = res_camp.json()["id"]

    # Metric impressions out of integer range -> 422 (not 500)
    res_metric = await client.post(
        f"/api/v1/campaigns/{camp_id}/metrics",
        headers=headers,
        json={"date": "2026-08-06", "impressions": 99999999999999999}
    )
    assert res_metric.status_code == 422


@pytest.mark.asyncio
async def test_cm_bug_008_end_date_before_start_date(client: AsyncClient, db_session: AsyncSession) -> None:
    c_obj = await create_test_client(db_session)
    _, token = await create_test_user_and_token(db_session, role_slug="marketing")
    headers = {"Authorization": f"Bearer {token}"}

    # end_date before start_date -> 422
    res = await client.post(
        "/api/v1/campaigns",
        headers=headers,
        json={
            "name": "Bad Dates",
            "client_id": str(c_obj.id),
            "type": "social",
            "start_date": "2026-08-10",
            "end_date": "2026-08-01"
        }
    )
    assert res.status_code == 422
