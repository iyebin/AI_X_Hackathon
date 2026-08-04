import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# Render에서는 Environment에 등록한 Supabase 주소를 사용하고,
# 로컬에서는 DATABASE_URL이 없으면 SQLite를 사용합니다.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./ansim.db",
)

# 일부 서비스가 postgres:// 형식으로 제공하는 경우
# SQLAlchemy가 인식하는 postgresql:// 형식으로 변경합니다.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1,
    )


# SQLite와 PostgreSQL의 연결 설정을 구분합니다.
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={
            "check_same_thread": False,
        },
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
    )


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()