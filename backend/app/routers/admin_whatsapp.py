"""
Admin endpoints for WhatsApp chatbot management
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, delete, case
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.auth import get_current_user
from app.models import User, WhatsAppConversation, WhatsAppMessage, WhatsAppKeywordResponse, WhatsAppQuickReply
from app.services.route_mobile import send_session_message
from app.services.whatsapp_chatbot import whatsapp_chatbot

router = APIRouter(prefix="/admin/whatsapp", tags=["admin-whatsapp"])


class KeywordResponseCreate(BaseModel):
    keywords: str
    response: str
    is_active: bool = True
    match_type: str = "contains"
    priority: int = 0


class KeywordResponseUpdate(BaseModel):
    keywords: Optional[str] = None
    response: Optional[str] = None
    is_active: Optional[bool] = None
    match_type: Optional[str] = None
    priority: Optional[int] = None


class QuickReplyCreate(BaseModel):
    button_text: str
    message_text: str
    parent_id: Optional[int] = None
    response_type: str = "static"  # static, price, slots, contact
    display_order: int = 0
    is_active: bool = True


class QuickReplyUpdate(BaseModel):
    button_text: Optional[str] = None
    message_text: Optional[str] = None
    parent_id: Optional[int] = None
    response_type: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


def admin_required(user: User = Depends(get_current_user)):
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    return user


@router.get("/health")
async def whatsapp_admin_health(admin: User = Depends(admin_required)):
    """Health check endpoint for admin WhatsApp router"""
    return {"ok": True, "message": "Admin WhatsApp router is working"}


@router.get("/conversations")
async def list_conversations(
    status: Optional[str] = Query(None, description="Filter by status: active, closed, archived"),
    search: Optional[str] = Query(None, description="Search by phone number"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """List all WhatsApp conversations with pagination"""
    try:
        # Build query
        query = select(WhatsAppConversation)
        
        # Apply filters
        if status:
            query = query.where(WhatsAppConversation.status == status)
        
        if search:
            search_term = f"%{search}%"
            query = query.where(WhatsAppConversation.phone_number.like(search_term))
        
        # Get total count
        count_query = select(func.count()).select_from(WhatsAppConversation)
        if status:
            count_query = count_query.where(WhatsAppConversation.status == status)
        if search:
            search_term = f"%{search}%"
            count_query = count_query.where(WhatsAppConversation.phone_number.like(search_term))
        
        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0
        
        # Apply pagination and ordering
        offset = (page - 1) * per_page
        query = query.order_by(desc(WhatsAppConversation.last_message_at)).offset(offset).limit(per_page)
        
        # Execute query
        result = await session.execute(query)
        conversations = result.scalars().all()
        
        # Get message counts for each conversation
        conversation_list = []
        for conv in conversations:
            # Count messages
            msg_count_query = select(func.count()).where(WhatsAppMessage.conversation_id == conv.id)
            msg_count_result = await session.execute(msg_count_query)
            message_count = msg_count_result.scalar() or 0
            
            # Get last message
            last_msg_query = (
                select(WhatsAppMessage)
                .where(WhatsAppMessage.conversation_id == conv.id)
                .order_by(desc(WhatsAppMessage.created_at))
                .limit(1)
            )
            last_msg_result = await session.execute(last_msg_query)
            last_message = last_msg_result.scalars().first()
            
            # Get user info if available
            user_info = None
            if conv.user_id:
                user_query = select(User).where(User.id == conv.user_id)
                user_result = await session.execute(user_query)
                user = user_result.scalars().first()
                if user:
                    user_info = {
                        'id': user.id,
                        'name': f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
                        'email': user.username,
                    }
            
            conversation_list.append({
                'id': conv.id,
                'phone_number': conv.phone_number,
                'user': user_info,
                'status': conv.status,
                'message_count': message_count,
                'last_message': {
                    'text': (last_message.text_content or '')[:100] if last_message else None,
                    'direction': last_message.direction if last_message else None,
                    'created_at': last_message.created_at.isoformat() if last_message else None,
                } if last_message else None,
                'last_message_at': conv.last_message_at.isoformat() if conv.last_message_at else None,
                'created_at': conv.created_at.isoformat(),
                'updated_at': conv.updated_at.isoformat(),
            })
        
        return {
            'conversations': conversation_list,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page,
        }
    except Exception as e:
        print(f"[ADMIN WHATSAPP] Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to list conversations: {str(e)}')


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Get messages for a specific conversation"""
    try:
        # Verify conversation exists
        conv_query = select(WhatsAppConversation).where(WhatsAppConversation.id == conversation_id)
        conv_result = await session.execute(conv_query)
        conversation = conv_result.scalars().first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail='Conversation not found')
        
        # Get messages with pagination
        offset = (page - 1) * per_page
        query = (
            select(WhatsAppMessage)
            .where(WhatsAppMessage.conversation_id == conversation_id)
            .order_by(desc(WhatsAppMessage.created_at))
            .offset(offset)
            .limit(per_page)
        )
        
        result = await session.execute(query)
        messages = result.scalars().all()
        
        # Get total count
        count_query = select(func.count()).where(WhatsAppMessage.conversation_id == conversation_id)
        count_result = await session.execute(count_query)
        total = count_result.scalar() or 0
        
        message_list = [
            {
                'id': msg.id,
                'direction': msg.direction,
                'text': msg.text_content or '',
                'message_id': msg.provider_message_id,
                'status': msg.status,
                'is_auto_reply': (msg.message_metadata or {}).get('auto', False),
                'keyword_id': (msg.message_metadata or {}).get('keyword_id'),
                'created_at': msg.created_at.isoformat(),
            }
            for msg in messages
        ]
        
        return {
            'conversation': {
                'id': conversation.id,
                'phone_number': conversation.phone_number,
                'status': conversation.status,
                'user_id': conversation.user_id,
            },
            'messages': message_list,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ADMIN WHATSAPP] Error getting messages: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to get messages: {str(e)}')


