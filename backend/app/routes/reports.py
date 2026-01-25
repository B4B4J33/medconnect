from flask import Blueprint, jsonify, session

reports_bp = Blueprint("reports", __name__)

@reports_bp.get("/api/reports")
def list_reports():
    role = (session.get("role") or "").strip().lower()
    if not role:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"count": 0, "items": []}), 200
