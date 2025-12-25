from typing import Any, Dict, List, Optional
from datetime import datetime
import logging

from fastapi import APIRouter, Body, HTTPException, Query, Request
import httpx
import json

from ..services.route_mobile import send_session_message
from ..services.whatsapp_route_mobile import RouteMobileWhatsAppClient
from ..core import settings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Space, WhatsAppConversation, WhatsAppMessage
from ..db import get_session
from fastapi import Depends

logger = logging.getLogger(__name__)

router = APIRouter(tags=["whatsapp"])

# Simple in-memory message store: { phone: [ {direction, text, ts, raw} ] }
_messages: Dict[str, List[Dict[str, Any]]] = {}


def _push(phone: str, direction: str, text: str, raw: Optional[Dict[str, Any]] = None) -> None:
    phone = phone.strip()
    if not phone:
        return
    lst = _messages.setdefault(phone, [])
    lst.append({
        "direction": direction,  # 'out' (from business) or 'in' (from user)
        "text": text,
        "ts": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "raw": raw or {},
    })


@router.get("/whatsapp/health")
async def api_whatsapp_health():
    """
    Lightweight health for WhatsApp router, handy for tunnel checks.
    """
    return {"ok": True, "sender": settings.ROUTEMOBILE_SENDER}


@router.post("/whatsapp/send-session")
async def api_send_session(
    to: str = Body(..., embed=True, description="Recipient phone in E.164 format, e.g., +919999999999"),
    text: Optional[str] = Body(None, embed=True),
    payload: Optional[Dict[str, Any]] = Body(None, embed=True),
):
    """
    Send a WhatsApp session message via Route Mobile.
    - Provide either simple fields (to, text) or a full payload matching your account's API schema.
    """
    try:
        res = await send_session_message(to, text=text, payload=payload)
        # Store the outbound message along with raw provider response (captures request_id/status)
        _push(to, "out", text or (payload and str(payload)) or "", raw=res)
        return {"ok": True, "provider": res}
    except Exception as e:
        # Build a rich error payload for easier troubleshooting
        detail: dict = {"error": "RouteMobile", "message": str(e)}
        # If our service raised a JSON-encoded diagnostic, include it parsed
        try:
            parsed = json.loads(str(e))
            if isinstance(parsed, dict):
                detail.update(parsed)
        except Exception:
            pass
        if isinstance(e, httpx.HTTPStatusError) and e.response is not None:
            try:
                body = e.response.json()
            except Exception:
                body = e.response.text
            detail.update({
                "status": e.response.status_code,
                "response": body,
            })
        raise HTTPException(status_code=502, detail=detail)


@router.post("/whatsapp/send-template")
async def api_send_template(
    to: str = Body(..., embed=True, description="Recipient phone in E.164 format, e.g., +919999999999"),
    template_name: Optional[str] = Body(None, embed=True, description="Approved template name. Defaults from settings."),
    language: Optional[str] = Body(None, embed=True, description="Language code, e.g., en"),
    body_parameters: Optional[List[str]] = Body(None, embed=True, description="Body placeholder values in order"),
    header_parameters: Optional[List[str]] = Body(None, embed=True),
    button_parameters: Optional[List[str]] = Body(None, embed=True),
):
    """
    Send a WhatsApp Template message via Route Mobile to initiate conversations outside the 24-hour window.

    If your account enforces template-first policies, use this before session messages.
    """
    client = RouteMobileWhatsAppClient()
    if not client.is_configured():
        raise HTTPException(status_code=400, detail={"error": "Route Mobile not configured"})
    try:
        res = await client.send_template(
            to_mobile=to,
            template_name=template_name or settings.ROUTEMOBILE_TEMPLATE_BOOKINGREG,
            language=language or settings.ROUTEMOBILE_TEMPLATE_LANGUAGE,
            body_parameters=body_parameters or [],
            header_parameters=header_parameters,
            button_parameters=button_parameters,
        )
        # Record outbound
        human_summary = f"template:{template_name or settings.ROUTEMOBILE_TEMPLATE_BOOKINGREG} "
        if body_parameters:
            human_summary += " | " + ", ".join(body_parameters)
        _push(to, "out", human_summary, raw=res)
        return res
    except Exception as e:
        detail: dict = {"error": "RouteMobile", "message": str(e)}
        raise HTTPException(status_code=502, detail=detail)


