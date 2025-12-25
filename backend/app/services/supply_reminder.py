"""
Supply Reminder Service
Sends reminders to vendors 24 hours before event date for items that need to be supplied.
"""
import asyncio
import logging
import time
from datetime import datetime, timedelta, date
from typing import List, Optional
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
import os

from app.core import settings
from app.models import BookingItem, VendorProfile, Item, Booking, Venue, User
from app.services.route_mobile import send_session_message

logger = logging.getLogger(__name__)

# Create a separate engine for background tasks to avoid event loop conflicts
# This engine will be created in the background thread's event loop
_background_engine = None
_background_session_factory = None


def get_background_session_factory():
    """Get or create a session factory for background tasks with isolated engine"""
    global _background_engine, _background_session_factory
    
    # Always create a fresh engine in the current event loop
    # This ensures connections are bound to the correct event loop
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("Event loop is closed")
    except RuntimeError:
        raise RuntimeError("No active event loop for background task")
    
    # Dispose of old engine if it exists (from previous loop)
    # CRITICAL: Don't try to dispose in wrong loop - just reset references
    # The old engine will be garbage collected when its loop is closed
    if _background_engine is not None:
        # Don't try to dispose in wrong event loop - it will cause memory issues
        # Just reset the references - garbage collection will handle cleanup
        _background_engine = None
        _background_session_factory = None
    
    # Create a new engine isolated for this event loop
    # Use separate pool settings to avoid conflicts with main engine
    pool_size = int(os.getenv("DB_POOL_SIZE", "5"))  # Smaller pool for background tasks
    max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "280"))
    
    if settings.DATABASE_URL.startswith("mysql+asyncmy://"):
        _background_engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            pool_pre_ping=False,  # Disable pre-ping to avoid event loop issues
            pool_recycle=pool_recycle,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_timeout=pool_timeout,
        )
    else:
        _background_engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            pool_pre_ping=False,  # Disable pre-ping to avoid event loop issues
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_timeout=pool_timeout,
        )
    
    _background_session_factory = async_sessionmaker(
        _background_engine,
        expire_on_commit=False,
        class_=AsyncSession,
        autocommit=False,
        autoflush=False
    )
    
    return _background_session_factory


