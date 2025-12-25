import time
import json
from typing import Any, Dict, Optional

import httpx

from ..core import settings

_token_cache: Dict[str, Any] = {"token": None, "expires_at": 0.0}


async def _fetch_token(client: httpx.AsyncClient) -> str:
    base = (settings.ROUTEMOBILE_BASE_URL or "").rstrip("/")
    # Support both oauth client credentials and username/password login depending on config
    login_path = settings.ROUTEMOBILE_LOGIN_PATH or "/oauth/token"
    url = f"{base}{login_path}"

    # Try username/password first if provided (jwt_login style)
    if settings.ROUTEMOBILE_USERNAME and settings.ROUTEMOBILE_PASSWORD:
        payload: Dict[str, Any] = {
            "username": settings.ROUTEMOBILE_USERNAME,
            "password": settings.ROUTEMOBILE_PASSWORD,
        }
        resp = await client.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        # Route Mobile variants return different keys. Support common ones:
        # - JWTAUTH (observed for /auth/v1/login/)
        # - access_token / token / jwt (other deployments)
        token = (
            data.get("JWTAUTH")
            or data.get("access_token")
            or data.get("token")
            or data.get("jwt")
        )
        if not token:
            raise RuntimeError("RouteMobile token response missing token field")
        # cache ~55 minutes by default
        _token_cache["token"] = token
        _token_cache["expires_at"] = time.time() + float(data.get("expires_in") or 3300)
        return token

    # Fallback to OAuth client credentials if configured
    if settings.ROUTEMOBILE_CLIENT_ID and settings.ROUTEMOBILE_CLIENT_SECRET:
        payload = {
            "grant_type": "client_credentials",
            "client_id": settings.ROUTEMOBILE_CLIENT_ID,
            "client_secret": settings.ROUTEMOBILE_CLIENT_SECRET,
        }
        resp = await client.post(url, data=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        token = data.get("access_token")
        if not token:
            raise RuntimeError("RouteMobile OAuth response missing access_token")
        _token_cache["token"] = token
        _token_cache["expires_at"] = time.time() + float(data.get("expires_in") or 3300)
        return token

    raise RuntimeError("RouteMobile credentials not configured. Set username/password or client id/secret.")


async def get_token(client: Optional[httpx.AsyncClient] = None) -> str:
    now = time.time()
    if _token_cache.get("token") and now < float(_token_cache.get("expires_at", 0)) - 60:
        return str(_token_cache["token"])  # type: ignore
    close = False
    if client is None:
        client = httpx.AsyncClient()
        close = True
    try:
        return await _fetch_token(client)
    finally:
        if close:
            await client.aclose()


async def send_session_message(to: str, text: Optional[str] = None, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Sends a session message using Route Mobile WhatsApp API.

    If `payload` is provided, it will be forwarded as-is to the RM messages endpoint.
    If only `to` and `text` are provided, a simple text payload will be constructed.
    """
    base = (settings.ROUTEMOBILE_BASE_URL or "").rstrip("/")
    msg_path = settings.ROUTEMOBILE_MESSAGES_PATH or "/v1/messages"
    url = f"{base}{msg_path}"

    async with httpx.AsyncClient(timeout=30) as client:
        token = await get_token(client)

        def headers_variants() -> list[Dict[str, str]]:
            base = {"Content-Type": "application/json"}
            # Respect .env preference first
            variants = []
            if settings.ROUTEMOBILE_AUTH_HEADER_BEARER:
                variants.append({**base, "Authorization": f"Bearer {token}"})
                variants.append({**base, "Authorization": str(token)})
            else:
                variants.append({**base, "Authorization": str(token)})
                variants.append({**base, "Authorization": f"Bearer {token}"})
            return variants

        def payload_variants() -> list[Dict[str, Any]]:
            if payload:
                return [payload]
            if "/wba/" in msg_path:
                # Normalize phone number: extract digits only
                phone_digits = ''.join(ch for ch in to if ch.isdigit())
                
                # Route Mobile WBA expects just 10 digits (it adds +91 automatically)
                # If number has country code (starts with 91 and is 12+ digits), remove it
                if len(phone_digits) >= 12 and phone_digits.startswith('91'):
                    # Remove country code: 918129104784 -> 8129104784
                    phone_val = phone_digits[2:]
                elif len(phone_digits) == 10:
                    # Already 10 digits, use as-is
                    phone_val = phone_digits
                else:
                    # Use as-is (might be invalid, but let Route Mobile handle it)
                    phone_val = phone_digits
                
                txt = text or ""
                sender = (settings.ROUTEMOBILE_SENDER or "").lstrip("+")
                # Try simplest forms first based on provider error hints
                variants: list[Dict[str, Any]] = [
                    {"phone": phone_val, "text": txt},
                    {"phone": phone_val, "message": {"type": "text", "text": txt}},
                    {"phone": phone_val, "type": "text", "text": {"body": txt}},
                    {"to": to, "type": "text", "text": {"body": txt}},
                    {"phone": phone_val, "media": {"type": "text", "text": txt}},
                    # Additional common shapes seen in Route Mobile docs/tenants
                    {"phone": phone_val, "content": txt},
                    {"phone": phone_val, "message": {"type": "text", "text": {"body": txt}}},
                    {"phone": phone_val, "media": {"type": "text", "text": {"body": txt}}},
                ]
                # Additional common RM variants requiring explicit source/sender
                if sender:
                    variants.extend([
                        {"source": sender, "destination": phone_val, "text": txt},
                        {"source": sender, "destination": phone_val, "message": {"type": "text", "text": txt}},
                        {"from": sender, "to": phone_val, "message": {"channel": "whatsapp", "type": "text", "text": txt}},
                        {"source": sender, "destination": phone_val, "content": txt},
                        {"from": sender, "to": phone_val, "text": {"body": txt}},
                        {"channel": "whatsapp", "source": sender, "destination": phone_val, "message": {"type": "text", "text": {"body": txt}}},
                    ])
                return variants
            # Non-WBA generic
            return [{"to": to, "type": "text", "text": {"body": text or ""}}]

        errors: list[Dict[str, Any]] = []
        for hdrs in headers_variants():
            for body in payload_variants():
                resp = await client.post(url, headers=hdrs, json=body)
                try:
                    data = resp.json()
                except Exception:
                    data = {"status_code": resp.status_code, "text": resp.text}
                if resp.status_code < 400:
                    return data
                # Sanitize sensitive headers (avoid leaking tokens)
                safe_headers: Dict[str, str] = dict(hdrs)
                if "Authorization" in safe_headers:
                    auth_val = safe_headers.get("Authorization") or ""
                    if isinstance(auth_val, str) and len(auth_val) > 12:
                        safe_headers["Authorization"] = f"{auth_val[:6]}...{auth_val[-4:]}"
                    else:
                        safe_headers["Authorization"] = "<redacted>"
                errors.append({
                    "status": resp.status_code,
                    "headers": safe_headers,
                    "body": body,
                    "response": data,
                })
        # If we reached here, all variants failed. Raise with first and last error examples.
        summary = {
            "first_error": errors[0] if errors else {},
            "last_error": errors[-1] if errors else {},
            "attempts": len(errors),
        }
        raise RuntimeError(json.dumps({
            "error": "RouteMobile send failed",
            **summary,
        }))
