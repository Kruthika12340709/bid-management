"""Quick smoke test: connects to Aiven and lists tables."""
import asyncio
import sys
from pathlib import Path

# Allow running this script directly (adds backend/ to path)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import engine


async def main():
    async with engine.begin() as conn:
        version = (await conn.execute(text("SELECT version()"))).scalar()
        print(f"Connected. Server: {version[:80]}...")

        rows = (await conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        ))).all()
        print(f"\nTables in public schema ({len(rows)}):")
        for r in rows:
            count = (await conn.execute(text(f'SELECT COUNT(*) FROM "{r[0]}"'))).scalar()
            print(f"  {r[0]:<30} ({count} rows)")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
