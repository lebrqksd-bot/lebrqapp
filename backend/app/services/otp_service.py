"""
OTP Service for sending and verifying OTP via SMS
Optimized for async/await to prevent blocking the event loop and memory leaks.
"""
from __future__ import annotations

import random
import time
import asyncio
import logging
from typing import Dict, Optional
from urllib.parse import urlparse, quote_plus

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    # Fallback to aiohttp if httpx not available
    try:
        import aiohttp
        AIOHTTP_AVAILABLE = True
    except ImportError:
        AIOHTTP_AVAILABLE = False

from ..core import settings

logger = logging.getLogger(__name__)

# In-memory OTP storage (in production, use Redis or database)
# Format: {mobile: {"otp": "123456", "expires_at": timestamp, "verified": False}}
# CRITICAL: This storage is cleaned up automatically to prevent memory leaks
_otp_storage: Dict[str, Dict] = {}

# OTP expiry time in seconds (5 minutes)
OTP_EXPIRY_SECONDS = 300

# Cleanup expired OTPs periodically to prevent memory leaks
_last_cleanup_time = time.time()
CLEANUP_INTERVAL = 300  # Clean up every 5 minutes


def _cleanup_expired_otps():
    """Remove expired OTPs from storage to prevent memory leaks."""
    global _last_cleanup_time
    current_time = time.time()
    
    # Only cleanup every CLEANUP_INTERVAL seconds to avoid overhead
    if current_time - _last_cleanup_time < CLEANUP_INTERVAL:
        return
    
    _last_cleanup_time = current_time
    expired_keys = [
        mobile for mobile, data in _otp_storage.items()
        if current_time > data.get("expires_at", 0)
    ]
    for key in expired_keys:
        _otp_storage.pop(key, None)
    
    if expired_keys:
        logger.debug(f"[OTP] Cleaned up {len(expired_keys)} expired OTPs")


def generate_otp(length: int = 6) -> str:
    """Generate a random OTP of specified length."""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


