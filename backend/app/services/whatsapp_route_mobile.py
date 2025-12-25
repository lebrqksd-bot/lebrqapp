from __future__ import annotations

import time
import logging
from typing import Any, Dict, List, Optional

import httpx

from app.core import settings

logger = logging.getLogger(__name__)


class RouteMobileWhatsAppClient:
    """
    Minimal Route Mobile WhatsApp client.

    This client supports:
    - Generating an access token (if required by the account setup)
    - Sending a WhatsApp template message (e.g., template "bookingreg")

    NOTE:
    Route Mobile deployments differ (direct BSP vs proxy APIs). Adjust the endpoints/payloads
    according to your account's documentation. This implementation follows a common pattern
    similar to Meta's template send with Route Mobile-provided bearer token.
    """

    _token: Optional[str] = None
    _token_expiry: float = 0.0

    def __init__(self) -> None:
        # Considered configured if base URL exists; sender may be optional depending on account
        pass

    def is_configured(self) -> bool:
        return bool(settings.ROUTEMOBILE_BASE_URL)

    async def _get_token(self, client: httpx.AsyncClient) -> Optional[str]:
        """
        Acquire/cached token depending on configured auth mode:
        - oauth: client credentials flow on ROUTEMOBILE_LOGIN_PATH (default /oauth/token)
        - jwt_login: username/password login on ROUTEMOBILE_LOGIN_PATH (e.g., /auth/v1/login/)
        Returns token string or None if not needed/failed.
        """
        now = time.time()
        if self._token and now < self._token_expiry - 30:
            return self._token

        base = settings.ROUTEMOBILE_BASE_URL.rstrip("/") if settings.ROUTEMOBILE_BASE_URL else ""
        login_path = settings.ROUTEMOBILE_LOGIN_PATH or "/oauth/token"
        auth_url = f"{base}{login_path}"

        mode = (settings.ROUTEMOBILE_AUTH_MODE or "oauth").lower()
        try:
            if mode == "jwt_login":
                # Username/password login returns a JWT (often 'JWTAUTH')
                if not settings.ROUTEMOBILE_USERNAME or not settings.ROUTEMOBILE_PASSWORD:
                    return None
                resp = await client.post(
                    auth_url,
                    json={
                        "username": settings.ROUTEMOBILE_USERNAME,
                        "password": settings.ROUTEMOBILE_PASSWORD,
                    },
                    headers={"Content-Type": "application/json"},
                    timeout=15.0,
                )
                resp.raise_for_status()
                data = resp.json()
                token = data.get("JWTAUTH") or data.get("access_token")
                if token:
                    # no explicit expiry returned; assume 1 hour
                    self._token = token
                    self._token_expiry = now + 3600
                    return self._token
                logger.warning("[ROUTEMOBILE] Login succeeded but token not found in response: %s", data)
                return None

            # Default: oauth client credentials
            if not settings.ROUTEMOBILE_CLIENT_ID or not settings.ROUTEMOBILE_CLIENT_SECRET:
                return None
            resp = await client.post(
                auth_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.ROUTEMOBILE_CLIENT_ID,
                    "client_secret": settings.ROUTEMOBILE_CLIENT_SECRET,
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()
            token = data.get("access_token")
            if token:
                self._token = token
                expires_in = data.get("expires_in", 300)
                self._token_expiry = now + float(expires_in)
                return self._token
            logger.warning("[ROUTEMOBILE] OAuth succeeded but access_token missing: %s", data)
            return None
        except Exception as e:
            logger.error("[ROUTEMOBILE] Failed to obtain token: %s", e)
            return None

    async def send_template(
        self,
        to_mobile: str,
        template_name: str,
        language: str,
        body_parameters: List[str],
        header_parameters: Optional[List[str]] = None,
        button_parameters: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp template message.

        Args:
          to_mobile: recipient mobile in international format, e.g., +91XXXXXXXXXX
          template_name: approved template name, e.g., "bookingreg"
          language: BCP-47 language code, e.g., "en"
          body_parameters: ordered list of body placeholders
          header_parameters: optional header placeholders
          button_parameters: optional button parameters
        """
        
        if not self.is_configured():
            return {"ok": False, "error": "Route Mobile not configured"}

        headers: Dict[str, str] = {"Content-Type": "application/json"}

        async with httpx.AsyncClient() as client:
            token = await self._get_token(client)
            if token:
                if settings.ROUTEMOBILE_AUTH_HEADER_BEARER:
                    headers["Authorization"] = f"Bearer {token}"
                else:
                    headers["Authorization"] = token

            base = settings.ROUTEMOBILE_BASE_URL.rstrip("/")
            messages_path = settings.ROUTEMOBILE_MESSAGES_PATH or "/v1/messages"
            url = f"{base}{messages_path}"

            # Build payload depending on endpoint style
            use_wba = "/wba/" in messages_path
            if use_wba:
                # Route Mobile 'wba' template payload (minimal fields)
                # For media_template, Route Mobile expects body parameters as an ARRAY OF OBJECTS
                # Correct format: [{"text": "value1"}, {"text": "value2"}, ...]
                body_params_objects = []
                if body_parameters:
                    for idx, param in enumerate(body_parameters):
                        # Ensure each parameter is a string and not empty
                        param_str = str(param).strip() if param is not None else ""
                        # Route Mobile doesn't accept empty variables - use placeholder if empty
                        if not param_str:
                            param_str = "N/A"
                        # Wrap in object format with "text" key
                        body_params_objects.append({"text": param_str})
                        logger.info(f"[ROUTEMOBILE] Body param {idx + 1}: '{param_str[:50]}' (length: {len(param_str)})")
                
                # Route Mobile requires at least one body parameter
                # If no parameters provided, send a single space as a placeholder
                if not body_params_objects:
                    logger.info(f"[ROUTEMOBILE] No body parameters provided for template {template_name}, using space placeholder")
                    body_params_objects = [{"text": " "}]
                
                logger.info(f"[ROUTEMOBILE] media_template body format: object array")
                
                # Route Mobile wba endpoint expects just 10-digit number (it adds +91 automatically)
                # Remove any + sign and country code - should be exactly 10 digits
                phone_for_payload = to_mobile.lstrip('+') if to_mobile.startswith('+') else to_mobile
                
                # Extract only digits and verify it's exactly 10 digits
                digits_only = ''.join(ch for ch in phone_for_payload if ch.isdigit())
                
                # If it has country code (starts with 91), remove it
                if len(digits_only) > 10 and digits_only.startswith('91'):
                    # Remove country code: 91XXXXXXXXXX -> XXXXXXXXXX
                    digits_only = digits_only[2:]
                
                # Verify it's exactly 10 digits
                if len(digits_only) != 10:
                    logger.error(f"[ROUTEMOBILE] ERROR: Phone number should be exactly 10 digits: {to_mobile} -> {phone_for_payload} -> {digits_only} (length: {len(digits_only)}, expected 10)")
                else:
                    logger.info(f"[ROUTEMOBILE] Phone number format: original={to_mobile}, normalized={digits_only} (Route Mobile will add +91)")
                
                # Use object array format (correct for Route Mobile media_template)
                body_format_to_use = body_params_objects
                
                payload: Dict[str, Any] = {
                    "phone": digits_only,  # Send just 10 digits - Route Mobile adds +91
                    "media": {
                        "type": "media_template",
                        "template_name": template_name,
                        "lang_code": language,
                        "body": body_format_to_use,  # Use object array format with {"text": value}
                    },
                }
                
                # Header image is pre-configured in template, don't include in payload
                # Route Mobile wba endpoint uses pre-configured template headers
                
                logger.info(f"[ROUTEMOBILE] Payload body format: object array (each element has 'text' key)")
                logger.info(f"[ROUTEMOBILE] Full payload: {payload}")
            else:
                # Generic Meta-like payload
                payload = {
                    "messaging_product": "whatsapp",
                    "to": to_mobile,
                    "type": "template",
                    "template": {
                        "name": template_name,
                        "language": {"code": language},
                        "components": [],
                    },
                }
                components: List[Dict[str, Any]] = []
                if header_parameters:
                    # For image headers, use type "image" with URL
                    # Check if first parameter is a URL (starts with http)
                    first_param = header_parameters[0] if header_parameters else ""
                    if first_param.startswith("http://") or first_param.startswith("https://"):
                        # Image header
                        components.append(
                            {
                                "type": "header",
                                "parameters": [{"type": "image", "image": {"link": first_param}}],
                            }
                        )
                    else:
                        # Text header
                        components.append(
                            {
                                "type": "header",
                                "parameters": [{"type": "text", "text": p} for p in header_parameters],
                            }
                        )
                if body_parameters:
                    components.append(
                        {
                            "type": "body",
                            "parameters": [{"type": "text", "text": p} for p in body_parameters],
                        }
                    )
                if button_parameters:
                    components.append(
                        {
                            "type": "button",
                            "sub_type": "url",
                            "index": "0",
                            "parameters": [{"type": "text", "text": p} for p in button_parameters],
                        }
                    )
                payload["template"]["components"] = components
            
            # Log the payload for debugging (especially for media_template)
            if use_wba and "media" in payload:
                body_count = len(body_params_objects) if 'body_params_objects' in locals() else len(body_parameters or [])
                logger.info(f"[ROUTEMOBILE] Sending media_template payload: template={template_name}, body_params_count={body_count}, body_format=object_array")
                logger.debug(f"[ROUTEMOBILE] Full payload: {payload}")
            
            try:
                res = await client.post(url, json=payload, headers=headers, timeout=20.0)
                # Don't raise to avoid breaking approval flow; capture response instead
                try:
                    data = res.json()
                except Exception:
                    data = {"raw": res.text}
                ok = 200 <= res.status_code < 300
                
                # Log detailed errors for debugging
                if not ok and isinstance(data, dict):
                    error_msg = str(data.get('message') or data.get('error') or data.get('detail') or data.get('utility') or '')
                    reason = data.get('reason', {})
                    
                    # Log body format error details
                    if isinstance(reason, dict) and 'media' in reason:
                        media_reason = reason.get('media', {})
                        if isinstance(media_reason, dict) and 'body' in media_reason:
                            body_reason = media_reason.get('body', {})
                            logger.error(f"[ROUTEMOBILE] Body format error: {body_reason}")
                            logger.error(f"[ROUTEMOBILE] Current body format: {payload.get('media', {}).get('body')}")
                
                if ok:
                    logger.info("[ROUTEMOBILE] Template '%s' sent to %s (phone in payload: %s)", template_name, to_mobile, digits_only if use_wba else to_mobile)
                    # For 202 ACCEPTED, the message was accepted but delivery status will come via webhook
                    # Log a note about potential delivery issues
                    if res.status_code == 202:
                        logger.info("[ROUTEMOBILE] Message accepted (202). Delivery status will be reported via webhook. "
                                  "If delivery fails, it may be due to: 1) Recipient not opted in, 2) Invalid phone number, 3) Template issues")
                else:
                    logger.warning("[ROUTEMOBILE] Send failed %s: %s", res.status_code, data)
                    # Log detailed error for debugging variable format issues
                    if isinstance(data, dict):
                        error_msg = data.get('message') or data.get('error') or data.get('detail') or data.get('utility') or str(data)
                        logger.error(f"[ROUTEMOBILE] Error message: {error_msg}")
                        if 'errors' in data:
                            logger.error(f"[ROUTEMOBILE] Validation errors: {data.get('errors')}")
                        # Log the payload that was sent for debugging
                        if use_wba and "media" in payload:
                            logger.error(f"[ROUTEMOBILE] Payload that failed: {payload}")
                
                # Check for delivery failure messages in the response
                if isinstance(data, dict):
                    delivery_status = data.get('status') or data.get('delivery_status')
                    error_message = data.get('message') or data.get('error_message') or ''
                    if 'healthy ecosystem' in error_message.lower() or 'failed to be delivered' in error_message.lower():
                        logger.warning(f"[ROUTEMOBILE] Delivery warning for {to_mobile}: {error_message}. "
                                     "This usually means: 1) Recipient hasn't opted in, 2) Phone number format issue, "
                                     "3) Template configuration issue. Check Route Mobile dashboard for details.")
                
                return {"ok": ok, "status_code": res.status_code, "data": data}
            except Exception as e:
                logger.error("[ROUTEMOBILE] HTTP error sending template: %s", e, exc_info=True)
                return {"ok": False, "error": str(e)}

    async def send_bookingreg(
        self,
        to_mobile: str,
        variables: List[str],
        template_name: Optional[str] = None,
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Helper for the 'bookingreg' template commonly used for booking status updates.
        """
        return await self.send_template(
            to_mobile=to_mobile,
            template_name=template_name or settings.ROUTEMOBILE_TEMPLATE_BOOKINGREG,
            language=language or settings.ROUTEMOBILE_TEMPLATE_LANGUAGE,
            body_parameters=variables,
        )
