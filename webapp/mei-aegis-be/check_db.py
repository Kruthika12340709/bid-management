import asyncio
from database import engine
from sqlalchemy import text

async def test():
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'mei'"))
            tables = result.fetchall()
            print('Tables in mei schema:', [t[0] for t in tables])
    except Exception as e:
        print('DB error:', e)

asyncio.run(test())