async def send_sms_otp_async(mobile_no: str, message: str, temp_id: str) -> tuple[bool, str]:
    """
    Send SMS OTP using the provided SMS gateway credentials.
    This matches the exact format provided by the user.
    
    Args:
        mobile_no: 10-digit mobile number (without country code)
        message: OTP message to send
        temp_id: Template ID for SMS
            
    Returns:
        Tuple of (success: bool, response: str) - success indicates if SMS was sent, response contains gateway response
    """
    try:
        # SMS Gateway credentials (exact format from user's code)
        sms_username = "Br98-brqmsg"
        sms_password = "BRQglob1"
        sms_sender_id = "BRQINF"
        sms_url = "http://103.16.101.52"
        entity_id = "1601111162669580244"
        tm_id = "1601111162669580244,1602720162668444740"
        
        # Clean mobile number - extract 10 digits
        # Remove all non-digit characters first
        digits_only = ''.join(ch for ch in mobile_no if ch.isdigit())
        
        # Handle Indian numbers with country code 91
        if len(digits_only) >= 10:
            # If starts with 91 and has 12 digits, remove country code
            if len(digits_only) == 12 and digits_only.startswith('91'):
                mobile_clean = digits_only[2:]  # Remove '91' prefix
            elif len(digits_only) > 10:
                # Take last 10 digits if longer than 10
                mobile_clean = digits_only[-10:]
            else:
                mobile_clean = digits_only
        else:
            # Not enough digits
            return False, f"Invalid mobile number: Need at least 10 digits, got {len(digits_only)}"
        
        # Validate we have exactly 10 digits
        if len(mobile_clean) != 10:
            return False, f"Invalid mobile number: Expected 10 digits, got {len(mobile_clean)} (cleaned: {mobile_clean})"
        
        # Validate first digit is valid for Indian mobile numbers (6, 7, 8, or 9)
        if mobile_clean[0] not in ['6', '7', '8', '9']:
            return False, f"Invalid mobile number: Must start with 6, 7, 8, or 9 (got {mobile_clean[0]})"
        
        # Use 10-digit number (no country code prefix for destination)
        destination = mobile_clean
        
        # Parse URL
        parsed_url = urlparse(sms_url)
        hostname = parsed_url.netloc
        
        if not hostname:
            hostname = sms_url.replace('http://', '').replace('https://', '').replace('/', '')
        
        # Reduced logging - only log essential info
        # print(f"[OTP] Sending SMS to {destination} (original: {mobile_no})")
        # print(f"[OTP] Hostname: {hostname}")
        # print(f"[OTP] Message: {message}")
        # print(f"[OTP] Template ID: {temp_id}")
        
        # URL encode the message
        from urllib.parse import quote_plus
        encoded_message = quote_plus(message)
        
        # Prepare payload (exact format from user's code)
        payload = (
            f"username={sms_username}&password={sms_password}&type=0&dlr=0&"
            f"destination={destination}&source={sms_sender_id}&message={encoded_message}&"
            f"entityid={entity_id}&tempid={temp_id}&tmid={tm_id}"
        )
        
        headers = {'Content-type': 'application/x-www-form-urlencoded'}
        
        # Use async HTTP client to prevent blocking the event loop
        # Retry logic: 2 retries with exponential backoff
        max_retries = 2
        timeout_seconds = 8.0  # 8 second timeout for connection + request
        
        for attempt in range(max_retries + 1):
            try:
                # Use httpx if available (preferred), fallback to aiohttp, then sync http.client
                if HTTPX_AVAILABLE:
                    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                        full_url = f"http://{hostname}/bulksms/bulksms"
                        response = await client.post(
                            full_url,
                            content=payload,
                            headers=headers
                        )
                        result = response.text
                        status_code = response.status_code
                elif AIOHTTP_AVAILABLE:
                    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout_seconds)) as session:
                        full_url = f"http://{hostname}/bulksms/bulksms"
                        async with session.post(full_url, data=payload, headers=headers) as response:
                            result = await response.text()
                            status_code = response.status
                else:
                    # Fallback to sync http.client in thread pool (not ideal but works)
                    import http.client
                    def _sync_send():
                        conn = http.client.HTTPConnection(hostname, timeout=int(timeout_seconds))
                        try:
                            conn.request("POST", "/bulksms/bulksms", payload, headers)
                            response = conn.getresponse()
                            result = response.read().decode()
                            status_code = response.status
                            return status_code, result
                        finally:
                            conn.close()
                    
                    status_code, result = await asyncio.to_thread(_sync_send)
                
                if status_code == 200:
                    # Check for error indicators in response
                    result_lower = result.lower()
                    if any(error_word in result_lower for error_word in ['error', 'fail', 'invalid', 'rejected', 'denied']):
                        logger.warning(f"[OTP] SMS Gateway returned error: {result}")
                        if attempt < max_retries:
                            await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff
                            continue
                        return False, result
                    
                    # Check for success code (1701 or similar)
                    if '|' in result:
                        gateway_code = result.split('|')[0].strip()
                        if gateway_code == '1701' or gateway_code.startswith('17'):
                            return True, result
                    
                    # If response looks positive, assume success
                    return True, result
                else:
                    logger.warning(f"[OTP] SMS send failed: Status {status_code} - {result}")
                    if attempt < max_retries:
                        await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff
                        continue
                    return False, result
                    
            except (asyncio.TimeoutError, TimeoutError) as e:
                error_msg = f"Timeout error: {str(e)}"
                logger.warning(f"[OTP] Timeout sending SMS (attempt {attempt + 1}/{max_retries + 1}): {e}")
                if attempt < max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff
                    continue
                return False, error_msg
            except (ConnectionError, OSError) as e:
                error_msg = f"Connection error: {str(e)}"
                logger.warning(f"[OTP] Connection error sending SMS (attempt {attempt + 1}/{max_retries + 1}): {e}")
                if attempt < max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff
                    continue
                return False, error_msg
            except Exception as e:
                error_msg = f"Exception: {str(e)}"
                logger.error(f"[OTP] Error sending SMS (attempt {attempt + 1}/{max_retries + 1}): {e}")
                import traceback
                logger.error(f"[OTP] Traceback: {traceback.format_exc()}")
                if attempt < max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff
                    continue
                return False, error_msg
        
        # All retries exhausted
        return False, "All retry attempts failed"
            
    except Exception as e:
        error_msg = f"Exception: {str(e)}"
        logger.error(f"[OTP] Error in send_sms_otp_async: {e}")
        import traceback
        print(f"[OTP] Traceback: {traceback.format_exc()}")
        return False, error_msg


