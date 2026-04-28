"""Apply schema.sql to the configured database using asyncpg directly."""
import asyncio
import os
import sys
from pathlib import Path

# Windows Python 3.10 fix for asyncpg + SSL
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv()
import asyncpg

SQL_FILE = Path(__file__).parent / "schema.sql"


async def main():
    raw_url = os.getenv("DATABASE_URL", "")
    # asyncpg uses postgresql://, not postgresql+asyncpg://
    url = raw_url.replace("postgresql+asyncpg://", "postgresql://").replace("?ssl=require", "")

    conn = await asyncpg.connect(url, ssl="require")
    try:
        sql = SQL_FILE.read_text(encoding="utf-8")
        await conn.execute(sql)
        print("Schema applied successfully.")
    finally:
        await conn.close()


asyncio.run(main())
