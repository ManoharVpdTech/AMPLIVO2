r"""Seed demo data for the Client Dashboard so it has real, non-empty data to
verify against. Idempotent - safe to re-run.

Run: .venv\Scripts\python.exe seed_client_portal_demo.py
"""

import asyncio
import uuid
from datetime import date, timedelta

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.refresh_token import RefreshToken  # noqa: F401 - ensure model is registered
from app.modules.users.models import Role, UserProfile  # noqa: F401
from app.modules.crm.models import Client
from app.modules.campaigns.models import Campaign
from app.modules.leads.models import Lead, LeadSource
from app.modules.seo.models import SeoProject, SeoKeyword
from app.modules.creative.models import CreativeProject, CreativeAsset
from app.modules.content_calendar.models import ContentCalendarEntry
from app.modules.finance.models import Invoice, InvoiceItem, Payment
from app.modules.support_tickets.models import SupportTicket, SupportTicketComment
from app.modules.messaging.models import Conversation, Message
from app.modules.tasks.models import Project, Task
from app.modules.file_manager.models import FileFolder, File

DEMO_CLIENT_NAME = "Acme Marketing Co."


async def seed():
    async with AsyncSessionLocal() as session:
        client_user = (await session.execute(select(User).where(User.email == "client@amplivo.in"))).scalar_one_or_none()
        admin_user = (await session.execute(select(User).where(User.email == "admin@amplivo.in"))).scalar_one_or_none()
        crm_user = (await session.execute(select(User).where(User.email == "crm@amplivo.in"))).scalar_one_or_none()
        if crm_user and crm_user.full_name == "CRM Executive":
            crm_user.full_name = "Account Manager"

        if client_user is None:
            print("client@amplivo.in not found - run seed_demo_users.py first.")
            return

        assigned_manager_id = crm_user.id if crm_user else (admin_user.id if admin_user else None)

        client = (await session.execute(select(Client).where(Client.company_name == DEMO_CLIENT_NAME))).scalar_one_or_none()
        if client is None:
            client = Client(
                company_name=DEMO_CLIENT_NAME,
                display_name="Acme",
                industry="E-commerce",
                website="https://acme-demo.example.com",
                email="contact@acme-demo.example.com",
                phone="+91 90000 00000",
                client_type="regular",
                status="active",
                assigned_to=assigned_manager_id,
                is_active=True,
                created_by=admin_user.id if admin_user else None,
            )
            session.add(client)
            await session.flush()
            print(f"  Created client '{DEMO_CLIENT_NAME}' ({client.id})")
        else:
            if assigned_manager_id and (client.assigned_to is None or (admin_user and client.assigned_to == admin_user.id)):
                client.assigned_to = assigned_manager_id
                print(f"  Updated client '{DEMO_CLIENT_NAME}' assigned_to -> {assigned_manager_id}")
            print(f"  Client '{DEMO_CLIENT_NAME}' already exists ({client.id})")

        if client_user.client_id != client.id:
            client_user.client_id = client.id
            print(f"  Linked client@amplivo.in -> client_id={client.id}")

        await session.commit()

        # ── Campaigns ──
        existing_campaigns = (await session.execute(select(Campaign).where(Campaign.client_id == client.id))).scalars().all()
        if not existing_campaigns:
            c1 = Campaign(name="Summer Sale Push", client_id=client.id, type="social", status="Active",
                          start_date=date.today() - timedelta(days=20), end_date=date.today() + timedelta(days=10),
                          budget=150000, spent_amount=62000, target_audience="18-35 urban shoppers",
                          description="Instagram + Facebook ads for the summer sale.", manager_id=admin_user.id if admin_user else None)
            c2 = Campaign(name="Brand Awareness Q3", client_id=client.id, type="ads", status="Completed",
                          start_date=date.today() - timedelta(days=90), end_date=date.today() - timedelta(days=30),
                          budget=90000, spent_amount=88500, target_audience="General audience",
                          description="Display network brand awareness campaign.", manager_id=admin_user.id if admin_user else None)
            session.add_all([c1, c2])
            await session.flush()
            print("  Seeded 2 campaigns")
        await session.commit()

        # ── Leads ──
        existing_leads = (await session.execute(select(Lead).where(Lead.client_id == client.id))).scalars().all()
        if not existing_leads:
            source = (await session.execute(select(LeadSource).limit(1))).scalars().first()
            leads = [
                Lead(title="Website inquiry - bulk order", client_id=client.id, contact_name="Rahul Mehta",
                     email="rahul.mehta@example.com", phone="+91 98111 22334", source_id=source.id if source else None,
                     status="Hot", priority="High", estimated_value=45000, notes="Wants a quote for 200 units."),
                Lead(title="Instagram DM lead", client_id=client.id, contact_name="Sneha Kapoor",
                     email="sneha.k@example.com", phone="+91 98222 33445", source_id=source.id if source else None,
                     status="New", priority="Medium", estimated_value=12000),
            ]
            session.add_all(leads)
            await session.flush()
            print("  Seeded 2 leads")
        await session.commit()

        # ── SEO ──
        seo_project = (await session.execute(select(SeoProject).where(SeoProject.client_id == client.id))).scalars().first()
        if seo_project is None:
            seo_project = SeoProject(name="Acme Website SEO", client_id=client.id, target_url="https://acme-demo.example.com",
                                     description="Ongoing organic search optimisation.", status="active",
                                     manager_id=admin_user.id if admin_user else None)
            session.add(seo_project)
            await session.flush()
            keywords = [
                SeoKeyword(project_id=seo_project.id, keyword="buy sneakers online", search_volume=8100, difficulty=42.0, current_rank=7, target_rank=3),
                SeoKeyword(project_id=seo_project.id, keyword="acme sneakers", search_volume=1200, difficulty=18.0, current_rank=2, target_rank=1),
            ]
            session.add_all(keywords)
            await session.flush()
            print("  Seeded SEO project + keywords")
        await session.commit()

        # ── Creative ──
        creative_project = (await session.execute(select(CreativeProject).where(CreativeProject.client_id == client.id))).scalars().first()
        if creative_project is None:
            creative_project = CreativeProject(name="Summer Sale Creatives", client_id=client.id,
                                                description="Ad creatives for the summer sale campaign.", status="active",
                                                manager_id=admin_user.id if admin_user else None)
            session.add(creative_project)
            await session.flush()
            assets = [
                CreativeAsset(project_id=creative_project.id, name="Instagram Story - Sale Banner", asset_type="image",
                              file_url="https://picsum.photos/seed/acme1/800/600", version="v1", status="pending",
                              designer_id=admin_user.id if admin_user else None),
                CreativeAsset(project_id=creative_project.id, name="Facebook Feed Ad", asset_type="image",
                              file_url="https://picsum.photos/seed/acme2/800/600", version="v1", status="approved",
                              designer_id=admin_user.id if admin_user else None),
            ]
            session.add_all(assets)
            await session.flush()
            print("  Seeded creative project + assets")
        await session.commit()

        # ── Content calendar ──
        cal_entries = (await session.execute(select(ContentCalendarEntry).where(ContentCalendarEntry.client_id == client.id))).scalars().all()
        if not cal_entries:
            entries = [
                ContentCalendarEntry(title="Sale launch post", content_type="social_post", platform="Instagram",
                                     client_id=client.id, scheduled_date=date.today() + timedelta(days=2), status="draft",
                                     content_brief="Announce the summer sale.", created_by=admin_user.id if admin_user else None),
                ContentCalendarEntry(title="Behind the scenes reel", content_type="reel", platform="Instagram",
                                     client_id=client.id, scheduled_date=date.today() + timedelta(days=5), status="scheduled",
                                     content_brief="Studio shoot BTS.", created_by=admin_user.id if admin_user else None),
            ]
            session.add_all(entries)
            await session.flush()
            print("  Seeded content calendar entries")
        await session.commit()

        # ── Finance ──
        invoice = (await session.execute(select(Invoice).where(Invoice.client_id == client.id))).scalars().first()
        if invoice is None:
            invoice = Invoice(client_id=client.id, invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
                              status="sent", issue_date=date.today() - timedelta(days=10),
                              due_date=date.today() + timedelta(days=20), subtotal=50000, tax_total=9000,
                              total_amount=59000, currency="INR", notes="Monthly retainer - marketing services.")
            session.add(invoice)
            await session.flush()
            session.add(InvoiceItem(invoice_id=invoice.id, description="Social media management (monthly)",
                                    quantity=1, unit_price=35000, tax_rate=18, total=41300))
            session.add(InvoiceItem(invoice_id=invoice.id, description="Ad spend management fee",
                                    quantity=1, unit_price=15000, tax_rate=18, total=17700))
            await session.flush()
            print("  Seeded invoice + items")
        await session.commit()

        # ── Support ticket ──
        ticket = (await session.execute(select(SupportTicket).where(SupportTicket.client_id == client.id))).scalars().first()
        if ticket is None:
            ticket = SupportTicket(client_id=client.id, subject="Question about invoice INV number",
                                   description="Could you clarify the tax breakdown on our latest invoice?",
                                   category="billing", priority="medium", status="open", created_by=client_user.id)
            session.add(ticket)
            await session.flush()
            session.add(SupportTicketComment(ticket_id=ticket.id, user_id=admin_user.id if admin_user else None,
                                             content="Sure, the 18% GST is itemised in the invoice PDF - let us know if you need more detail."))
            await session.flush()
            print("  Seeded support ticket + reply")
        await session.commit()

        # ── Projects / Tasks ──
        project = (await session.execute(select(Project).where(Project.client_id == client.id))).scalars().first()
        if project is None:
            project = Project(name="Website Revamp", client_id=client.id, description="Redesign of acme-demo.example.com",
                              status="active", start_date=date.today() - timedelta(days=15),
                              end_date=date.today() + timedelta(days=45), manager_id=admin_user.id if admin_user else None)
            session.add(project)
            await session.flush()
            tasks = [
                Task(title="Wireframe homepage", project_id=project.id, status="done", priority="high",
                     due_date=None, assigned_to=admin_user.id if admin_user else None, created_by=admin_user.id if admin_user else None),
                Task(title="Build product listing page", project_id=project.id, status="in_progress", priority="medium",
                     assigned_to=admin_user.id if admin_user else None, created_by=admin_user.id if admin_user else None),
                Task(title="QA + launch checklist", project_id=project.id, status="todo", priority="medium",
                     created_by=admin_user.id if admin_user else None),
            ]
            session.add_all(tasks)
            await session.flush()
            print("  Seeded project + tasks")
        await session.commit()

        # ── Documents / Files ──
        folder = (await session.execute(select(FileFolder).where(FileFolder.client_id == client.id))).scalars().first()
        if folder is None:
            folder = FileFolder(name="Acme Documents", client_id=client.id, created_by=admin_user.id if admin_user else None)
            session.add(folder)
            await session.flush()
            session.add(File(name="brand-guidelines.pdf", original_name="Brand Guidelines.pdf", mime_type="application/pdf",
                             size=245000, url="https://example.com/files/brand-guidelines.pdf", folder_id=folder.id,
                             client_id=client.id, uploaded_by=admin_user.id if admin_user else None))
            session.add(File(name="q3-report.pdf", original_name="Q3 Performance Report.pdf", mime_type="application/pdf",
                             size=512000, url="https://example.com/files/q3-report.pdf", folder_id=folder.id,
                             client_id=client.id, uploaded_by=admin_user.id if admin_user else None))
            await session.flush()
            print("  Seeded documents folder + files")
        await session.commit()

        # ── Messaging ──
        conversation = (await session.execute(select(Conversation).where(Conversation.client_id == client.id))).scalars().first()
        if conversation is None:
            conversation = Conversation(client_id=client.id, subject="General")
            session.add(conversation)
            await session.flush()
            session.add(Message(conversation_id=conversation.id, sender_id=admin_user.id if admin_user else None,
                                content="Hi! Just checking in - how did the summer sale campaign launch go on your end?"))
            await session.flush()
            print("  Seeded conversation + welcome message")
        await session.commit()

        print("\nClient portal demo data seeded successfully!")
        print(f"Login as client@amplivo.in / Amplivo!Client2026 to view '{DEMO_CLIENT_NAME}' data.")


if __name__ == "__main__":
    asyncio.run(seed())
