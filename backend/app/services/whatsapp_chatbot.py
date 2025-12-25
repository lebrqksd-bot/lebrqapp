"""
WhatsApp Chatbot Service
Handles automatic replies and message processing for WhatsApp
"""

import httpx
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class WhatsAppChatbotService:
    """Service for handling WhatsApp chatbot interactions"""
    
    def __init__(self):
        self.username = "Brqglob"
        self.password = "Brg@678in"
        self.business_phone = "919745405059"  # Without + for API
        self.api_base_url = "https://routemobile.github.io/WhatsApp-Business-API"
        
        # Chatbot configuration
        self.greeting_triggers = ["hi", "hii", "hiii", "hello", "hey", "start", "hey there"]
        self.help_triggers = ["help", "support", "assist"]
        
        self.greeting_response = "Hello welcome to brq how can i help you"
        self.help_response = "I'm here to help! How can I assist you with your venue booking or event planning?"
        self.default_response = "Thank you for your message. A team member will respond shortly."
        
        # Greeting template configuration
        from app.core import settings
        self.greeting_template_name = settings.ROUTEMOBILE_TEMPLATE_greeting_menus
        self.use_greeting_template = True  # Flag to use template instead of text for greeting
        logger.info(f"[WA CHATBOT INIT] Template configured - name: {self.greeting_template_name}, use_template: {self.use_greeting_template}")
    
    async def send_message(
        self,
        to_phone: str,
        message: str,
        message_type: str = "text",
    ) -> Dict[str, Any]:
        """
        Send WhatsApp message via Route Mobile using the backend's RouteMobile sender.

        This uses the configured credentials and endpoint variants in
        app.services.route_mobile.send_session_message, which handles
        auth/token flows and payload/header differences across deployments.

        Args:
            to_phone: Recipient phone number (with or without leading '+')
            message: Message content
            message_type: Type of message (text, template, etc) – currently not used

        Returns:
            Provider response dict (or error structure if failed)
        """
        try:
            # Normalize phone number: extract digits only
            digits_only = ''.join(ch for ch in to_phone if ch.isdigit())
            
            # Route Mobile expects E.164 format with '+' prefix
            # If number already has country code (starts with 91 and is 12 digits), use as-is
            # If it's 10 digits, add country code 91
            # If it's 11+ digits but doesn't start with 91, assume it already has country code
            if len(digits_only) == 10:
                # 10-digit number, add country code (e.g., 8129104784 -> 918129104784)
                normalized = '91' + digits_only
            elif len(digits_only) >= 12 and digits_only.startswith('91'):
                # Already has country code (12+ digits starting with 91), use as-is (e.g., 918129104784)
                normalized = digits_only
            elif len(digits_only) > 10:
                # More than 10 digits but doesn't start with 91 - might have different country code
                # Use as-is
                normalized = digits_only
            else:
                # Less than 10 digits - invalid, but use as-is
                normalized = digits_only
            
            # Format as E.164 with '+' prefix for the sender
            dest = f"+{normalized}"

            # Delegate to the central Route Mobile sender used elsewhere in the app
            from app.services.route_mobile import send_session_message

            res = await send_session_message(dest, text=message)
            logger.info(f"WhatsApp message (session) sent to {dest} (normalized from: {to_phone}, digits: {digits_only})")
            return res
        except Exception as e:
            logger.error(f"Error sending WhatsApp message: {str(e)}")
            return {"error": str(e), "status": "failed"}
    
    async def detect_intent(self, message: str, session=None) -> tuple[str, Optional[str], Optional[int]]:
        """
        Detect user intent from message, checking keywords first, then quick replies
        
        Args:
            message: User message
            session: Optional database session for keyword lookup
        
        Returns:
            Tuple of (intent_type, keyword_response_id, quick_reply_id)
        """
        message_lower = message.lower().strip()
        quick_reply_id = None
        
        # Check for quick reply matches first (if session provided)
        if session:
            try:
                from app.models import WhatsAppQuickReply
                from sqlalchemy import select
                
                # Check if message is a button ID (format: "qr_123")
                if message_lower.startswith("qr_"):
                    try:
                        button_id = int(message_lower.replace("qr_", ""))
                        qr_query = select(WhatsAppQuickReply).where(
                            WhatsAppQuickReply.id == button_id,
                            WhatsAppQuickReply.deleted_at.is_(None)
                        )
                        qr_result = await session.execute(qr_query)
                        quick_reply = qr_result.scalars().first()
                        if quick_reply and quick_reply.is_active:
                            quick_reply_id = quick_reply.id
                            logger.info(f"Quick reply button clicked: {quick_reply.button_text} (id: {quick_reply.id}, type: {quick_reply.response_type})")
                            return ("quick_reply", None, quick_reply_id)
                    except (ValueError, AttributeError):
                        pass  # Not a valid button ID, continue with text matching
                
                # Check for exact match with message_text (button click or text input)
                qr_query = (
                    select(WhatsAppQuickReply)
                    .where(
                        WhatsAppQuickReply.is_active == True,
                        WhatsAppQuickReply.deleted_at.is_(None)
                    )
                    .order_by(WhatsAppQuickReply.display_order.asc())
                )
                qr_result = await session.execute(qr_query)
                quick_replies = qr_result.scalars().all()
                
                logger.info(f"[CHATBOT] Checking {len(quick_replies)} quick replies for message: '{message_lower}'")
                
                for qr in quick_replies:
                    # Check if message matches button text or message text (exact match preferred)
                    qr_message_lower = qr.message_text.lower().strip()
                    qr_button_lower = qr.button_text.lower().strip()
                    
                    logger.debug(f"[CHATBOT] Comparing '{message_lower}' with button_text='{qr_button_lower}', message_text='{qr_message_lower}'")
                    
                    # Exact matches first (most specific)
                    if (message_lower == qr_message_lower or 
                        message_lower == qr_button_lower):
                        quick_reply_id = qr.id
                        logger.info(f"[CHATBOT] Quick reply exact match: {qr.button_text} (id: {qr.id}, type: {qr.response_type})")
                        return ("quick_reply", None, quick_reply_id)
                    
                    # Partial matches (for flexibility) - check if message contains button text or vice versa
                    if (qr_message_lower in message_lower or 
                        message_lower in qr_message_lower or
                        qr_button_lower in message_lower):
                        quick_reply_id = qr.id
                        logger.info(f"[CHATBOT] Quick reply partial match: {qr.button_text} (id: {qr.id}, type: {qr.response_type})")
                        return ("quick_reply", None, quick_reply_id)
                
                logger.debug(f"[CHATBOT] No quick reply match found for message: '{message_lower}'")
            except Exception as e:
                logger.warning(f"Error checking quick replies: {e}")
        
        # Check for keyword responses (if session provided)
        if session:
            try:
                from app.models import WhatsAppKeywordResponse
                from sqlalchemy import select
                
                # Get all active keyword responses, ordered by priority (highest first)
                query = (
                    select(WhatsAppKeywordResponse)
                    .where(
                        WhatsAppKeywordResponse.is_active == True,
                        WhatsAppKeywordResponse.deleted_at.is_(None)
                    )
                    .order_by(WhatsAppKeywordResponse.priority.desc())
                )
                result = await session.execute(query)
                keyword_responses = result.scalars().all()
                
                for kw_response in keyword_responses:
                    keywords = [k.strip().lower() for k in kw_response.keywords.split(',') if k.strip()]
                    match_type = kw_response.match_type or 'contains'
                    
                    for keyword in keywords:
                        if match_type == 'exact' and message_lower == keyword:
                            return ("keyword", str(kw_response.id), None)
                        elif match_type == 'starts_with' and message_lower.startswith(keyword):
                            return ("keyword", str(kw_response.id), None)
                        elif match_type == 'ends_with' and message_lower.endswith(keyword):
                            return ("keyword", str(kw_response.id), None)
                        elif match_type == 'contains' and keyword in message_lower:
                            return ("keyword", str(kw_response.id), None)
            except Exception as e:
                logger.warning(f"Error checking keyword responses: {e}")
        
        # Check for greeting triggers
        for trigger in self.greeting_triggers:
            if trigger in message_lower:
                logger.info(f"[CHATBOT] GREETING DETECTED - Trigger matched: '{trigger}' in message '{message_lower}'")
                return ("greeting", None, None)
        
        # Check for help triggers
        if any(trigger in message_lower for trigger in self.help_triggers):
            return ("help", None, None)
        
        # Default intent
        return ("default", None, None)
    
    async def get_dynamic_response(self, response_type: str, session) -> str:
        """
        Get dynamic response based on type (price, slots, contact)
        
        Args:
            response_type: Type of dynamic response (price, slots, contact)
            session: Database session
        
        Returns:
            Dynamic response message
        """
        try:
            if response_type == "price":
                from app.models import Space
                from sqlalchemy import select
                
                query = select(Space).where(Space.active == True).order_by(Space.id.asc())
                result = await session.execute(query)
                spaces = result.scalars().all()
                
                if not spaces:
                    return "Our rate cards will be updated shortly."
                
                lines = []
                for space in spaces:
                    price = int(space.price_per_hour) if space.price_per_hour else 0
                    lines.append(f"• {space.name}: ₹{price}/hour")
                
                return "Our pricing per hour:\n" + "\n".join(lines)
            
            elif response_type == "slots":
                from app.models import Booking, Space
                from sqlalchemy import select, and_, func
                from datetime import datetime, date, timedelta
                
                today = date.today()
                tomorrow = today + timedelta(days=1)
                
                # Get today's available slots
                query = select(Booking).where(
                    and_(
                        Booking.status.in_(['pending', 'approved', 'confirmed']),
                        func.date(Booking.start_datetime) == today
                    )
                )
                result = await session.execute(query)
                today_bookings = result.scalars().all()
                
                # Get all active spaces
                space_query = select(Space).where(Space.active == True)
                space_result = await session.execute(space_query)
                spaces = space_result.scalars().all()
                
                if not spaces:
                    return "No spaces available at the moment."
                
                # Calculate available slots (simplified - shows which spaces are free)
                available_spaces = []
                for space in spaces:
                    # Check if space has bookings today
                    has_booking = any(b.space_id == space.id for b in today_bookings)
                    if not has_booking:
                        available_spaces.append(space.name)
                
                if available_spaces:
                    return f"*Available slots for today ({today.strftime('%d %b %Y')}):*\n\n" + "\n".join([f"• *{s}*" for s in available_spaces])
                else:
                    return f"*All spaces are booked for today ({today.strftime('%d %b %Y')}).*\n\nPlease check tomorrow or contact us for other dates."
            
            elif response_type == "contact":
                from app.models import Venue
                from sqlalchemy import select
                
                # Get first venue for contact info (or you can create a settings table)
                query = select(Venue).limit(1)
                result = await session.execute(query)
                venue = result.scalars().first()
                
                # Try to get contact from venue metadata or use defaults
                contact_info = []
                
                if venue and venue.metadata_json:
                    metadata = venue.metadata_json
                    if isinstance(metadata, dict):
                        phone = metadata.get('contact_phone') or metadata.get('phone')
                        email = metadata.get('contact_email') or metadata.get('email')
                        address = metadata.get('address')
                        
                        if phone:
                            contact_info.append(f"Phone: {phone}")
                        if email:
                            contact_info.append(f"Email: {email}")
                        if address:
                            contact_info.append(f"Address: {address}")
                
                # Fallback to default contact if no venue data
                if not contact_info:
                    contact_info = [
                        "Phone: +91 9745405059",
                        "Email: info@lebrq.com",
                        "Address: Please contact us for address details"
                    ]
                
                return "*Contact Details:*\n\n" + "\n".join(contact_info)
            
            return "Information not available at the moment."
            
        except Exception as e:
            logger.error(f"Error getting dynamic response: {e}")
            return "Sorry, I couldn't fetch that information right now. Please try again later."
    
    async def get_response(self, intent: str, keyword_id: Optional[str] = None, session=None, include_quick_replies: bool = False, quick_reply_id: Optional[int] = None) -> tuple[str, Optional[list[dict]]]:
        """
        Get appropriate response based on intent
        
        Args:
            intent: Detected intent
            keyword_id: Optional keyword response ID
            session: Optional database session for keyword lookup
            include_quick_replies: If True, append quick reply buttons to greeting message
            quick_reply_id: Optional quick reply ID that was clicked
        
        Returns:
            Tuple of (response message, list of button dicts or None)
            Button dict format: {"id": "button_id", "title": "Button Text"}
        """
        # Check for quick reply match first
        if quick_reply_id and session:
            try:
                from app.models import WhatsAppQuickReply
                from sqlalchemy import select
                
                query = select(WhatsAppQuickReply).where(
                    WhatsAppQuickReply.id == quick_reply_id,
                    WhatsAppQuickReply.deleted_at.is_(None)
                )
                result = await session.execute(query)
                quick_reply = result.scalars().first()
                
                if quick_reply and quick_reply.is_active:
                    logger.info(f"Processing quick reply: {quick_reply.button_text}, type: {quick_reply.response_type}")
                    # Check if it's a dynamic response
                    if quick_reply.response_type in ["price", "slots", "contact"]:
                        logger.info(f"Fetching dynamic response for type: {quick_reply.response_type}")
                        dynamic_response = await self.get_dynamic_response(quick_reply.response_type, session)
                        logger.info(f"Dynamic response fetched: {dynamic_response[:100]}...")
                        
                        # Get sub-questions if any
                        sub_query = (
                            select(WhatsAppQuickReply)
                            .where(
                                WhatsAppQuickReply.parent_id == quick_reply_id,
                                WhatsAppQuickReply.is_active == True,
                                WhatsAppQuickReply.deleted_at.is_(None)
                            )
                            .order_by(WhatsAppQuickReply.display_order.asc())
                            .limit(3)
                        )
                        sub_result = await session.execute(sub_query)
                        sub_questions = sub_result.scalars().all()
                        
                        response = dynamic_response
                        buttons = None
                        if sub_questions:
                            # Return buttons for sub-questions (max 3)
                            buttons = [
                                {"id": f"qr_{sq.id}", "title": sq.button_text[:20]}  # WhatsApp limit: 20 chars
                                for sq in sub_questions[:3]
                            ]
                        
                        return (response, buttons)
                    else:
                        # Static response with sub-questions
                        response = quick_reply.message_text
                        buttons = None
                        
                        # Get sub-questions if any
                        sub_query = (
                            select(WhatsAppQuickReply)
                            .where(
                                WhatsAppQuickReply.parent_id == quick_reply_id,
                                WhatsAppQuickReply.is_active == True,
                                WhatsAppQuickReply.deleted_at.is_(None)
                            )
                            .order_by(WhatsAppQuickReply.display_order.asc())
                            .limit(3)
                        )
                        sub_result = await session.execute(sub_query)
                        sub_questions = sub_result.scalars().all()
                        
                        buttons = None
                        if sub_questions:
                            # Return buttons for sub-questions (max 3)
                            buttons = [
                                {"id": f"qr_{sq.id}", "title": sq.button_text[:20]}  # WhatsApp limit: 20 chars
                                for sq in sub_questions[:3]
                            ]
                        
                        return (response, buttons)
            except Exception as e:
                logger.warning(f"Error getting quick reply response: {e}")
        
        # Check for keyword response
        if intent == "keyword" and keyword_id and session:
            try:
                from app.models import WhatsAppKeywordResponse
                from sqlalchemy import select
                
                query = select(WhatsAppKeywordResponse).where(
                    WhatsAppKeywordResponse.id == int(keyword_id),
                    WhatsAppKeywordResponse.deleted_at.is_(None)
                )
                result = await session.execute(query)
                kw_response = result.scalars().first()
                
                if kw_response and kw_response.is_active:
                    return (kw_response.response, None)
            except Exception as e:
                logger.warning(f"Error getting keyword response: {e}")
        
        # Fallback to standard responses
        response_map = {
            "greeting": self.greeting_response,
            "help": self.help_response,
            "default": self.default_response,
        }
        
        response = response_map.get(intent, self.default_response)
        buttons = None
        
        # Get quick reply buttons for greeting message (only top-level, no parent)
        if intent == "greeting" and include_quick_replies and session:
            try:
                from app.models import WhatsAppQuickReply
                from sqlalchemy import select
                
                query = (
                    select(WhatsAppQuickReply)
                    .where(
                        WhatsAppQuickReply.is_active == True,
                        WhatsAppQuickReply.parent_id.is_(None),  # Only top-level questions
                        WhatsAppQuickReply.deleted_at.is_(None)  # Only non-deleted records
                    )
                    .order_by(WhatsAppQuickReply.display_order.asc(), WhatsAppQuickReply.id.asc())
                    .limit(3)  # WhatsApp allows max 3 quick reply buttons
                )
                result = await session.execute(query)
                quick_replies = result.scalars().all()
                
                if quick_replies:
                    # Return buttons for interactive message
                    buttons = [
                        {"id": f"qr_{qr.id}", "title": qr.button_text[:20]}  # WhatsApp limit: 20 chars
                        for qr in quick_replies
                    ]
            except Exception as e:
                logger.warning(f"Error getting quick replies: {e}")
        
        return (response, buttons)
    
    async def process_incoming_message(
        self,
        from_phone: str,
        message: str,
        message_id: Optional[str] = None,
        timestamp: Optional[str] = None,
        raw_payload: Optional[Dict[str, Any]] = None,
        session=None
    ) -> Dict[str, Any]:
        """
        Process incoming WhatsApp message and send auto-reply
        
        Args:
            from_phone: Sender phone number
            message: Message content
            message_id: Message ID for tracking
            timestamp: Message timestamp
            raw_payload: Raw webhook payload
            session: Optional database session for keyword lookup
        
        Returns:
            Status of message processing and reply
        """
        try:
            logger.info(f"Processing message from {from_phone}: {message}")
            
            # Detect intent (with keyword and quick reply support if session provided)
            try:
                intent_result = await self.detect_intent(message, session=session)
                if intent_result and isinstance(intent_result, tuple) and len(intent_result) == 3:
                    intent, keyword_id, quick_reply_id = intent_result
                else:
                    logger.error(f"[WA CHATBOT] detect_intent returned invalid result: {intent_result}")
                    intent, keyword_id, quick_reply_id = ("default", None, None)
            except Exception as detect_error:
                logger.error(f"[WA CHATBOT] Error in detect_intent: {detect_error}", exc_info=True)
                intent, keyword_id, quick_reply_id = ("default", None, None)
            
            logger.info(f"Detected intent: {intent}, keyword_id: {keyword_id}, quick_reply_id: {quick_reply_id}")
            
            # Get response (with keyword and quick reply support if session provided)
            # Include quick replies for greeting messages
            include_quick_replies = (intent == "greeting")
            response_message, buttons = await self.get_response(
                intent, 
                keyword_id=keyword_id, 
                session=session, 
                include_quick_replies=include_quick_replies,
                quick_reply_id=quick_reply_id
            )
            
            # Don't send message here - let the router handle it
            # This prevents duplicate messages
            logger.info(f"Response prepared: {response_message}, buttons: {buttons}")
            
            # For greeting intent, indicate that template should be used
            # BUT: Never use template for button clicks (quick_reply intent) - always send text
            use_template = False
            template_name = None
            # Only use template for greeting intent, not for quick_reply (button clicks)
            if intent == "greeting" and self.use_greeting_template:
                use_template = True
                template_name = self.greeting_template_name
                logger.info(f"[WA CHATBOT] Greeting detected - use_template: {use_template}, template_name: '{template_name}', use_greeting_template flag: {self.use_greeting_template}")
                logger.info(f"[WA CHATBOT] Template will be sent with language: en_GB, body_params: ['brq']")
            else:
                logger.info(f"[WA CHATBOT] Not using template - intent: '{intent}', use_greeting_template: {self.use_greeting_template}, template_name would be: '{self.greeting_template_name}'")
            
            return {
                "status": "success",
                "from_phone": from_phone,
                "incoming_message": message,
                "detected_intent": intent,
                "keyword_id": keyword_id,
                "quick_reply_id": quick_reply_id,
                "auto_reply": response_message,
                "quick_reply_buttons": buttons,  # Include buttons in response
                "message_id": message_id,
                "timestamp": timestamp,
                "api_response": None,  # Will be set by router after sending
                "use_template": use_template,  # Flag to use template
                "template_name": template_name,  # Template name if use_template is True
            }
            
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}", exc_info=True)
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                "status": "error",
                "error": str(e),
                "from_phone": from_phone,
                "message_id": message_id,
                "detected_intent": None,
                "auto_reply": "",
                "use_template": False,
                "template_name": None,
            }


# Create singleton instance
whatsapp_chatbot = WhatsAppChatbotService()