@router.post("/conversations/{conversation_id}/reply")
async def send_reply(
    conversation_id: int,
    message: str = Body(..., embed=True, description="Message text to send"),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Send a manual reply to a conversation"""
    try:
        # Verify conversation exists
        conv_query = select(WhatsAppConversation).where(WhatsAppConversation.id == conversation_id)
        conv_result = await session.execute(conv_query)
        conversation = conv_result.scalars().first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail='Conversation not found')
        
        # Send message via Route Mobile
        phone_number = conversation.phone_number
        # Ensure phone number has + prefix
        if not phone_number.startswith('+'):
            phone_number = f"+{phone_number}"
        
        result = await send_session_message(phone_number, text=message)
        
        # Store message in database
        db_message = WhatsAppMessage(
            conversation_id=conversation_id,
            direction='outbound',
            text_content=message,
            provider_message_id=result.get('message_id') or result.get('id'),
            status=result.get('status', 'sent'),
            message_metadata=result,
        )
        session.add(db_message)
        
        # Update conversation last_message_at
        conversation.last_message_at = datetime.utcnow()
        conversation.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(db_message)
        
        return {
            'ok': True,
            'message': {
                'id': db_message.id,
                'text': db_message.text_content,
                'direction': db_message.direction,
                'status': db_message.status,
                'created_at': db_message.created_at.isoformat(),
            },
            'provider_response': result,
        }
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        print(f"[ADMIN WHATSAPP] Error sending reply: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to send reply: {str(e)}')


@router.patch("/conversations/{conversation_id}/status")
async def update_conversation_status(
    conversation_id: int,
    status: str = Body(..., embed=True, description="New status: active, closed, archived"),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Update conversation status"""
    try:
        if status not in ['active', 'closed', 'archived']:
            raise HTTPException(status_code=400, detail='Invalid status. Must be: active, closed, or archived')
        
        conv_query = select(WhatsAppConversation).where(WhatsAppConversation.id == conversation_id)
        conv_result = await session.execute(conv_query)
        conversation = conv_result.scalars().first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail='Conversation not found')
        
        conversation.status = status
        conversation.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(conversation)
        
        return {
            'ok': True,
            'conversation': {
                'id': conversation.id,
                'status': conversation.status,
                'updated_at': conversation.updated_at.isoformat(),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        print(f"[ADMIN WHATSAPP] Error updating status: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to update status: {str(e)}')


@router.get("/chatbot/config")
async def get_chatbot_config(
    admin: User = Depends(admin_required),
):
    """Get current chatbot configuration"""
    try:
        return {
            'greeting_triggers': whatsapp_chatbot.greeting_triggers,
            'help_triggers': whatsapp_chatbot.help_triggers,
            'greeting_response': whatsapp_chatbot.greeting_response,
            'help_response': whatsapp_chatbot.help_response,
            'default_response': whatsapp_chatbot.default_response,
            'greeting_template_name': whatsapp_chatbot.greeting_template_name,
            'use_greeting_template': whatsapp_chatbot.use_greeting_template,
        }
    except Exception as e:
        print(f"[ADMIN WHATSAPP] Error getting config: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to get config: {str(e)}')


@router.put("/chatbot/config")
async def update_chatbot_config(
    config: Dict[str, Any] = Body(...),
    admin: User = Depends(admin_required),
):
    """Update chatbot configuration"""
    try:
        if 'greeting_triggers' in config:
            whatsapp_chatbot.greeting_triggers = config['greeting_triggers']
        if 'help_triggers' in config:
            whatsapp_chatbot.help_triggers = config['help_triggers']
        if 'greeting_response' in config:
            whatsapp_chatbot.greeting_response = config['greeting_response']
        if 'help_response' in config:
            whatsapp_chatbot.help_response = config['help_response']
        if 'default_response' in config:
            whatsapp_chatbot.default_response = config['default_response']
        if 'greeting_template_name' in config:
            whatsapp_chatbot.greeting_template_name = config['greeting_template_name']
        if 'use_greeting_template' in config:
            whatsapp_chatbot.use_greeting_template = config['use_greeting_template']
        
        return {
            'ok': True,
            'config': {
                'greeting_triggers': whatsapp_chatbot.greeting_triggers,
                'help_triggers': whatsapp_chatbot.help_triggers,
                'greeting_response': whatsapp_chatbot.greeting_response,
                'help_response': whatsapp_chatbot.help_response,
                'default_response': whatsapp_chatbot.default_response,
                'greeting_template_name': whatsapp_chatbot.greeting_template_name,
                'use_greeting_template': whatsapp_chatbot.use_greeting_template,
            },
        }
    except Exception as e:
        print(f"[ADMIN WHATSAPP] Error updating config: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to update config: {str(e)}')


@router.get("/keywords")
async def list_keywords(
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """List all keyword responses"""
    try:
        # Filter out soft-deleted records (deleted_at IS NULL)
        query = select(WhatsAppKeywordResponse).where(
            WhatsAppKeywordResponse.deleted_at.is_(None)
        ).order_by(
            WhatsAppKeywordResponse.priority.desc(),
            WhatsAppKeywordResponse.created_at.desc()
        )
        result = await session.execute(query)
        keywords = result.scalars().all()
        
        return {
            'keywords': [
                {
                    'id': kw.id,
                    'keywords': kw.keywords,
                    'response': kw.response,
                    'is_active': kw.is_active,
                    'match_type': kw.match_type,
                    'priority': kw.priority,
                    'created_at': kw.created_at.isoformat(),
                    'updated_at': kw.updated_at.isoformat(),
                }
                for kw in keywords
            ],
        }
    except Exception as e:
        print(f"[ADMIN WHATSAPP] Error listing keywords: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to list keywords: {str(e)}')


@router.post("/keywords", status_code=201)
async def create_keyword(
    keyword_data: KeywordResponseCreate,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Create a new keyword response"""
    print(f"[ADMIN WHATSAPP] POST /keywords called with data: {keyword_data}")
    try:
        keyword = WhatsAppKeywordResponse(
            keywords=keyword_data.keywords,
            response=keyword_data.response,
            is_active=keyword_data.is_active,
            match_type=keyword_data.match_type,
            priority=keyword_data.priority,
        )
        session.add(keyword)
        await session.commit()
        await session.refresh(keyword)
        
        print(f"[ADMIN WHATSAPP] Keyword created successfully: {keyword.id}")
        return {
            'ok': True,
            'keyword': {
                'id': keyword.id,
                'keywords': keyword.keywords,
                'response': keyword.response,
                'is_active': keyword.is_active,
                'match_type': keyword.match_type,
                'priority': keyword.priority,
                'created_at': keyword.created_at.isoformat(),
                'updated_at': keyword.updated_at.isoformat(),
            },
        }
    except Exception as e:
        await session.rollback()
        print(f"[ADMIN WHATSAPP] Error creating keyword: {e}")
        import traceback
        print(f"[ADMIN WHATSAPP] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f'Failed to create keyword: {str(e)}')


@router.put("/keywords/{keyword_id}")
async def update_keyword(
    keyword_id: int,
    keyword_data: KeywordResponseUpdate,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Update a keyword response"""
    try:
        query = select(WhatsAppKeywordResponse).where(WhatsAppKeywordResponse.id == keyword_id)
        result = await session.execute(query)
        keyword = result.scalars().first()
        
        if not keyword:
            raise HTTPException(status_code=404, detail='Keyword not found')
        
        if keyword_data.keywords is not None:
            keyword.keywords = keyword_data.keywords
        if keyword_data.response is not None:
            keyword.response = keyword_data.response
        if keyword_data.is_active is not None:
            keyword.is_active = keyword_data.is_active
        if keyword_data.match_type is not None:
            keyword.match_type = keyword_data.match_type
        if keyword_data.priority is not None:
            keyword.priority = keyword_data.priority
        
        keyword.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(keyword)
        
        return {
            'ok': True,
            'keyword': {
                'id': keyword.id,
                'keywords': keyword.keywords,
                'response': keyword.response,
                'is_active': keyword.is_active,
                'match_type': keyword.match_type,
                'priority': keyword.priority,
                'created_at': keyword.created_at.isoformat(),
                'updated_at': keyword.updated_at.isoformat(),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        print(f"[ADMIN WHATSAPP] Error updating keyword: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to update keyword: {str(e)}')


@router.delete("/keywords/{keyword_id}")
async def delete_keyword(
    keyword_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Delete a keyword response"""
    try:
        # First check if keyword exists (including deleted ones for this check)
        query = select(WhatsAppKeywordResponse).where(WhatsAppKeywordResponse.id == keyword_id)
        result = await session.execute(query)
        keyword = result.scalars().first()
        
        if not keyword:
            raise HTTPException(status_code=404, detail='Keyword not found')
        
        # Check if already deleted
        if keyword.deleted_at is not None:
            raise HTTPException(status_code=400, detail='Keyword is already deleted')
        
        print(f"[ADMIN WHATSAPP] Soft deleting keyword {keyword_id}")
        
        # Soft delete: mark as deleted instead of actually deleting
        keyword.deleted_at = datetime.utcnow()
        keyword.updated_at = datetime.utcnow()
        
        await session.flush()  # Flush to send update to database
        print(f"[ADMIN WHATSAPP] Keyword marked as deleted and flushed")
        
        # Commit the transaction
        await session.commit()
        print(f"[ADMIN WHATSAPP] Transaction committed for keyword {keyword_id}")
        
        # Verify deletion by checking if deleted_at is set
        verify_query = select(WhatsAppKeywordResponse).where(WhatsAppKeywordResponse.id == keyword_id)
        verify_result = await session.execute(verify_query)
        verify_keyword = verify_result.scalars().first()
        
        if not verify_keyword or not verify_keyword.deleted_at:
            print(f"[ADMIN WHATSAPP] WARNING: Keyword {keyword_id} deleted_at not set after deletion!")
            raise HTTPException(status_code=500, detail='Deletion failed - record not marked as deleted')
        
        print(f"[ADMIN WHATSAPP] Keyword {keyword_id} soft deleted successfully at {verify_keyword.deleted_at}")
        return {'ok': True, 'message': 'Keyword deleted successfully', 'id': keyword_id}
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        import traceback
        print(f"[ADMIN WHATSAPP] Error deleting keyword: {e}")
        print(f"[ADMIN WHATSAPP] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f'Failed to delete keyword: {str(e)}')


@router.get("/quick-replies")
async def list_quick_replies(
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """List all quick reply buttons"""
    try:
        # Order quick replies: parents first (NULL parent_id), then by display_order and id
        # Filter out soft-deleted records (deleted_at IS NULL)
        query = (
            select(WhatsAppQuickReply)
            .where(WhatsAppQuickReply.deleted_at.is_(None))  # Only get non-deleted records
            .order_by(
                case((WhatsAppQuickReply.parent_id.is_(None), 0), else_=1),  # NULL parent_id first (0 < 1)
                WhatsAppQuickReply.parent_id.asc(),
                WhatsAppQuickReply.display_order.asc(), 
                WhatsAppQuickReply.id.asc()
            )
        )
        
        result = await session.execute(query)
        quick_replies = result.scalars().all()
        
        return {
            'ok': True,
            'quick_replies': [
                {
                    'id': qr.id,
                    'button_text': qr.button_text,
                    'message_text': qr.message_text,
                    'parent_id': qr.parent_id,
                    'response_type': qr.response_type,
                    'display_order': qr.display_order,
                    'is_active': qr.is_active,
                    'created_at': qr.created_at.isoformat() if qr.created_at else None,
                    'updated_at': qr.updated_at.isoformat() if qr.updated_at else None,
                }
                for qr in quick_replies
            ],
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ADMIN WHATSAPP] Error listing quick replies: {e}")
        print(f"[ADMIN WHATSAPP] Traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f'Failed to list quick replies: {str(e)}')


@router.post("/quick-replies", status_code=201)
async def create_quick_reply(
    quick_reply_data: QuickReplyCreate,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Create a new quick reply button"""
    try:
        quick_reply = WhatsAppQuickReply(
            button_text=quick_reply_data.button_text,
            message_text=quick_reply_data.message_text,
            parent_id=quick_reply_data.parent_id,
            response_type=quick_reply_data.response_type,
            display_order=quick_reply_data.display_order,
            is_active=quick_reply_data.is_active,
        )
        session.add(quick_reply)
        await session.commit()
        await session.refresh(quick_reply)
        
        print(f"[ADMIN WHATSAPP] Quick reply created successfully: {quick_reply.id}")
        return {
            'ok': True,
            'quick_reply': {
                'id': quick_reply.id,
                'button_text': quick_reply.button_text,
                'message_text': quick_reply.message_text,
                'parent_id': quick_reply.parent_id,
                'response_type': quick_reply.response_type,
                'display_order': quick_reply.display_order,
                'is_active': quick_reply.is_active,
                'created_at': quick_reply.created_at.isoformat(),
                'updated_at': quick_reply.updated_at.isoformat(),
            },
        }
    except Exception as e:
        await session.rollback()
        import traceback
        print(f"[ADMIN WHATSAPP] Error creating quick reply: {e}")
        print(f"[ADMIN WHATSAPP] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f'Failed to create quick reply: {str(e)}')


@router.put("/quick-replies/{quick_reply_id}")
async def update_quick_reply(
    quick_reply_id: int,
    quick_reply_data: QuickReplyUpdate,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Update a quick reply button"""
    try:
        query = select(WhatsAppQuickReply).where(WhatsAppQuickReply.id == quick_reply_id)
        result = await session.execute(query)
        quick_reply = result.scalars().first()
        
        if not quick_reply:
            raise HTTPException(status_code=404, detail='Quick reply not found')
        
        if quick_reply_data.button_text is not None:
            quick_reply.button_text = quick_reply_data.button_text
        if quick_reply_data.message_text is not None:
            quick_reply.message_text = quick_reply_data.message_text
        if quick_reply_data.parent_id is not None:
            quick_reply.parent_id = quick_reply_data.parent_id
        if quick_reply_data.response_type is not None:
            quick_reply.response_type = quick_reply_data.response_type
        if quick_reply_data.display_order is not None:
            quick_reply.display_order = quick_reply_data.display_order
        if quick_reply_data.is_active is not None:
            quick_reply.is_active = quick_reply_data.is_active
        
        quick_reply.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(quick_reply)
        
        return {
            'ok': True,
            'quick_reply': {
                'id': quick_reply.id,
                'button_text': quick_reply.button_text,
                'message_text': quick_reply.message_text,
                'display_order': quick_reply.display_order,
                'is_active': quick_reply.is_active,
                'created_at': quick_reply.created_at.isoformat(),
                'updated_at': quick_reply.updated_at.isoformat(),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        print(f"[ADMIN WHATSAPP] Error updating quick reply: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to update quick reply: {str(e)}')


@router.delete("/quick-replies/{quick_reply_id}")
async def delete_quick_reply(
    quick_reply_id: int,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Delete a quick reply button (cascades to children)"""
    try:
        # First check if quick reply exists (including deleted ones for this check)
        query = select(WhatsAppQuickReply).where(WhatsAppQuickReply.id == quick_reply_id)
        result = await session.execute(query)
        quick_reply = result.scalars().first()
        
        if not quick_reply:
            raise HTTPException(status_code=404, detail='Quick reply not found')
        
        # Check if already deleted
        if quick_reply.deleted_at is not None:
            raise HTTPException(status_code=400, detail='Quick reply is already deleted')
        
        # Get children count before deletion (only non-deleted children)
        children_query = select(WhatsAppQuickReply).where(
            WhatsAppQuickReply.parent_id == quick_reply_id,
            WhatsAppQuickReply.deleted_at.is_(None)
        )
        children_result = await session.execute(children_query)
        children = children_result.scalars().all()
        children_count = len(children)
        
        print(f"[ADMIN WHATSAPP] Soft deleting quick reply {quick_reply_id} with {children_count} children")
        
        # Soft delete children (already fetched above)
        now = datetime.utcnow()
        for child in children:
            child.deleted_at = now
            child.updated_at = now
        children_deleted = len(children)
        print(f"[ADMIN WHATSAPP] Marked {children_deleted} children as deleted")
        
        # Soft delete the parent
        quick_reply.deleted_at = now
        quick_reply.updated_at = now
        print(f"[ADMIN WHATSAPP] Marked parent as deleted")
        
        # Flush to send updates to database
        await session.flush()
        print(f"[ADMIN WHATSAPP] Flushed soft delete operations")
        
        # Commit the transaction
        await session.commit()
        print(f"[ADMIN WHATSAPP] Transaction committed for quick reply {quick_reply_id}")
        
        # Verify deletion by checking if deleted_at is set
        verify_query = select(WhatsAppQuickReply).where(WhatsAppQuickReply.id == quick_reply_id)
        verify_result = await session.execute(verify_query)
        verify_quick_reply = verify_result.scalars().first()
        
        if not verify_quick_reply or not verify_quick_reply.deleted_at:
            print(f"[ADMIN WHATSAPP] WARNING: Quick reply {quick_reply_id} deleted_at not set after deletion!")
            raise HTTPException(status_code=500, detail='Deletion failed - record not marked as deleted')
        
        print(f"[ADMIN WHATSAPP] Quick reply {quick_reply_id} soft deleted successfully at {verify_quick_reply.deleted_at} (children: {children_deleted})")
        return {
            'ok': True,
            'message': 'Quick reply deleted successfully',
            'id': quick_reply_id,
            'children_deleted': children_deleted
        }
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        import traceback
        print(f"[ADMIN WHATSAPP] Error deleting quick reply: {e}")
        print(f"[ADMIN WHATSAPP] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f'Failed to delete quick reply: {str(e)}')


@router.get("/stats")
async def get_whatsapp_stats(
    days: int = Query(7, ge=1, le=365, description="Number of days to analyze"),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Get WhatsApp conversation statistics"""
    try:
        from datetime import timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Total conversations
        total_conv_query = select(func.count()).where(WhatsAppConversation.created_at >= cutoff_date)
        total_conv_result = await session.execute(total_conv_query)
        total_conversations = total_conv_result.scalar() or 0
        
        # Active conversations
        active_conv_query = select(func.count()).where(
            WhatsAppConversation.status == 'active',
            WhatsAppConversation.created_at >= cutoff_date
        )
        active_conv_result = await session.execute(active_conv_query)
        active_conversations = active_conv_result.scalar() or 0
        
        # Total messages
        total_msg_query = select(func.count()).where(WhatsAppMessage.created_at >= cutoff_date)
        total_msg_result = await session.execute(total_msg_query)
        total_messages = total_msg_result.scalar() or 0
        
        # Inbound messages
        inbound_msg_query = select(func.count()).where(
            WhatsAppMessage.direction == 'inbound',
            WhatsAppMessage.created_at >= cutoff_date
        )
        inbound_msg_result = await session.execute(inbound_msg_query)
        inbound_messages = inbound_msg_result.scalar() or 0
        
        # Outbound messages
        outbound_msg_query = select(func.count()).where(
            WhatsAppMessage.direction == 'outbound',
            WhatsAppMessage.created_at >= cutoff_date
        )
        outbound_msg_result = await session.execute(outbound_msg_query)
        outbound_messages = outbound_msg_result.scalar() or 0
        
        # Auto-replies
        auto_reply_query = select(func.count()).where(
            WhatsAppMessage.is_auto_reply == True,
            WhatsAppMessage.created_at >= cutoff_date
        )
        auto_reply_result = await session.execute(auto_reply_query)
        auto_replies = auto_reply_result.scalar() or 0
        
        return {
            'period_days': days,
            'total_conversations': total_conversations,
            'active_conversations': active_conversations,
            'total_messages': total_messages,
            'inbound_messages': inbound_messages,
            'outbound_messages': outbound_messages,
            'auto_replies': auto_replies,
            'manual_replies': outbound_messages - auto_replies,
        }
    except Exception as e:
        print(f"[ADMIN WHATSAPP] Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to get stats: {str(e)}')