async def send_otp(mobile: str) -> Dict[str, any]:
    """
    Generate and send OTP to mobile number.
    
    Args:
        mobile: 10-digit mobile number (without country code)
        
    Returns:
        Dict with success status and message
    """
    try:
        # Validate input
        if not mobile or not isinstance(mobile, str):
            return {"success": False, "message": "Invalid mobile number format. Please enter a valid 10-digit mobile number."}
        
        # Normalize mobile number (extract 10 digits)
        # Remove all non-digit characters first
        digits = ''.join(ch for ch in mobile if ch.isdigit())
        
        if len(digits) >= 10:
            # Handle Indian numbers with country code 91
            if len(digits) == 12 and digits.startswith('91'):
                # Remove '91' country code
                mobile_clean = digits[2:]
            elif len(digits) > 10:
                # Take last 10 digits if longer than 10
                mobile_clean = digits[-10:]
            else:
                mobile_clean = digits
        else:
            return {"success": False, "message": f"Invalid mobile number. Need at least 10 digits, got {len(digits)}. Please enter a valid 10-digit mobile number."}
        
        # Validate we have exactly 10 digits
        if len(mobile_clean) != 10:
            return {"success": False, "message": f"Invalid mobile number format. Expected 10 digits, got {len(mobile_clean)}. Please enter a valid 10-digit mobile number."}
        
        # Validate first digit is valid for Indian mobile numbers (6, 7, 8, or 9)
        if mobile_clean[0] not in ['6', '7', '8', '9']:
            return {"success": False, "message": f"Invalid mobile number. Indian mobile numbers must start with 6, 7, 8, or 9. Got {mobile_clean[0]}"}
        
        # Generate 6-digit OTP
        otp = generate_otp(6)
        
        # Cleanup expired OTPs before storing new one (prevent memory leak)
        _cleanup_expired_otps()
        
        # Store OTP with expiry
        expires_at = time.time() + OTP_EXPIRY_SECONDS
        _otp_storage[mobile_clean] = {
            "otp": otp,
            "expires_at": expires_at,
            "verified": False,
            "attempts": 0
        }
        
        # Prepare OTP message - using the exact template format provided by user
        # Template format: "{#var#} is your SECRET One Time Password (OTP) for your {#var#}. Please use this password to complete your transaction. From:BRQ GLOB TECH"
        template_id = "1607100000000128308"
        
        # Format message according to template - first var is OTP, second var is service name
        otp_message = f"{otp} is your SECRET One Time Password (OTP) for your LeBRQ. Please use this password to complete your transaction. From:BRQ GLOB TECH"
        
        # Send SMS using async function (non-blocking)
        success, gateway_response = await send_sms_otp_async(mobile_clean, otp_message, template_id)
        
        if success:
            # Only log success briefly
            logger.info(f"[OTP] ✓ OTP sent to {mobile_clean}")
            # Parse gateway response to extract more details
            gateway_info = {"raw": gateway_response}
            if '|' in gateway_response:
                parts = gateway_response.split('|')
                if len(parts) >= 1:
                    gateway_info["code"] = parts[0].strip()
                if len(parts) >= 2 and ':' in parts[1]:
                    msg_parts = parts[1].split(':')
                    if len(msg_parts) >= 1:
                        gateway_info["mobile"] = msg_parts[0]
                    if len(msg_parts) >= 2:
                        gateway_info["request_id"] = msg_parts[1]
            
            # Check if gateway code is 1701 (request accepted but delivery not guaranteed)
            warning_msg = None
            if gateway_info.get("code") == "1701":
                warning_msg = "Gateway accepted request (1701), but SMS may not be delivered. Please verify: 1) Template ID is approved and active, 2) Message format exactly matches approved template, 3) Sender ID is approved, 4) Account has sufficient balance."
            
            response = {
                "success": True,
                "message": "OTP sent successfully to your mobile number",
                "mobile": mobile_clean,  # Return normalized mobile
                "gateway_response": gateway_response,  # Include gateway response for debugging
                "gateway_info": gateway_info  # Parsed gateway info
            }
            
            if warning_msg:
                response["warning"] = warning_msg
            
            return response
        else:
            # Remove from storage if SMS failed
            _otp_storage.pop(mobile_clean, None)
            logger.warning(f"[OTP] ✗ Failed to send OTP to {mobile_clean}: {gateway_response}")
        return {
            "success": False,
            "message": f"Failed to send OTP. Gateway response: {gateway_response}. Please check your mobile number and try again."
        }
    except Exception as e:
        # Catch any unexpected exceptions in send_otp
        import traceback
        error_msg = str(e)
        logger.error(f"[OTP] Unexpected error in send_otp for {mobile}: {error_msg}")
        logger.error(f"[OTP] Traceback: {traceback.format_exc()}")
        # Clean up any partial OTP storage
        try:
            digits = ''.join(ch for ch in mobile if ch.isdigit())
            if len(digits) >= 10:
                mobile_clean = digits[-10:] if len(digits) > 10 else digits
                _otp_storage.pop(mobile_clean, None)
        except:
            pass
        return {
            "success": False,
            "message": f"An error occurred while sending OTP: {error_msg}. Please try again."
        }


