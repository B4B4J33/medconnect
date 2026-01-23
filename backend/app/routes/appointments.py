from flask import Blueprint, jsonify, request

from app.routes.doctors import DOCTORS  # reuse in-memory doctors list
from sms import send_sms


appointments_bp = Blueprint("appointments", __name__)

APPOINTMENTS = []


def find_doctor(doctor_id: int):
    return next((d for d in DOCTORS if d.get("id") == doctor_id), None)


@appointments_bp.route("/api/appointments", methods=["GET"])
def list_appointments():
    doctor_id = request.args.get("doctor_id")
    email = request.args.get("email")  # NEW (optional filter)

    result = APPOINTMENTS

    if doctor_id is not None:
        try:
            did = int(doctor_id)
        except ValueError:
            return jsonify({"error": "doctor_id must be an integer"}), 400

        result = [a for a in result if a.get("doctor_id") == did]

    if email:
        email_norm = str(email).strip().lower()
        result = [a for a in result if str(a.get("email", "")).strip().lower() == email_norm]

    # Return consistent shape for dashboard: {count, items}
    return jsonify({"count": len(result), "items": result}), 200


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

    # ---- SMS (non-blocking) ----
    sms_result = {"ok": False, "error": "not_sent"}
    try:
        # Keep message short and clear
        sms_text = (
            f"MedConnect: Appointment confirmed with {new_item['doctor']} "
            f"on {new_item['date']} at {new_item['time']}."
        )
        sms_result = send_sms(new_item["phone"], sms_text)
    except Exception as e:
        sms_result = {"ok": False, "error": str(e)}

    return jsonify({
        "success": True,
        "appointment": new_item,
        "sms": {
            "sent": bool(sms_result.get("ok")),
            "sid": sms_result.get("sid"),
            "error": sms_result.get("error") if not sms_result.get("ok") else None,
        }
    }), 201
