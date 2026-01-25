import os
import psycopg
from psycopg.rows import dict_row


def _db_url():
    url = os.getenv("DATABASE_URL") or os.getenv("database_url")
    if not url or not str(url).strip():
        raise RuntimeError("DATABASE_URL is not set")
    return url.strip()


def get_connection():
    return psycopg.connect(_db_url(), row_factory=dict_row)


def init_db():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS appointments (
                    id SERIAL PRIMARY KEY,
                    doctor_id INTEGER NOT NULL,
                    doctor TEXT NOT NULL,
                    specialty TEXT NOT NULL,
                    date TEXT NOT NULL,
                    time TEXT NOT NULL,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    status TEXT NOT NULL
                );
            """)
        conn.commit()
