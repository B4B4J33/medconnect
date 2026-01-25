from flask import Blueprint, jsonify
from app.db import get_connection

db_health_bp = Blueprint("db_health", __name__)


@db_health_bp.get("/api/db-health")
def db_health():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok;")
            row = cur.fetchone()
    return jsonify({"ok": True, "db": row}), 200
