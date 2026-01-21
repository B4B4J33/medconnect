from flask import Blueprint, jsonify, request

from app.routes.doctors import DOCTORS  # reuse in-memory doctors list

appointments_bp = Blueprint("appointments", __name__)

APPOINTMENTS = []


def find_doctor(doctor_id: int):
    return next((d for d in DOCTORS if d.get("id") == doctor_id), None)


@appointments_bp.route("/api/appointments", methods=["GET"])
def list_appointments():
    doctor_id = request.args.get("doctor_id")

    result = APPOINTMENTS

    if doctor_id is not None:
        try:
            did = int(doctor_id)
        except ValueError:
            return jsonify({"error": "doctor_id must be an integer"}), 400

        result = [a for a in result if a.get("doctor_id") == did]

    return jsonify(result), 200


@appointments_bp.route("/api/appointments", methods=["POST"])
def create_appointment():
    payload = request.get_json(silent=True) or {}

    required = ["specialty", "doctor", "date", "time", "name", "phone", "email", "doctor_id"]
    missing = [k for k in required if not payload.get(k)]
    if missing:
        return jsonify({"error": "Missing required fields", "missing": missing}), 400

    try:
        doctor_id = int(payload["doctor_id"])
    except (TypeError, ValueError):
        return jsonify({"error": "doctor_id must be an integer"}), 400

    doctor = find_doctor(doctor_id)
    if not doctor:
        return jsonify({"error": f"Invalid doctor_id: {doctor_id}"}), 400

    # Optional consistency check: ensure doctor name matches doctor_id (prevents mismatch)
    doctor_name = str(payload.get("doctor", "")).strip().lower()
    if doctor_name and str(doctor.get("full_name", "")).strip().lower() != doctor_name:
        return jsonify({"error": "doctor_id does not match selected doctor name"}), 400

    new_item = {
        "id": len(APPOINTMENTS) + 1,
        "specialty": payload["specialty"],
        "doctor": payload["doctor"],
        "doctor_id": doctor_id,
        "date": payload["date"],
        "time": payload["time"],
        "name": payload["name"],
        "phone": payload["phone"],
        "email": payload["email"],
        "status": "booked",
    }

    APPOINTMENTS.append(new_item)
    return jsonify(new_item), 201
