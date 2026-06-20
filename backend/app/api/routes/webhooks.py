"""Clerk webhook receiver — syncs Clerk user lifecycle events into the users table.

Every request is signature-verified. Verification uses the official `svix` library
when it is installed (full stack); otherwise it falls back to a stdlib HMAC-SHA256
check that replicates the Svix scheme, so the endpoint stays functional on the
minimal install — mirroring the project's documented-fallback convention.

Configure the endpoint in the Clerk dashboard to POST to:  /api/webhooks/clerk
and set CLERK_WEBHOOK_SIGNING_SECRET (the `whsec_...` value) in the environment.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal
from app.db.models import User

logger = logging.getLogger("venturegenesis.webhooks")
router = APIRouter()

_TOLERANCE = 5 * 60  # seconds of clock skew allowed on the timestamp


def _verify(payload: bytes, headers: dict[str, str], secret: str) -> dict:
    """Return the parsed event after verifying the Svix signature, else raise 400."""
    # Primary path: the official Svix verifier.
    try:
        from svix.webhooks import Webhook, WebhookVerificationError  # type: ignore

        try:
            return Webhook(secret).verify(payload, headers)
        except WebhookVerificationError as exc:
            raise HTTPException(status_code=400, detail="Invalid signature") from exc
    except ImportError:
        pass  # fall through to the stdlib implementation

    # Fallback path: stdlib HMAC-SHA256, replicating the Svix signing scheme.
    svix_id = headers.get("svix-id")
    svix_ts = headers.get("svix-timestamp")
    svix_sig = headers.get("svix-signature")
    if not (svix_id and svix_ts and svix_sig):
        raise HTTPException(status_code=400, detail="Missing Svix headers")

    try:
        if abs(time.time() - int(svix_ts)) > _TOLERANCE:
            raise HTTPException(status_code=400, detail="Timestamp out of tolerance")
    except ValueError:
        raise HTTPException(status_code=400, detail="Bad timestamp")

    secret_b64 = secret.split("_", 1)[1] if secret.startswith("whsec_") else secret
    key = base64.b64decode(secret_b64)
    signed = f"{svix_id}.{svix_ts}.{payload.decode()}".encode()
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()

    # The svix-signature header is a space-delimited list of "v1,<sig>" tokens.
    ok = any(
        "," in part and hmac.compare_digest(part.split(",", 1)[1], expected)
        for part in svix_sig.split()
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid signature")

    return json.loads(payload.decode())


def _primary_email(data: dict) -> str | None:
    emails = data.get("email_addresses") or []
    primary_id = data.get("primary_email_address_id")
    for e in emails:
        if e.get("id") == primary_id:
            return e.get("email_address")
    return emails[0].get("email_address") if emails else None


def _upsert_user(db: Session, data: dict) -> None:
    clerk_id = data.get("id")
    if not clerk_id:
        return
    user = db.query(User).filter(User.clerk_id == clerk_id).one_or_none()
    if user is None:
        user = User(clerk_id=clerk_id)
        db.add(user)
    user.email = _primary_email(data)
    user.first_name = data.get("first_name")
    user.last_name = data.get("last_name")
    user.image_url = data.get("image_url")
    user.updated_at = datetime.utcnow()
    db.commit()


@router.post("/webhooks/clerk")
async def clerk_webhook(request: Request):
    secret = settings.CLERK_WEBHOOK_SIGNING_SECRET
    if not secret:
        # Surface the misconfiguration instead of silently accepting spoofed events.
        raise HTTPException(status_code=500, detail="CLERK_WEBHOOK_SIGNING_SECRET not set")

    payload = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }
    evt = _verify(payload, headers, secret)

    etype = evt.get("type")
    data = evt.get("data", {}) or {}

    db: Session = SessionLocal()
    try:
        if etype in ("user.created", "user.updated"):
            _upsert_user(db, data)
            logger.info("Clerk %s synced (clerk_id=%s)", etype, data.get("id"))
        elif etype == "user.deleted":
            clerk_id = data.get("id")
            if clerk_id:
                db.query(User).filter(User.clerk_id == clerk_id).delete()
                db.commit()
                logger.info("Clerk user deleted (clerk_id=%s)", clerk_id)
        # Any other event type is acknowledged without action.
    finally:
        db.close()

    return {"ok": True}
