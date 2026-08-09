"""Create the 5 remaining tables that failed due to FK ordering."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
if os.getenv("DB_SSL_MODE") is None:
    os.environ["DB_SSL_MODE"] = "disable"

from app.db.base import Base

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.audit_log import AuditLog
from app.models.login_history import LoginHistory
from app.models.password_reset_token import PasswordResetToken
from app.models.email_verification_token import EmailVerificationToken
from app.models.user_session import UserSession
from app.modules.users.models import Role, Permission, RolePermission, Branch, Department, UserProfile, Designation, Team
from app.modules.crm.models import Client, ClientContact, ClientAddress, ClientDocument, ClientNote
from app.modules.companies.models import Company
from app.modules.campaigns.models import Campaign, CampaignPlatform, CampaignAsset, CampaignMetric
from app.modules.analytics.models import Dashboard, Report, DataIntegration
from app.modules.seo.models import SeoProject, SeoKeyword, SeoAudit, SeoBacklink
from app.modules.social.models import SocialProfile, SocialPost, SocialMetric
from app.modules.cms.models import ContentCategory, ContentItem
from app.modules.finance.models import Invoice, InvoiceItem, Payment, Expense
from app.modules.activity_timeline.models import ActivityLog
from app.modules.notifications.models import NotificationTemplate, Notification
from app.modules.portfolio.models import PortfolioItem
from app.modules.file_manager.models import FileFolder, File
from app.modules.approval_system.models import ApprovalPolicy, ApprovalRequest, ApprovalDecision
from app.modules.content_calendar.models import ContentCalendarEntry
from app.modules.paidads.models import AdCampaign, AdGroup, AdMetric
from app.modules.careers.models import JobOpening, JobApplication
from app.modules.client_portal.models import PortalSetting, PortalAnnouncement, PortalResource
from app.modules.influencers.models import Influencer, InfluencerCampaign, InfluencerContract
from app.modules.contact_forms.models import ContactSubmission
from app.modules.faqs.models import FaqCategory, Faq
from app.modules.tasks.models import Project, Task, TaskComment, TaskAttachment
from app.modules.timesheets.models import Timesheet
from app.modules.consultation_requests.models import ConsultationRequest
from app.modules.case_studies.models import CaseStudy, CaseStudyMetric
from app.modules.marketing_automation.models import AutomationWorkflow, AutomationAction, AutomationLog
from app.modules.settings.models import SystemSetting, UserPreference
from app.modules.creative.models import CreativeProject, CreativeAsset, CreativeFeedback
from app.modules.testimonials.models import Testimonial
from app.modules.leads.models import LeadSource, Lead, LeadActivity, LeadFollowup, SalesPipeline
from app.modules.websites.models import Website, WebsitePage, WebsiteMetric

import asyncpg
from sqlalchemy.schema import CreateTable
from sqlalchemy import create_engine

dummy_engine = create_engine("postgresql+psycopg2://", strategy="mock", executor=lambda *a, **kw: None)

ALL_TABLES = set(Base.metadata.tables.keys())

# Order for FK-dependent tables
RETRY_ORDER = [
    "approval_decisions",
    "automation_actions",
    "automation_logs",
    "login_history",
    "website_metrics",
]

async def run():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(
            "DATABASE_URL env var is not set. This script previously embedded the "
            "production connection string in source; it now reads it from the environment."
        )
    # asyncpg.connect accepts the SQLAlchemy-style URL once the "+asyncpg"
    # dialect hint is stripped.
    pg_url = database_url.replace("postgresql+asyncpg://", "postgresql://", 1).split("?")[0]
    conn = await asyncpg.connect(pg_url, ssl="require")
    
    for table_name in RETRY_ORDER:
        table = Base.metadata.tables[table_name]
        ddl = CreateTable(table).compile(dialect=dummy_engine.dialect)
        ddl_str = str(ddl).strip().replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1)
        try:
            await conn.execute(ddl_str)
            print(f"  Created: {table_name}")
        except Exception as e:
            print(f"  FAILED {table_name}: {e}")
    
    # Also create any other missing tables
    rows = await conn.fetch("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'")
    existing = {r['tablename'] for r in rows}
    still_missing = ALL_TABLES - existing
    if still_missing:
        print(f"\nStill missing: {sorted(still_missing)}")
        for table_name in sorted(still_missing):
            table = Base.metadata.tables[table_name]
            ddl = CreateTable(table).compile(dialect=dummy_engine.dialect)
            ddl_str = str(ddl).strip().replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1)
            try:
                await conn.execute(ddl_str)
                print(f"  Created: {table_name}")
            except Exception as e:
                print(f"  FAILED {table_name}: {e}")
    
    rows2 = await conn.fetch("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'")
    final = sorted([r['tablename'] for r in rows2])
    print(f"\nFinal table count: {len(final)}")
    
    await conn.close()

asyncio.run(run())
