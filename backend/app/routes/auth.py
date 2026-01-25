from flask import Blueprint, request, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from app.db import get_connection

auth_bp = Blueprint("auth", __name__)


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


def _public_user(u: dict):
    return {
        "user_id": u.get("id"),
        "email": u.get("email"),
        "name": u.get("name"),
        "role": u.get("role"),
        "patient_id": u.get("patient_id"),
        "doctor_id": u.get("doctor_id"),
        "phone": u.get("phone"),
    }


def _set_session(user: dict):
    session.clear()
    session["user_id"] = user.get("id")
    session["role"] = user.get("role")
    session["email"] = user.get("email")
    session["patient_id"] = user.get("patient_id")
    session["doctor_id"] = user.get("doctor_id")


def _find_user_by_email(email: str):
    email = _norm_email(email)
    if not email:
        return None
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE LOWER(email) = %s LIMIT 1", (email,))
            return cur.fetchone()


def _ensure_seed_users():
    seeds = [
        {
            "email": "patient@test.com",
            "password": "1234",
            "name": "Test Patient",
            "role": "patient",
            "patient_id": 101,
            "doctor_id": None,
            "phone": "+23000000000",
        },
        {
            "email": "doctor@test.com",
            "password": "1234",
            "name": "Dr Test",
            "role": "doctor",
            "patient_id": None,
            "doctor_id": 201,
            "phone": None,
        },
        {
            "email": "admin@test.com",
            "password": "1234",
            "name": "Admin",
            "role": "admin",
            "patient_id": None,
            "doctor_id": None,
            "phone": None,
        },
    ]

    with get_connection() as conn:
        with conn.cursor() as cur:
            for s in seeds:
                cur.execute("SELECT id FROM users WHERE LOWER(email) = %s", (_norm_email(s["email"]),))
                if cur.fetchone():
                    continue

                cur.execute(
                    """
                    INSERT INTO users (email, password_hash, name, phone, role, patient_id, doctor_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        _norm_email(s["email"]),
                        generate_password_hash(s["password"]),
                        s["name"],
                        s["phone"],
                        s["role"],
                        s["patient_id"],
                        s["doctor_id"],
                    ),
                )
        conn.commit()


@auth_bp.post("/api/auth/register")
def register():
    _ensure_seed_users()

    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    email = _norm_email(data.get("email"))
    password = (data.get("password") or "").strip()
    phone = (data.get("phone") or "").strip()

    missing = []
    if not name:
        missing.append("name")
    if not email:
        missing.append("email")
    if not password:
        missing.append("password")
    if not phone:
        missing.append("phone")

    if missing:
        return jsonify({"success": False, "error": "Missing required fields", "missing": missing}), 400

    if _find_user_by_email(email):
        return jsonify({"success": False, "error": "Email already registered"}), 409

    pwd_hash = generate_password_hash(password)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (email, password_hash, name, phone, role)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (email, pwd_hash, name, phone, "patient"),
            )
            user = cur.fetchone()

            patient_id = 1000 + int(user["id"])
            cur.execute(
                "UPDATE users SET patient_id = %s WHERE id = %s RETURNING *;",
                (patient_id, user["id"]),
            )
            user = cur.fetchone()
        conn.commit()

    _set_session(user)
    return jsonify({"success": True, "user": _public_user(user)}), 201


@auth_bp.post("/api/auth/login")
def login():
    _ensure_seed_users()

    data = request.get_json(silent=True) or {}
    email = _norm_email(data.get("email"))
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password required"}), 400

    user = _find_user_by_email(email)
    if not user:
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    stored_hash = user.get("password_hash") or ""
    if not check_password_hash(stored_hash, password):
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    _set_session(user)
    return jsonify({"success": True, "user": _public_user(user)}), 200


@auth_bp.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify({"success": True}), 200


@auth_bp.get("/api/me")
def me():
    _ensure_seed_users()

    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
            user = cur.fetchone()

    if not user:
        session.clear()
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    return jsonify({"success": True, "user": _public_user(user)}), 200
