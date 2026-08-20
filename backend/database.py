import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL 환경변수가 설정되지 않았습니다."
    )
# Render/Supabase에서 postgres:// 형태를 제공하는 경우 SQLAlchemy 형식으로 변환
# if DATABASE_URL.startswith("postgres://"):
#     DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
engine_options = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
}

if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {
        "check_same_thread": False
    }
else:
    engine_options.update(
        {
            "pool_size": 10,
            "max_overflow": 10,
            "pool_timeout": 30,
        }
    )

engine_options = {
    "connect_args": connect_args,
    "pool_pre_ping": True,
}

if not DATABASE_URL.startswith("sqlite"):
    engine_options.update(
        {
            "pool_size": 10,
            "max_overflow": 20,
            "pool_timeout": 30,
            "pool_recycle": 300,
            "pool_use_lifo": True,
        }
    )

engine = create_engine(
    DATABASE_URL,
    **engine_options,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
