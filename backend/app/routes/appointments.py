from flask import Blueprint, jsonify, request, session

from app.routes.doctors import DOCTORS
from app.db import get_connection
from sms import send_sms

appointments_bp = Blueprint("appointments", __name__)


def find_doctor(doctor_id: int):
    return next((d for d in DOCTORS if d.get("id") == doctor_id), None)


def fetch_one(appt_id: int):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM appointments WHERE id = %s", (appt_id,))
            return cur.fetchone()


@appointments_bp.route("/api/appointments", methods=["GET"])
def list_appointments():
    role = (session.get("role") or "").strip().lower()
    if not role:
        return jsonify({"error": "Unauthorized"}), 401

    where = []
    params = []

    doctor_id = request.args.get("doctor_id")
    email = request.args.get("email")

    if doctor_id is not None:
        try:
            did = int(doctor_id)
        except ValueError:
            return jsonify({"error": "doctor_id must be an integer"}), 400
        where.append("doctor_id = %s")
        params.append(did)

    if email:
        where.append("LOWER(email) = %s")
        params.append(str(email).strip().lower())

    sql = "SELECT * FROM appointments"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY id DESC"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    return jsonify({"count": len(rows), "items": rows}), 200


@appointments_bp.route("/api/appointments", methods=["POST"])
def create_appointment():
    role = (session.get("role") or "").strip().lower()
    if not role:
        return jsonify({"error": "Unauthorized"}), 401
    if role != "patient":
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
    full_name = str(doctor.get("full_name", "")).strip().lower()
    if doctor_name and full_name and doctor_name != full_name:
        return jsonify({"error": "doctor_id does not match selected doctor name"}), 400

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO appointments
                    (doctor_id, doctor, specialty, date, time, name, email, phone, status)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (
                    doctor_id,
                    payload["doctor"],
                    payload["specialty"],
                    payload["date"],
                    payload["time"],
                    payload["name"],
                    payload["email"],
                    payload["phone"],
                    "booked",
                ),
            )
            appt = cur.fetchone()
        conn.commit()

    sms_result = {"ok": False, "error": "not_sent"}
    try:
        sms_text = (
            f"MedConnect: Appointment confirmed with {appt['doctor']} "
            f"on {appt['date']} at {appt['time']}."
        )
        sms_result = send_sms(appt["phone"], sms_text)
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
    }), 201


@appointments_bp.route("/api/appointments/<int:appt_id>", methods=["PATCH"])
def update_appointment(appt_id: int):
    role = (session.get("role") or "").strip().lower()
    if not role:
        return jsonify({"error": "Unauthorized"}), 401

    payload = request.get_json(silent=True) or {}
    new_status = str(payload.get("status", "")).strip().lower()

    allowed = {"booked", "confirmed", "cancelled", "completed"}
    if not new_status or new_status not in allowed:
        return jsonify({"error": "Invalid status", "allowed": sorted(list(allowed))}), 400

    appt = fetch_one(appt_id)
    if not appt:
        return jsonify({"error": "Appointment not found"}), 404

    if role == "patient":
        appt_email = str(appt.get("email") or "").strip().lower()
        req_email = str(payload.get("email") or "").strip().lower()
        if req_email and req_email != appt_email:
            return jsonify({"error": "Forbidden"}), 403
        if new_status != "cancelled":
            return jsonify({"error": "Forbidden"}), 403

    elif role in ("doctor", "admin"):
        pass
    else:
        return jsonify({"error": "Forbidden"}), 403

    old_status = str(appt.get("status") or "").strip().lower()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE appointments SET status = %s WHERE id = %s RETURNING *;",
                (new_status, appt_id),
            )
            updated = cur.fetchone()
        conn.commit()

    sms_result = {"ok": False, "error": "not_sent"}
    try:
        if new_status != old_status:
            sms_text = (
                f"MedConnect: Your appointment with {updated.get('doctor','your doctor')} "
                f"on {updated.get('date','')} at {updated.get('time','')} is now {new_status}."
            )
            sms_result = send_sms(updated.get("phone", ""), sms_text)
    except Exception as e:
        sms_result = {"ok": False, "error": str(e)}

    return jsonify({
        "success": True,
        "appointment": updated,
        "sms": {
            "sent": bool(sms_result.get("ok")),
            "sid": sms_result.get("sid"),
            "error": sms_result.get("error") if not sms_result.get("ok") else None,
        }
    }), 200
