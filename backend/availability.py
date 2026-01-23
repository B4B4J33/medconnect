
# backend/availability.py
from flask import Blueprint, jsonify, request

availability_bp = Blueprint("availability", __name__)

# In-memory storage (Phase 2 simple mode)
# Key: doctor_id (int or str), Value: weekly schedule dict
DOCTOR_AVAILABILITY = {}

# Simple default schedule (used if a doctor has none yet)
DEFAULT_WEEKLY_SCHEDULE = {
    "mon": ["09:00-12:00", "13:00-16:00"],
    "tue": ["09:00-12:00", "13:00-16:00"],
    "wed": ["09:00-12:00"],
    "thu": ["09:00-12:00", "13:00-16:00"],
    "fri": ["09:00-12:00"],
    "sat": [],
    "sun": [],
}

VALID_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}


def _is_valid_window(s: str) -> bool:
    # Expected format: "HH:MM-HH:MM"
    if not isinstance(s, str) or "-" not in s:
        return False
    start, end = s.split("-", 1)
    if len(start) != 5 or len(end) != 5:
        return False
    # naive validation; good enough for uni project
    return start[2] == ":" and end[2] == ":"


def _validate_schedule(data: dict):
    if not isinstance(data, dict):
        return "Schedule must be an object."

    unknown = set(data.keys()) - VALID_DAYS
    if unknown:
        return f"Unknown day keys: {sorted(list(unknown))}"

    for day in VALID_DAYS:
        windows = data.get(day, [])
        if windows is None:
            windows = []
        if not isinstance(windows, list):
            return f"'{day}' must be an array."
        for w in windows:
            if not _is_valid_window(w):
                return f"Invalid time window '{w}' in '{day}'. Use 'HH:MM-HH:MM'."

    return None


@availability_bp.get("/api/doctors/<doctor_id>/availability")
def get_availability(doctor_id):
    schedule = DOCTOR_AVAILABILITY.get(str(doctor_id))
    if schedule is None:
        # Don’t auto-save default; just return it
        schedule = DEFAULT_WEEKLY_SCHEDULE
    return jsonify({"doctor_id": str(doctor_id), "weekly": schedule})


@availability_bp.put("/api/doctors/<doctor_id>/availability")
def put_availability(doctor_id):
    data = request.get_json(silent=True) or {}
    weekly = data.get("weekly")

    err = _validate_schedule(weekly)
    if err:
        return jsonify({"error": err}), 400

    DOCTOR_AVAILABILITY[str(doctor_id)] = weekly
    return jsonify({"ok": True, "doctor_id": str(doctor_id), "weekly": weekly})
