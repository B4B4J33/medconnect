# sms.py
import os
from twilio.rest import Client


def _env_bool(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "y", "on")


def send_sms(to_phone: str, message: str) -> dict:
    """
    Send an SMS via Twilio.
    Returns: { ok: bool, sid?: str, error?: str }
    Never raises.
    """
    if not _env_bool("SMS_ENABLED", "false"):
        return {"ok": False, "error": "SMS disabled (SMS_ENABLED=false)"}

    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    from_phone = os.getenv("TWILIO_FROM", "").strip()

    if not account_sid or not auth_token or not from_phone:
        return {"ok": False, "error": "Missing Twilio env vars"}

    if not to_phone or not str(to_phone).strip().startswith("+"):
        return {"ok": False, "error": "Phone must be E.164 format (start with +)"}

    try:
        client = Client(account_sid, auth_token)
        msg = client.messages.create(
            body=message,
            from_=from_phone,
            to=str(to_phone).strip(),
        )
        return {"ok": True, "sid": msg.sid}
    except Exception as e:
        return {"ok": False, "error": str(e)}
