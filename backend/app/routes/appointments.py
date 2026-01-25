from flask import Blueprint, jsonify, request, session

from app.routes.doctors import DOCTORS
from sms import send_sms

appointments_bp = Blueprint("appointments", __name__)

APPOINTMENTS = []


def find_doctor(doctor_id: int):
    return next((d for d in DOCTORS if d.get("id") == doctor_id), None)


def find_appointment(appt_id: int):
    return next((a for a in APPOINTMENTS if a.get("id") == appt_id), None)


@appointments_bp.route("/api/appointments", methods=["GET"])
def list_appointments():
    role = session.get("role")
    email = session.get("email")
    doctor_id_session = session.get("doctor_id")

    if not role:
        return jsonify({"error": "Unauthorized"}), 401

    if role == "admin":
        result = APPOINTMENTS

    elif role == "doctor":
        result = [a for a in APPOINTMENTS if a.get("doctor_id") == doctor_id_session]

    elif role == "patient":
        result = [
            a for a in APPOINTMENTS
            if str(a.get("email", "")).strip().lower() == str(email).lower()
        ]

    else:
        return jsonify({"error": "Forbidden"}), 403

    doctor_id = request.args.get("doctor_id")
    email_param = request.args.get("email")

    if doctor_id is not None:
        try:
            did = int(doctor_id)
        except ValueError:
            return jsonify({"error": "doctor_id must be an integer"}), 400
        result = [a for a in result if a.get("doctor_id") == did]

    if email_param:
        email_norm = str(email_param).strip().lower()
        result = [a for a in result if str(a.get("email", "")).strip().lower() == email_norm]

    return jsonify({"count": len(result), "items": result}), 200


@appointments_bp.route("/api/appointments", methods=["POST"])
def create_appointment():
    if session.get("role") != "patient":
        return jsonify({"error": "Forbidden"}), 403

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

    sms_result = {"ok": False, "error": "not_sent"}
    try:
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


@appointments_bp.route("/api/appointments/<int:appt_id>", methods=["PATCH"])
def update_appointment(appt_id: int):
    payload = request.get_json(silent=True) or {}
    new_status = str(payload.get("status", "")).strip().lower()

    allowed_statuses = {"booked", "confirmed", "cancelled", "completed"}
    if not new_status or new_status not in allowed_statuses:
        return jsonify({"error": "Invalid status", "allowed": sorted(list(allowed_statuses))}), 400

    appt = find_appointment(appt_id)
    if not appt:
        return jsonify({"error": "Appointment not found"}), 404

    role = session.get("role")
    email = session.get("email")

    if not role:
        return jsonify({"error": "Unauthorized"}), 401

    if role == "patient":
        appt_email = str(appt.get("email") or "").strip().lower()
        if email != appt_email or new_status != "cancelled":
            return jsonify({"error": "Forbidden"}), 403

    elif role not in ("doctor", "admin"):
        return jsonify({"error": "Forbidden"}), 403

    old_status = str(appt.get("status") or "").strip().lower()
    appt["status"] = new_status

    sms_result = {"ok": False, "error": "not_sent"}
    try:
        if new_status != old_status:
            sms_text = (
                f"MedConnect: Your appointment with {appt.get('doctor','your doctor')} "
                f"on {appt.get('date','')} at {appt.get('time','')} is now {new_status}."
            )
            sms_result = send_sms(appt.get("phone", ""), sms_text)
    except Exception as e:
        sms_result = {"ok": False, "error": str(e)}

    return jsonify({
        "success": True,
        "appointment": appt,
        "sms": {
            "sent": bool(sms_result.get("ok")),
            "sid": sms_result.get("sid"),
            "error": sms_result.get("error") if not sms_result.get("ok") else None,
        }
    }), 200
