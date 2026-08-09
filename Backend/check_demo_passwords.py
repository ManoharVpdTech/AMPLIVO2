import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.refresh_token import RefreshToken  # noqa: F401
from app.modules.users.models import Role, Permission, RolePermission, Branch, Department, Team, Designation, UserProfile  # noqa: F401
from app.utils.password import verify_password, hash_password

DEMO_ACCOUNTS = [
    ("admin@amplivo.in", "Amplivo!Admin2026"),
    ("client@amplivo.in", "Amplivo!Client2026"),
    ("sales@amplivo.in", "Amplivo!Sales2026"),
    ("hr@amplivo.in", "Amplivo!Hr2026"),
    ("employee@amplivo.in", "Amplivo!Emp2026"),
]

async def check_and_fix():
    async with AsyncSessionLocal() as session:
        for email, pwd in DEMO_ACCOUNTS:
            user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
            if not user:
                print(f"User {email} NOT FOUND!")
                continue
            
            matches = verify_password(pwd, user.hashed_password)
            print(f"User: {email} | Password '{pwd}' matches: {matches}")
            
            if not matches:
                print(f"  -> Updating hashed_password for {email} to match '{pwd}'")
                user.hashed_password = hash_password(pwd)
                user.is_active = True
                user.status = "active"
                await session.flush()
        
        await session.commit()
        print("\nAll demo passwords checked and updated successfully!")

if __name__ == "__main__":
    asyncio.run(check_and_fix())
