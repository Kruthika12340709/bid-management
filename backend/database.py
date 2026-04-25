from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.engine import URL
from dotenv import load_dotenv
import os

load_dotenv()


def _build_database_url() -> str:
    """
    Resolve the database connection from environment.

    Preferred form — DB_CON_STR (libpq keyword/value):
        DB_CON_STR="dbname=chitti_apps user=avatar_name password=isi4ja8# port=5000 host=aegis-psql.postgres.database.azure.com"

    Fallback — DATABASE_URL (SQLAlchemy URL):
        DATABASE_URL=postgresql+asyncpg://user:pw@host:port/db?ssl=require

    DB_CON_STR is parsed and converted into a SQLAlchemy URL so that asyncpg
    handles password URL-encoding correctly (passwords like 'isi4ja8#' contain
    characters that are unsafe in URLs).
    """
    con = os.getenv("DB_CON_STR")
    if con:
        kv = {}
        for chunk in con.strip().strip('"').split():
            if "=" in chunk:
                k, v = chunk.split("=", 1)
                kv[k.strip()] = v.strip()

        # libpq uses 'sslmode'; asyncpg uses 'ssl'
        sslmode = kv.pop("sslmode", None)
        query = {}
        if sslmode and sslmode.lower() != "disable":
            query["ssl"] = sslmode

        url = URL.create(
            drivername="postgresql+asyncpg",
            username=kv.get("user"),
            password=kv.get("password"),
            host=kv.get("host"),
            port=int(kv["port"]) if kv.get("port") else None,
            database=kv.get("dbname"),
            query=query,
        )
        return url.render_as_string(hide_password=False)

    url = os.getenv("DATABASE_URL")
    if url:
        return url

    raise RuntimeError(
        "Database connection not configured. Set DB_CON_STR (libpq form) or "
        "DATABASE_URL (URL form) in the environment."
    )


DATABASE_URL = _build_database_url()

# Tell asyncpg to issue `SET search_path TO mei, public` on every new connection
# so unqualified table references (`FROM bids`) resolve to the mei schema.
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={
        "server_settings": {"search_path": "mei,public"},
    },
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
