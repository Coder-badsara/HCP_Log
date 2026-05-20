import os
from typing import AsyncGenerator

from fastapi import HTTPException
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base


load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "",
)

if not DATABASE_URL:
    # Local default so interaction saving works without a MySQL setup.
    DATABASE_URL = "sqlite+aiosqlite:///./aivoa.db"

Base = declarative_base()

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db():
    # Create tables (only for development/demo)
    if engine is None:
        return

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