async def send_supply_reminders(session: AsyncSession) -> int:
    """
    Find and send supply reminders for items that need to be supplied 24 hours from now.
    Returns the number of reminders sent.
    Uses a separate session to avoid connection pool conflicts.
    """
    try:
        # Calculate the target date (24 hours from now)
        now = datetime.utcnow()
        target_date = (now + timedelta(hours=24)).date()
        
        # Find booking items that:
        # 1. Have a vendor assigned
        # 2. Have an event_date exactly 24 hours from now (or within the next hour)
        # 3. Are not yet supplied
        # 4. Have not had a reminder sent (or reminder was sent more than 12 hours ago)
        # 5. Are not rejected
        # 6. Booking status is not cancelled
        
        reminder_cutoff = now - timedelta(hours=12)  # Allow re-reminder after 12 hours if not supplied
        
        stmt = (
            select(BookingItem, VendorProfile, Item, Booking, Venue, User)
            .join(VendorProfile, BookingItem.vendor_id == VendorProfile.id)
            .join(Item, BookingItem.item_id == Item.id)
            .join(Booking, BookingItem.booking_id == Booking.id)
            .join(Venue, Booking.venue_id == Venue.id)
            .join(User, Booking.user_id == User.id)
            .where(
                BookingItem.vendor_id.isnot(None),
                BookingItem.event_date == target_date,
                BookingItem.is_supplied == False,  # noqa: E712
                BookingItem.rejection_status == False,  # noqa: E712
                Booking.status != 'cancelled',
                or_(
                    BookingItem.supply_reminder_sent_at.is_(None),
                    BookingItem.supply_reminder_sent_at < reminder_cutoff
                )
            )
        )
        
        # Execute query - session should be created in the same event loop
        result = await session.execute(stmt)
        items_to_remind = result.all()
        
        if not items_to_remind:
            logger.info(f"[Supply Reminder] No items need reminders for {target_date}")
            return 0
        
        # Collect all items first, then process them
        items_list = list(items_to_remind)
        reminders_sent = 0
        
        # Process items one by one with proper session handling
        for bi, vendor, item, booking, venue, customer in items_list:
            try:
                # Refresh the item to ensure we have the latest state
                try:
                    await session.refresh(bi)
                except Exception as refresh_error:
                    logger.warning(f"[Supply Reminder] Could not refresh item {bi.id}, continuing anyway: {str(refresh_error)}")
                
                # Update reminder sent timestamp
                bi.supply_reminder_sent_at = now
                
                # Commit immediately for this item to avoid connection issues
                try:
                    await session.commit()
                except Exception as commit_error:
                    logger.error(f"[Supply Reminder] Error committing reminder timestamp for item {bi.id}: {str(commit_error)}")
                    try:
                        await session.rollback()
                    except:
                        pass
                    continue  # Skip this item if we can't update the timestamp
                
                # Prepare reminder message
                event_date_str = bi.event_date.strftime('%B %d, %Y') if bi.event_date else 'TBD'
                customer_name = f"{customer.first_name} {customer.last_name}".strip() if (customer.first_name or customer.last_name) else customer.username
                
                message = f"🔔 Supply Reminder\n\n"
                message += f"Hello {vendor.company_name or vendor.username},\n\n"
                message += f"This is a reminder that you need to supply the following item:\n\n"
                message += f"• Item: {item.name}\n"
                message += f"• Quantity: {bi.quantity}\n"
                message += f"• Event Date: {event_date_str}\n"
                message += f"• Venue: {venue.name}\n"
                message += f"• Customer: {customer_name}\n"
                if booking.booking_reference:
                    message += f"• Booking Reference: {booking.booking_reference}\n"
                message += f"\n⚠️ The event is in 24 hours. Please ensure you have the items ready for delivery.\n\n"
                message += f"Thank you!"
                
                # Send WhatsApp reminder if vendor has phone
                if vendor.contact_phone:
                    phone = vendor.contact_phone.strip()
                    if not phone.startswith('+'):
                        if not phone.startswith('91'):
                            phone = '+91' + phone.lstrip('0')
                        else:
                            phone = '+' + phone
                    
                    # Send in background thread to avoid blocking
                    import threading
                    def send_reminder_thread():
                        try:
                            time.sleep(0.1)  # Small delay
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                            try:
                                loop.run_until_complete(asyncio.wait_for(
                                    send_session_message(phone, text=message),
                                    timeout=10.0
                                ))
                                logger.info(f"[Supply Reminder] Sent reminder to vendor {vendor.id} ({vendor.company_name or vendor.username})")
                            except asyncio.TimeoutError:
                                logger.warning(f"[Supply Reminder] Timeout sending reminder to vendor {vendor.id}")
                            finally:
                                loop.close()
                        except Exception as e:
                            logger.error(f"[Supply Reminder] Error sending reminder to vendor {vendor.id}: {str(e)}")
                    
                    thread = threading.Thread(target=send_reminder_thread, daemon=True)
                    thread.start()
                    reminders_sent += 1
                    logger.info(f"[Supply Reminder] Queued reminder for vendor {vendor.id}, item {bi.id}")
                else:
                    logger.warning(f"[Supply Reminder] Vendor {vendor.id} has no phone number, skipping WhatsApp reminder")
                
            except Exception as e:
                logger.error(f"[Supply Reminder] Error processing reminder for booking item {bi.id}: {str(e)}")
                try:
                    await session.rollback()
                except:
                    pass  # Ignore rollback errors
                continue
        
        logger.info(f"[Supply Reminder] Sent {reminders_sent} reminders for {target_date}")
        return reminders_sent
        
    except Exception as e:
        logger.error(f"[Supply Reminder] Error in send_supply_reminders: {str(e)}")
        import traceback
        traceback.print_exc()
        return 0


