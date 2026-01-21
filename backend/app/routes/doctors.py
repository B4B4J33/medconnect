from flask import Blueprint, jsonify, request

doctors_bp = Blueprint("doctors", __name__)

DOCTORS = [
    {"id": 1, "full_name": "Dr John Smith", "specialty": "Cardiology", "available": True},
    {"id": 2, "full_name": "Dr Jane Doe", "specialty": "Dermatology", "available": True},
]

@doctors_bp.route("/api/doctors", methods=["GET"])
def list_doctors():
    specialty = request.args.get("specialty")
    available = request.args.get("available")

    result = DOCTORS

    if specialty:
        result = [d for d in result if d["specialty"].lower() == specialty.lower()]

    if available is not None:
        result = [d for d in result if d["available"] == (available.lower() == "true")]

    return jsonify(result), 200
