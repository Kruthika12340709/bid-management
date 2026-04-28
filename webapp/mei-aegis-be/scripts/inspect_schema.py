"""Print the column schema of every public table in the Aiven DB."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import engine


async def main():
    async with engine.begin() as conn:
        tables = [r[0] for r in (await conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' ORDER BY table_name"
        ))).all()]

        for t in tables:
            print(f"\n=== {t} ===")
            cols = (await conn.execute(text(
                "SELECT column_name, data_type, is_nullable, column_default "
                "FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name = :t "
                "ORDER BY ordinal_position"
            ), {"t": t})).all()
            for c in cols:
                nullable = "NULL" if c[2] == "YES" else "NOT NULL"
                default = f" DEFAULT {c[3]}" if c[3] else ""
                print(f"  {c[0]:<28} {c[1]:<20} {nullable}{default}")

            sample = (await conn.execute(text(f'SELECT * FROM "{t}" LIMIT 1'))).all()
            if sample:
                print(f"  -- sample row --")
                row = sample[0]._mapping
                for k, v in row.items():
                    val_str = str(v)[:80] + ("..." if len(str(v)) > 80 else "")
                    print(f"  {k:<28} = {val_str}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
