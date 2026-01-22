from flask import Flask, request
from flask_cors import CORS
import os

app = Flask(__name__)

# Required for session-based auth
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key")

app.config.update(
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=True,
)


# Allow cookies / sessions from frontend
CORS(
    app,
    supports_credentials=True,
    resources={r"/api/*": {"origins": [
        "https://medconnect-frontend-fy9z.onrender.com"
    ]}}
)


# --------------------
# Register blueprints
# --------------------
from app.routes.appointments import appointments_bp
app.register_blueprint(appointments_bp)

from app.routes.doctors import doctors_bp
app.register_blueprint(doctors_bp)

from app.routes.auth import auth_bp
app.register_blueprint(auth_bp)

# --------------------
# Health check
# --------------------
@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "ok"}, 200


# --------------------
# In-memory storage (demo only)
# --------------------
APPOINTMENTS = []


# --------------------
# Create appointment (POST)
# Demo/testing only – keep for now
# --------------------
@app.route("/api/appointments", methods=["POST"])
def create_appointment():
    data = request.get_json(silent=True) or {}

    required_fields = [
        "doctor",
        "specialty",
        "date",
        "time",
        "name",
        "phone",
        "email",
    ]

    missing = [
        field for field in required_fields
        if not str(data.get(field, "")).strip()
    ]

    if missing:
        return {
            "success": False,
            "error": "Missing required fields",
            "missing": missing,
        }, 400

    APPOINTMENTS.append(data)

    return {
        "success": True,
        "message": "Appointment created successfully",
    }, 201


# --------------------
# List appointments (GET)
# Demo/testing only – keep for now
# --------------------
@app.route("/api/appointments", methods=["GET"])
def list_appointments():
    return {
        "count": len(APPOINTMENTS),
        "items": APPOINTMENTS,
    }, 200