@router.post("/whatsapp/callback")
async def api_callback(req: Request, session: AsyncSession = Depends(get_session)):
    """
    Callback receiver for Route Mobile WhatsApp events.
    Use WhatsAppChatbotService to process and auto-reply to messages.
    Stores messages in database for admin management.
    """
    from app.services.whatsapp_chatbot import whatsapp_chatbot
    
    body = await req.json()
    try:
        msgs = body.get("messages") or []
        if msgs:
            m = msgs[0]
            phone = m.get("from") or m.get("source") or ""
            # Handle interactive button clicks - check for button reply
            interactive = m.get("interactive") or {}
            button_reply = interactive.get("button_reply") or {}
            button_id = button_reply.get("id") or ""
            # If button was clicked, use button ID as text; otherwise use regular text
            text = button_id or (m.get("text") or {}).get("body") or m.get("content") or ""
            message_id = m.get("message_id") or m.get("id") or ""
            
            # Log button clicks for debugging
            if button_id:
                logger.info(f"[WA CALLBACK] Button clicked - button_id: '{button_id}', extracted text: '{text}'")
                logger.info(f"[WA CALLBACK] Full interactive payload: {interactive}")
            
            if phone and text:
                # Normalize phone for storage
                phone_norm = str(phone).strip()
                # Remove + if present for consistent storage
                phone_clean = phone_norm.lstrip("+")
                
                _push(phone_norm, "in", text, raw=body)
                
                # Get or create conversation
                conv_query = select(WhatsAppConversation).where(WhatsAppConversation.phone_number == phone_clean)
                conv_result = await session.execute(conv_query)
                conversation = conv_result.scalars().first()
                
                if not conversation:
                    conversation = WhatsAppConversation(
                        phone_number=phone_clean,
                        status='active',
                        last_message_at=datetime.utcnow(),
                    )
                    session.add(conversation)
                    await session.flush()
                
                # Store inbound message
                inbound_msg = WhatsAppMessage(
                    conversation_id=conversation.id,
                    direction='inbound',
                    text_content=text,
                    provider_message_id=message_id,
                    status='delivered',
                    message_metadata=body,
                )
                session.add(inbound_msg)
                
                # Update conversation
                conversation.last_message_at = datetime.utcnow()
                conversation.updated_at = datetime.utcnow()
                
                await session.flush()
                
                # Process incoming message with chatbot service
                try:
                    # Extract just the numbers from phone for API calls
                    # phone_clean already has '+' stripped, so use it directly
                    phone_for_api = phone_clean
                    
                    result = await whatsapp_chatbot.process_incoming_message(
                        from_phone=phone_for_api,
                        message=text,
                        message_id=message_id,
                        timestamp=m.get("timestamp") or "",
                        raw_payload=body,
                        session=session
                    )
                    
                    # Check if result is None
                    if result is None:
                        logger.error(f"[WA CALLBACK] Chatbot returned None for message: '{text}' from {phone_for_api}")
                        await session.commit()
                        return {"ok": True}
                    
                    # Log button clicks and processing results
                    if button_id:
                        logger.info(f"[WA CALLBACK] Button '{button_id}' clicked, processed as text: '{text}'")
                        logger.info(f"[WA CALLBACK] Chatbot result - status: {result.get('status') if result else 'None'}, intent: {result.get('detected_intent') if result else 'None'}, quick_reply_id: {result.get('quick_reply_id') if result else 'None'}, auto_reply length: {len(result.get('auto_reply', '')) if result else 0}")
                    
                    # DIAGNOSTIC: Log what we got from chatbot service
                    logger.warning(f"[WA CALLBACK] INCOMING MESSAGE: '{text}' - Result status: {result.get('status') if result else 'NONE'}, intent: {result.get('detected_intent') if result else 'UNKNOWN'}")
                    
                    # Log the result if successful
                    logger.warning(f"[WA CALLBACK] DEBUG - result is None: {result is None}, result type: {type(result)}, result.get('status'): {result.get('status') if result else 'N/A'}")
                    logger.warning(f"[WA CALLBACK] DEBUG - Checking if status == 'success': {result.get('status') == 'success' if result else 'N/A'}")
                    
                    if result and result.get("status") == "success":
                        logger.warning(f"[WA CALLBACK] *** ENTERED SUCCESS BLOCK ***")
                        auto_reply_text = result.get("auto_reply", "")
                        
                        # Ensure we have a response to send
                        if not auto_reply_text or auto_reply_text.strip() == "":
                            logger.warning(f"[WA CALLBACK] Empty auto_reply for message '{text}', intent: {result.get('detected_intent')}, quick_reply_id: {result.get('quick_reply_id')}")
                        quick_reply_buttons = result.get("quick_reply_buttons")  # Get buttons from chatbot service
                        use_template = result.get("use_template", False)
                        template_name = result.get("template_name")
                        
                        # If greeting template should be used, send template instead of text
                        # BUT: Never use template for button clicks (quick_reply intent) - always send text
                        intent = result.get("detected_intent", "")
                        is_button_click = intent == "quick_reply" or bool(button_id)
                        
                        logger.warning(f"[WA CALLBACK] ========== TEMPLATE DECISION ==========")
                        logger.warning(f"[WA CALLBACK] Message: '{text}'")
                        logger.warning(f"[WA CALLBACK] Intent: {intent}")
                        logger.warning(f"[WA CALLBACK] use_template: {use_template}")
                        logger.warning(f"[WA CALLBACK] template_name: {template_name}")
                        logger.warning(f"[WA CALLBACK] is_button_click: {is_button_click}")
                        logger.warning(f"[WA CALLBACK] button_id: {button_id}")
                        logger.warning(f"[WA CALLBACK] Condition check: use_template={use_template} AND template_name={bool(template_name)} AND not is_button_click={not is_button_click}")
                        logger.warning(f"[WA CALLBACK] ======================================")
                        
                        # CRITICAL: For greeting intent, ALWAYS try to send template first
                        # Only send text message if template is NOT configured or if it's a button click
                        template_attempted = False
                        template_sent_successfully = False
                        
                        # FORCE template for greeting intent (unless it's a button click)
                        # This ensures template is ALWAYS sent for greetings
                        if intent == "greeting" and not is_button_click:
                            # Force template usage for greeting
                            if not template_name:
                                template_name = "greet_temp"  # Use approved template name
                                logger.warning(f"[WA CALLBACK] Template name was None, using default: {template_name}")
                            use_template = True  # Force to True for greeting
                            template_attempted = True
                            logger.warning(f"[WA CALLBACK] FORCING TEMPLATE FOR GREETING - WILL SEND TEMPLATE '{template_name}'")
                        elif use_template and template_name and not is_button_click:
                            template_attempted = True
                            logger.warning(f"[WA CALLBACK] TEMPLATE CONDITIONS MET - WILL SEND TEMPLATE")
                        else:
                            logger.warning(f"[WA CALLBACK] Template NOT being sent - use_template: {use_template}, template_name: {template_name}, is_button_click: {is_button_click}, intent: {intent}")
                            logger.warning(f"[WA CALLBACK] Will send text message instead because template conditions not met")
                        
                        # Send template if conditions are met
                        if template_attempted:
                            logger.warning(f"[WA CALLBACK] Sending greeting template '{template_name}' to {phone_for_api}")
                            try:
                                from app.services.whatsapp_route_mobile import RouteMobileWhatsAppClient
                                from app.core import settings
                                
                                client = RouteMobileWhatsAppClient()
                                
                                # Body parameter: business name (e.g., "BRQ")
                                body_params = ["BRQ"]  # You can make this configurable
                                
                                # Ensure language is en for greeting_temp
                                template_language = "en"
                                logger.warning(f"[WA CALLBACK] Using language: {template_language}")
                                
                                # Ensure we have at least one body parameter
                                if not body_params or len(body_params) == 0:
                                    logger.warning(f"[WA CALLBACK] No body parameters provided, using default 'BRQ'")
                                    body_params = ["BRQ"]
                                
                                logger.warning(f"[WA CALLBACK] Calling send_template with: template_name={template_name}, language={template_language}, body_params={body_params}")
                                
                                template_result = await client.send_template(
                                    to_mobile=phone_for_api,
                                    template_name=template_name,
                                    language=template_language,
                                    body_parameters=body_params,
                                )
                                
                                logger.warning(f"[WA CALLBACK] Template API response: {template_result}")
                                logger.warning(f"[WA CALLBACK] Template result type: {type(template_result)}, keys: {template_result.keys() if isinstance(template_result, dict) else 'not a dict'}")
                                
                                # Check for success - Route Mobile returns {"ok": True, "status_code": 200, "data": {...}}
                                is_success = False
                                if isinstance(template_result, dict):
                                    # Check multiple success indicators
                                    is_success = (
                                        template_result.get("ok") == True or
                                        template_result.get("status_code", 0) in [200, 201, 202] or
                                        template_result.get("status") == "success" or
                                        "message_id" in template_result or
                                        (template_result.get("data") and isinstance(template_result.get("data"), dict) and "message_id" in template_result.get("data"))
                                    )
                                    logger.warning(f"[WA CALLBACK] Template success check - ok: {template_result.get('ok')}, status_code: {template_result.get('status_code')}, is_success: {is_success}")
                                
                                if is_success:
                                    template_sent_successfully = True
                                    logger.info(f"[WA CHATBOT] Greeting template '{template_name}' sent successfully to {phone_for_api}")
                                    _push(phone_norm, "out", f"Template: {template_name}", raw={"auto": True, "intent": result.get("detected_intent"), "template": template_name, "api_response": template_result})
                                    
                                    # Store outbound template message
                                    outbound_msg = WhatsAppMessage(
                                        conversation_id=conversation.id,
                                        direction='outbound',
                                        text_content=f"Template: {template_name}",
                                        provider_message_id=template_result.get("data", {}).get("message_id") or template_result.get("data", {}).get("id") or template_result.get("message_id") or template_result.get("id"),
                                        status='sent',
                                        message_metadata={
                                            "auto": True,
                                            "intent": result.get("detected_intent"),
                                            "template": template_name,
                                            "api_response": template_result
                                        },
                                    )
                                    session.add(outbound_msg)
                                    conversation.last_message_at = datetime.utcnow()
                                    await session.flush()
                                    await session.commit()
                                    logger.info(f"[WA CALLBACK] Template sent and committed, returning early - NO TEXT MESSAGE WILL BE SENT")
                                    return {"ok": True}
                                else:
                                    # Template failed - log error but continue to try text as fallback
                                    error_detail = template_result.get('error') or template_result.get('data') or template_result.get('message') or template_result.get('utility') or str(template_result)
                                    logger.error(f"[WA CHATBOT] Template '{template_name}' failed: {error_detail}")
                                    logger.error(f"[WA CHATBOT] Full template_result: {template_result}")
                                    # Continue to text message as fallback
                                    logger.warning(f"[WA CHATBOT] Template failed, will send text message as fallback")
                                
                            except Exception as template_error:
                                logger.error(f"[WA CHATBOT] Exception sending greeting template: {template_error}", exc_info=True)
                                # Continue to text message as fallback
                                logger.warning(f"[WA CHATBOT] Template exception, will send text message as fallback")
                        
                        # IMPORTANT: Only send text message if template was NOT successfully sent
                        # If template was attempted and succeeded, we already returned above
                        if template_attempted and template_sent_successfully:
                            # This should never be reached, but just in case
                            logger.warning(f"[WA CALLBACK] Template was sent successfully but code continued - this should not happen")
                            await session.commit()
                            return {"ok": True}
                        
                        # If template was attempted but failed
                        if template_attempted and not template_sent_successfully:
                            # For greeting intent, do NOT send text fallback - only send template
                            if intent == "greeting":
                                logger.error(f"[WA CALLBACK] CRITICAL: Greeting template '{template_name}' failed to send. NO TEXT FALLBACK WILL BE SENT. Please check template configuration in Route Mobile. Message from {phone_for_api}: '{text}'")
                                # Store an error message in the conversation for admin visibility
                                try:
                                    error_msg = WhatsAppMessage(
                                        conversation_id=conversation.id,
                                        direction='outbound',
                                        text_content=f"[ERROR] Template '{template_name}' failed. Please check WhatsApp template configuration.",
                                        status='failed',
                                        message_metadata={"auto": True, "intent": "greeting_template_error"}
                                    )
                                    session.add(error_msg)
                                except Exception as e:
                                    logger.error(f"Failed to store error message: {e}")
                                await session.commit()
                                return {"ok": True}
                            else:
                                # For other intents with template, still send text as fallback
                                logger.warning(f"[WA CALLBACK] Template was attempted but failed, sending text message as fallback")
                        
                        # Send message with buttons if available
                        if quick_reply_buttons and len(quick_reply_buttons) > 0:
                            # Construct interactive message payload for WhatsApp
                            # Normalize phone number for Route Mobile
                            phone_digits = ''.join(ch for ch in phone_for_api if ch.isdigit())
                            if len(phone_digits) >= 12 and phone_digits.startswith('91'):
                                phone_val = phone_digits[2:]  # Remove country code
                            elif len(phone_digits) == 10:
                                phone_val = phone_digits
                            else:
                                phone_val = phone_digits
                            
                            # Construct interactive message payload
                            interactive_payload = {
                                "phone": phone_val,
                                "type": "interactive",
                                "interactive": {
                                    "type": "button",
                                    "body": {
                                        "text": auto_reply_text
                                    },
                                    "action": {
                                        "buttons": [
                                            {
                                                "type": "reply",
                                                "reply": {
                                                    "id": btn.get("id", f"btn_{idx}"),
                                                    "title": btn.get("title", "Option")[:20]  # WhatsApp limit: 20 chars
                                                }
                                            }
                                            for idx, btn in enumerate(quick_reply_buttons[:3])  # Max 3 buttons
                                        ]
                                    }
                                }
                            }
                            
                            # Try alternative payload formats for Route Mobile
                            payload_variants = [
                                interactive_payload,
                                {
                                    "to": phone_for_api,
                                    "type": "interactive",
                                    "interactive": interactive_payload["interactive"]
                                },
                                {
                                    "phone": phone_val,
                                    "message": {
                                        "type": "interactive",
                                        "interactive": interactive_payload["interactive"]
                                    }
                                }
                            ]
                            
                            # Send interactive message
                            api_response = None
                            for payload_variant in payload_variants:
                                try:
                                    from app.services.route_mobile import send_session_message
                                    api_response = await send_session_message(phone_for_api, payload=payload_variant)
                                    if api_response and not api_response.get("error"):
                                        break
                                except Exception as e:
                                    logger.warning(f"Failed to send interactive message with variant: {e}")
                                    continue
                            
                            # Fallback to text if interactive fails
                            if not api_response or api_response.get("error"):
                                logger.warning("Interactive message failed, falling back to text")
                                from app.services.route_mobile import send_session_message
                                api_response = await send_session_message(phone_for_api, text=auto_reply_text)
                            
                            _push(phone_norm, "out", auto_reply_text + " [Interactive Buttons]", raw={"auto": True, "intent": result.get("detected_intent"), "buttons": quick_reply_buttons, "api_response": api_response})
                        else:
                            # Send regular text message (always for button clicks, or when template not used)
                            if auto_reply_text and auto_reply_text.strip():
                                from app.services.route_mobile import send_session_message
                                api_response = await send_session_message(phone_for_api, text=auto_reply_text)
                                _push(phone_norm, "out", auto_reply_text, raw={"auto": True, "intent": result.get("detected_intent"), "button_click": is_button_click, "api_response": api_response})
                                logger.info(f"[WA CALLBACK] Sent text reply (length: {len(auto_reply_text)}, button_click: {is_button_click})")
                            else:
                                logger.error(f"[WA CALLBACK] Cannot send empty reply! Message: '{text}', intent: {result.get('detected_intent')}, quick_reply_id: {result.get('quick_reply_id')}, button_click: {is_button_click}")
                        
                        # Store outbound auto-reply message
                        outbound_msg = WhatsAppMessage(
                            conversation_id=conversation.id,
                            direction='outbound',
                            text_content=auto_reply_text,
                            provider_message_id=result.get("api_response", {}).get("message_id") or result.get("api_response", {}).get("id") or (api_response.get("message_id") if api_response else None) or (api_response.get("id") if api_response else None),
                            status='sent',
                            message_metadata={
                                "auto": True,
                                "intent": result.get("detected_intent"),
                                "keyword_id": result.get("keyword_id"),
                                "quick_reply_id": result.get("quick_reply_id"),
                                "quick_reply_buttons": quick_reply_buttons,
                                "api_response": api_response or result.get("api_response")
                            },
                        )
                        session.add(outbound_msg)
                        conversation.last_message_at = datetime.utcnow()
                        
                        print(f"[WA CHATBOT] Auto-reply sent. Intent: {result.get('detected_intent') if result else 'None'}, Buttons: {len(quick_reply_buttons) if quick_reply_buttons else 0}")
                    else:
                        error_msg = result.get('error') if result else 'Result is None'
                        print(f"[WA CHATBOT] Failed to send reply: {error_msg}")
                        logger.error(f"[WA CALLBACK] Chatbot processing failed - result: {result}")
                        
                except Exception as e:
                    print(f"[WA CHATBOT] Error processing message: {e}")
                    # Fallback: try simple greeting if trigger matches
                    try:
                        tnorm = str(text).strip().lower()
                        if tnorm in {"hi", "hii", "hello", "hey"}:
                            phone_for_api = phone_clean if not phone_clean.startswith("+") else phone_clean[1:]
                            res = await send_session_message(phone_for_api, text="Hello welcome to brq how can i help you")
                            _push(phone_norm, "out", "Hello welcome to brq how can i help you", raw={"auto": True, "provider": res})
                            
                            # Store fallback reply
                            fallback_msg = WhatsAppMessage(
                                conversation_id=conversation.id,
                                direction='outbound',
                                text_content="Hello welcome to brq how can i help you",
                                provider_message_id=res.get("message_id") or res.get("id"),
                                status='sent',
                                message_metadata={"auto": True, "fallback": True, "provider": res},
                            )
                            session.add(fallback_msg)
                            conversation.last_message_at = datetime.utcnow()
                    except Exception as fallback_e:
                        print(f"[WA AUTO-REPLY] Fallback failed: {fallback_e}")
                
                await session.commit()
                        
    except Exception as e:
        await session.rollback()
        print(f"[WA CALLBACK] Error: {e}")
        _push("unknown", "in", "", raw=body)
    
    return {"ok": True}


@router.get("/whatsapp/messages")
async def api_get_messages(phone: str = Query(..., description="Phone in E.164 format")):
    """
    Return transcript for a phone. To reduce key mismatches (with/without '+'),
    we merge both variants.
    """
    key_raw = (phone or '').strip()
    key_noplus = key_raw.lstrip('+')
    key_plus = ('+' + key_noplus) if not key_raw.startswith('+') else key_raw

    merged: List[Dict[str, Any]] = []
    seen = set()
    for k in {key_raw, key_noplus, key_plus}:
        lst = _messages.get(k, [])
        for m in lst:
            # Deduplicate by direction|text|ts
            sig = f"{m.get('direction','')}|{m.get('text','')}|{m.get('ts','')}"
            if sig in seen:
                continue
            seen.add(sig)
            merged.append(m)
    # Sort by timestamp if present
    try:
        merged.sort(key=lambda x: x.get('ts',''))
    except Exception:
        pass
    return {"phone": phone, "messages": merged}
