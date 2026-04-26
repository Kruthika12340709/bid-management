"""Apply seed.sql (RFP + module data) without wiping bid_* tables."""
import asyncio
import os
import sys
from pathlib import Path

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv()
import asyncpg

SQL_FILE = Path(__file__).parent / "seed.sql"


async def main():
    raw_url = os.getenv("DATABASE_URL", "")
    url = raw_url.replace("postgresql+asyncpg://", "postgresql://").replace("?ssl=require", "")

    conn = await asyncpg.connect(url, ssl="require")
    try:
        sql = SQL_FILE.read_text(encoding="utf-8")
        await conn.execute(sql)
        print("Seed data applied successfully.")

        rows = await conn.fetch("SELECT rfp_id, client_name, title FROM mei.rfp_module")
        print(f"\nrfp_module: {len(rows)} rows")
        for r in rows:
            print(f"  {r['rfp_id']} | {r['client_name']} | {r['title']}")
    finally:
        await conn.close()


asyncio.run(main())
