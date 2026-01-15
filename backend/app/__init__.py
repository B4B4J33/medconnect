from flask import Flask, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/api/health")
def health():
    return {"status": "ok"}

# In-memory store (demo only, no DB yet)
APPOINTMENTS = []

@app.route("/api/appointments", methods=["POST"])
def create_appointment():
    data = request.get_json(silent=True) or {}

    required = ["doctor", "specialty", "date", "time", "name", "phone", "email"]
    missing = [k for k in required if not str(data.get(k, "")).strip()]
    if missing:
        return {"success": False, "error": "Missing fields", "missing": missing}, 400

    APPOINTMENTS.append(data)
    return {"success": True}, 201

# Optional but VERY useful for testing in browser
@app.route("/api/appointments", methods=["GET"])
def list_appointments():
    return {"count": len(APPOINTMENTS), "items": APPOINTMENTS}, 200
