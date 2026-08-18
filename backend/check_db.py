# backend/check_db.py

from sqlalchemy import text

from database import engine


def main():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database(), current_user")
        )
        database_name, user_name = result.one()

        print("Supabase 연결 성공")
        print("데이터베이스:", database_name)
        print("사용자:", user_name)


if __name__ == "__main__":
    main()