from flask import Blueprint, jsonify, request

from app.routes.doctors import DOCTORS  # reuse in-memory doctors list
from sms import send_sms  # or from app.sms import send_sms (depending on where you placed sms.py)

appointments_bp = Blueprint("appointments", __name__)

APPOINTMENTS = []


def find_doctor(doctor_id: int):
    return next((d for d in DOCTORS if d.get("id") == doctor_id), None)


def find_appointment(appt_id: int):
    return next((a for a in APPOINTMENTS if a.get("id") == appt_id), None)


def get_me_user():
    """
    Minimal auth helper: call your own /api/me endpoint internally via request context.
    If your /api/me is implemented in another module, this is the simplest:
    - we read from the same session by calling it as a request to the route is awkward,
      so instead, we recommend importing the function that returns current user.
    For MVP: we accept role/email passed in headers as a fallback (optional).
    """
    # If you already store user in session, replace this with that session read.
    # Example (if using Flask session): from flask import session; return session.get("user")
    # For now, try to use a header fallback to avoid breaking deploy if you haven’t exposed session here.
    role = (request.headers.get("X-Demo-Role") or "").strip().lower()
    email = (request.headers.get("X-Demo-Email") or "").strip().lower()

    if role and email:
        return {"role": role, "email": email}

    # If you have a global auth helper, plug it here.
    return None


@appointments_bp.route("/api/appointments", methods=["GET"])
def list_appointments():
    doctor_id = request.args.get("doctor_id")
    email = request.args.get("email")

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
    """
    PATCH body example:
    { "status": "confirmed" }  # or cancelled / completed
    """
    payload = request.get_json(silent=True) or {}
    new_status = str(payload.get("status", "")).strip().lower()

    allowed_statuses = {"booked", "confirmed", "cancelled", "completed"}
    if not new_status or new_status not in allowed_statuses:
        return jsonify({"error": "Invalid status", "allowed": sorted(list(allowed_statuses))}), 400

    appt = find_appointment(appt_id)
    if not appt:
        return jsonify({"error": "Appointment not found"}), 404

    # ---- MVP auth rules ----
    me = get_me_user()
    # If you can’t read session here yet, you can temporarily bypass by setting headers:
    # X-Demo-Role / X-Demo-Email
    if not me:
        return jsonify({"error": "Unauthorized (missing user context)"}), 401

    role = str(me.get("role") or "").strip().lower()
    email = str(me.get("email") or "").strip().lower()

    # Patients can only cancel their own appointment
    if role == "patient":
        appt_email = str(appt.get("email") or "").strip().lower()
        if email != appt_email:
            return jsonify({"error": "Forbidden"}), 403
        if new_status != "cancelled":
            return jsonify({"error": "Patients can only cancel appointments"}), 403

    # Doctors/Admin can update any status (MVP)
    elif role in ("doctor", "admin"):
        pass
    else:
        return jsonify({"error": "Forbidden"}), 403

    old_status = str(appt.get("status") or "").strip().lower()
    appt["status"] = new_status

    # ---- SMS on status change (non-blocking) ----
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
