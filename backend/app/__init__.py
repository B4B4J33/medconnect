from flask import Flask, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

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
# List appointments (GET) — demo/testing only
# --------------------
@app.route("/api/appointments", methods=["GET"])
def list_appointments():
    return {
        "count": len(APPOINTMENTS),
        "items": APPOINTMENTS,
    }, 200