async def run_supply_reminder_check():
    """Run supply reminder check in a separate async session with timeout"""
    global _background_engine, _background_session_factory
    session = None
    try:
        # CRITICAL: Reset engine references to ensure fresh engine for this event loop
        
        # Dispose old engine if exists
        if _background_engine is not None:
            try:
                await _background_engine.dispose(close=True)
            except:
                pass
            _background_engine = None
            _background_session_factory = None
        
        # Create a fresh engine/session factory in the current event loop
        # This ensures all connections are created in the current event loop
        session_factory = get_background_session_factory()
        session = session_factory()
        
        try:
            await asyncio.wait_for(
                send_supply_reminders(session),
                timeout=240.0  # 4 minute timeout for the check itself
            )
        except asyncio.TimeoutError:
            logger.warning("[Supply Reminder] send_supply_reminders timed out")
            try:
                await session.rollback()
            except Exception as rollback_err:
                logger.warning(f"[Supply Reminder] Error during rollback: {rollback_err}")
        except RuntimeError as runtime_err:
            if "attached to a different loop" in str(runtime_err):
                logger.error(f"[Supply Reminder] Event loop mismatch detected. Recreating engine and retrying.")
                # Reset engine and create new session
                try:
                    if _background_engine:
                        await _background_engine.dispose(close=True)
                except:
                    pass
                _background_engine = None
                _background_session_factory = None
                
                # Create new session factory and session
                session_factory = get_background_session_factory()
                if session:
                    try:
                        await session.close()
                    except:
                        pass
                session = session_factory()
                
                try:
                    await asyncio.wait_for(
                        send_supply_reminders(session),
                        timeout=240.0
                    )
                except Exception as retry_err:
                    logger.error(f"[Supply Reminder] Error on retry: {retry_err}")
            else:
                logger.error(f"[Supply Reminder] Runtime error in send_supply_reminders: {runtime_err}")
                try:
                    await session.rollback()
                except:
                    pass
        except Exception as e:
            logger.error(f"[Supply Reminder] Error in send_supply_reminders: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            try:
                await session.rollback()
            except:
                pass
    except Exception as e:
        logger.error(f"[Supply Reminder] Error in run_supply_reminder_check: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        # CRITICAL: Always close the session before the event loop closes
        if session:
            try:
                await session.close()
            except Exception as close_err:
                logger.warning(f"[Supply Reminder] Error closing session: {close_err}")


def start_supply_reminder_scheduler():
    """Start a background thread that runs supply reminder checks periodically"""
    import threading
    import time
    
    def scheduler_loop():
        """Run reminder checks every hour"""
        # Wait 60 seconds after startup before first check to avoid blocking startup
        time.sleep(60)
        logger.info("[Supply Reminder] Scheduler started")
        
        while True:
            loop = None
            try:
                # CRITICAL: Create a new event loop for this thread
                # This isolates database connections from the main FastAPI event loop
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                try:
                    # Small delay to ensure loop is ready
                    loop.run_until_complete(asyncio.sleep(0.1))
                    
                    # Reset engine references to ensure new engine is created in this loop
                    # Note: global variables are module-level, no need to redeclare
                    _background_engine = None
                    _background_session_factory = None
                    
                    # Run the check with timeout
                    loop.run_until_complete(asyncio.wait_for(
                        run_supply_reminder_check(),
                        timeout=300.0  # 5 minute timeout
                    ))
                except asyncio.TimeoutError:
                    logger.warning("[Supply Reminder] Check timed out after 5 minutes")
                except Exception as e:
                    logger.error(f"[Supply Reminder] Error in scheduler loop: {str(e)}")
                    import traceback
                    logger.error(traceback.format_exc())
            except Exception as e:
                logger.error(f"[Supply Reminder] Critical error in scheduler: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
            finally:
                # CRITICAL: Clean up the event loop and all tasks before closing
                if loop:
                    try:
                        # Dispose of the background engine before closing the loop
                        # CRITICAL: Dispose synchronously in the current loop before closing
                        if _background_engine:
                            try:
                                # Ensure we dispose properly before closing the loop
                                loop.run_until_complete(asyncio.wait_for(
                                    _background_engine.dispose(close=True),
                                    timeout=5.0  # 5 second timeout for disposal
                                ))
                            except (Exception, asyncio.TimeoutError) as dispose_err:
                                logger.warning(f"[Supply Reminder] Error disposing engine: {dispose_err}")
                            finally:
                                # Always reset references
                                _background_engine = None
                                _background_session_factory = None
                        
                        # Wait a bit for any pending operations to complete
                        try:
                            loop.run_until_complete(asyncio.sleep(0.3))
                        except:
                            pass
                        
                        # Get all pending tasks
                        try:
                            pending = [task for task in asyncio.all_tasks(loop) if not task.done()]
                            
                            # Cancel all pending tasks
                            for task in pending:
                                task.cancel()
                            
                            # Wait for all tasks to complete (or be cancelled)
                            if pending:
                                loop.run_until_complete(
                                    asyncio.gather(*pending, return_exceptions=True)
                                )
                            
                            # Final cleanup wait
                            loop.run_until_complete(asyncio.sleep(0.2))
                        except (RuntimeError, AttributeError) as e:
                            # Loop might be in bad state, log and continue
                            logger.warning(f"[Supply Reminder] Could not clean up tasks: {e}")
                    except Exception as cleanup_err:
                        logger.warning(f"[Supply Reminder] Error during loop cleanup: {cleanup_err}")
                    finally:
                        try:
                            # Close the loop
                            loop.close()
                        except Exception as close_err:
                            logger.warning(f"[Supply Reminder] Error closing loop: {close_err}")
                        finally:
                            # Clear the loop reference and reset engine
                            try:
                                asyncio.set_event_loop(None)
                            except:
                                pass
                            # Reset engine references for next iteration
                            _background_engine = None
                            _background_session_factory = None
            
            # Wait 1 hour before next check
            time.sleep(3600)  # 3600 seconds = 1 hour
    
    thread = threading.Thread(target=scheduler_loop, daemon=True, name="SupplyReminderScheduler")
    thread.start()
    logger.info("[Supply Reminder] Background scheduler thread started (will begin checks in 60 seconds)")

