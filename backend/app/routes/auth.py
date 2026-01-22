from flask import Blueprint, request, session

auth_bp = Blueprint("auth", __name__)

# -----------------------------------------
# Demo in-memory users (replace with DB later)
# -----------------------------------------
USERS = [
    # Ready-to-use test accounts (optional):
    # {"id": 1, "email": "patient@test.com", "password": "1234", "name": "Test Patient", "role": "patient", "patient_id": 101},
    # {"id": 2, "email": "doctor@test.com",  "password": "1234", "name": "Dr Test",      "role": "doctor",  "doctor_id": 201},
    # {"id": 3, "email": "admin@test.com",   "password": "1234", "name": "Admin",        "role": "admin"},
]

def _find_user_by_email(email: str):
    email = (email or "").strip().lower()
    for u in USERS:
        if u["email"].lower() == email:
            return u
    return None

def _public_user(u: dict):
    return {
        "user_id": u.get("id"),
        "email": u.get("email"),
        "name": u.get("name"),
        "role": u.get("role"),
        "patient_id": u.get("patient_id"),
        "doctor_id": u.get("doctor_id"),
    }

@auth_bp.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    phone = (data.get("phone") or "").strip()

    missing = []
    if not name: missing.append("name")
    if not email: missing.append("email")
    if not password: missing.append("password")
    if not phone: missing.append("phone")

    if missing:
        return {"success": False, "error": "Missing required fields", "missing": missing}, 400

    if _find_user_by_email(email):
        return {"success": False, "error": "Email already registered"}, 409

    new_id = (max([u["id"] for u in USERS], default=0) + 1)
    new_patient_id = 1000 + new_id  # demo patient_id

    user = {
        "id": new_id,
        "name": name,
        "email": email,
        "password": password,  # demo only (hash later)
        "phone": phone,
        "role": "patient",
        "patient_id": new_patient_id,
    }
    USERS.append(user)

    # Auto-login after register
    session["user_id"] = user["id"]
    session["role"] = user["role"]

    return {"success": True, "user": _public_user(user)}, 201

@auth_bp.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return {"success": False, "error": "Email and password required"}, 400

    user = _find_user_by_email(email)
    if not user or user.get("password") != password:
        return {"success": False, "error": "Invalid credentials"}, 401

    session["user_id"] = user["id"]
    session["role"] = user["role"]

    return {"success": True, "user": _public_user(user)}, 200

@auth_bp.post("/api/auth/logout")
def logout():
    session.clear()
    return {"success": True}, 200

@auth_bp.get("/api/me")
def me():
    user_id = session.get("user_id")
    if not user_id:
        return {"success": False, "error": "Unauthorized"}, 401

    user = next((u for u in USERS if u.get("id") == user_id), None)
    if not user:
        session.clear()
        return {"success": False, "error": "Unauthorized"}, 401

    return {"success": True, "user": _public_user(user)}, 200