def verify_otp(mobile: str, otp: str) -> Dict[str, any]:
    """
    Verify OTP for mobile number.
    
    Args:
        mobile: 10-digit mobile number (without country code)
        otp: OTP code to verify
        
    Returns:
        Dict with success status and message
    """
    # Normalize mobile number
    digits = ''.join(ch for ch in mobile if ch.isdigit())
    if len(digits) >= 10:
        mobile_clean = digits[-10:]
    else:
        return {"success": False, "message": "Invalid mobile number."}
    
    # Check if OTP exists
    if mobile_clean not in _otp_storage:
        return {"success": False, "message": "OTP not found. Please request a new OTP."}
    
    otp_data = _otp_storage[mobile_clean]
    
    # Check if expired
    if time.time() > otp_data["expires_at"]:
        _otp_storage.pop(mobile_clean, None)
        return {"success": False, "message": "OTP has expired. Please request a new OTP."}
    
    # Check attempts (max 5 attempts)
    if otp_data["attempts"] >= 5:
        _otp_storage.pop(mobile_clean, None)
        return {"success": False, "message": "Too many failed attempts. Please request a new OTP."}
    
    # Verify OTP
    if otp_data["otp"] == otp:
        # Mark as verified
        otp_data["verified"] = True
        return {
            "success": True,
            "message": "Mobile number verified successfully",
            "mobile": mobile_clean
        }
    else:
        # Increment attempts
        otp_data["attempts"] += 1
        remaining = 5 - otp_data["attempts"]
        return {
            "success": False,
            "message": f"Invalid OTP. {remaining} attempt(s) remaining."
        }


def is_mobile_verified(mobile: str) -> bool:
    """
    Check if mobile number is verified.
    
    Args:
        mobile: 10-digit mobile number
        
    Returns:
        True if verified, False otherwise
    """
    digits = ''.join(ch for ch in mobile if ch.isdigit())
    if len(digits) >= 10:
        mobile_clean = digits[-10:]
    else:
        return False
    
    if mobile_clean in _otp_storage:
        otp_data = _otp_storage[mobile_clean]
        # Check if not expired and verified
        if time.time() <= otp_data["expires_at"] and otp_data["verified"]:
            return True
    
    return False


def clear_otp(mobile: str) -> None:
    """Clear OTP data for mobile number after successful registration."""
    digits = ''.join(ch for ch in mobile if ch.isdigit())
    if len(digits) >= 10:
        mobile_clean = digits[-10:]
        _otp_storage.pop(mobile_clean, None)

