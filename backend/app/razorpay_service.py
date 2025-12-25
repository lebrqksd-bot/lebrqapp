"""
Razorpay Payment Service - LIVE MODE

⚠️ WARNING: THIS SERVICE IS NOW RUNNING IN LIVE MODE
Real payments will be processed. Do not test with real money.

Handles Razorpay payment operations including order creation and verification
"""

import os
import hashlib
import hmac
from typing import Dict, Any, Optional
from datetime import datetime
import requests
import threading
import random

from app.core import settings

# Global cache for Razorpay credentials to prevent repeated I/O errors
_cached_key_id: Optional[str] = None
_cached_key_secret: Optional[str] = None
_cached_service: Optional['RazorpayService'] = None
_service_init_lock = None  # Will be set in __init__.py


class RazorpayService:
    """
    Service for Razorpay payment gateway integration
    
    ⚠️ LIVE MODE ENABLED - Real payments will be processed
    """

    # Razorpay API endpoint
    RAZORPAY_API_URL = "https://api.razorpay.com/v1"

    def __init__(self, key_id: Optional[str] = None, key_secret: Optional[str] = None):
        """
        Initialize with Razorpay LIVE credentials from environment or provided values
        
        ⚠️ WARNING: Only LIVE credentials are now used
        
        Args:
            key_id: Optional key ID (if provided, skips environment read)
            key_secret: Optional key secret (if provided, skips environment read)
        """
        import sys
        import traceback
        global _cached_key_id, _cached_key_secret
        
        try:
            self.mode = 'live'  # Hardcoded to live mode
            
            # Use provided credentials or get from environment/cache
            if key_id and key_secret:
                self.key_id = key_id
                self.key_secret = key_secret
                print(f"[Razorpay Init] Using provided credentials - Key ID: {self.key_id[:12]}...")
            else:
                # Try to get credentials with error handling (will use cache if available)
                try:
                    self.key_id = self._get_key_id()
                except (IOError, OSError) as e:
                    error_msg = f"Failed to read RAZORPAY_LIVE_KEY_ID: {str(e)}"
                    print(f"[Razorpay Init] I/O Error: {error_msg}")
                    print(f"[Razorpay Init] Traceback: {traceback.format_exc()}")
                    # Try to use cached credentials as last resort
                    if _cached_key_id:
                        print(f"[Razorpay Init] Using cached key_id as fallback")
                        self.key_id = _cached_key_id
                    else:
                        raise IOError(f"Unable to read Razorpay key ID from environment: {str(e)}")
                except Exception as e:
                    error_msg = f"Error reading RAZORPAY_LIVE_KEY_ID: {str(e)}"
                    print(f"[Razorpay Init] Error: {error_msg}")
                    # Try cached as fallback
                    if _cached_key_id:
                        print(f"[Razorpay Init] Using cached key_id as fallback")
                        self.key_id = _cached_key_id
                    else:
                        raise
                
                try:
                    self.key_secret = self._get_key_secret()
                except (IOError, OSError) as e:
                    error_msg = f"Failed to read RAZORPAY_LIVE_KEY_SECRET: {str(e)}"
                    print(f"[Razorpay Init] I/O Error: {error_msg}")
                    print(f"[Razorpay Init] Traceback: {traceback.format_exc()}")
                    # Try to use cached credentials as last resort
                    if _cached_key_secret:
                        print(f"[Razorpay Init] Using cached key_secret as fallback")
                        self.key_secret = _cached_key_secret
                    else:
                        raise IOError(f"Unable to read Razorpay key secret from environment: {str(e)}")
                except Exception as e:
                    error_msg = f"Error reading RAZORPAY_LIVE_KEY_SECRET: {str(e)}"
                    print(f"[Razorpay Init] Error: {error_msg}")
                    # Try cached as fallback
                    if _cached_key_secret:
                        print(f"[Razorpay Init] Using cached key_secret as fallback")
                        self.key_secret = _cached_key_secret
                    else:
                        raise
            
            # Log initialization (never log secrets)
            print(f"[Razorpay] ⚠️ Initialized in LIVE MODE - Key ID: {self.key_id[:12]}...")
            
        except (IOError, OSError) as e:
            # Re-raise I/O errors with more context
            error_msg = f"Razorpay service initialization failed due to I/O error: {str(e)}"
            print(f"[Razorpay Init] Critical I/O Error: {error_msg}")
            print(f"[Razorpay Init] This may indicate filesystem or disk issues on the server")
            raise IOError(error_msg)
        except Exception as e:
            error_msg = f"Razorpay service initialization failed: {str(e)}"
            print(f"[Razorpay Init] Unexpected Error: {error_msg}")
            print(f"[Razorpay Init] Traceback: {traceback.format_exc()}")
            raise

    def _get_mode(self) -> str:
        """Get Razorpay mode - always returns 'live'"""
        return 'live'

    def _get_key_id(self) -> str:
        """
        Get Razorpay LIVE Key ID from environment or cache
        
        ⚠️ Only LIVE credentials are used
        Uses cached credentials if available to avoid I/O errors
        """
        global _cached_key_id
        
        # Try cached first
        if _cached_key_id:
            return _cached_key_id
        
        try:
            key_id = os.getenv('RAZORPAY_LIVE_KEY_ID')
        except (IOError, OSError) as e:
            # OS-level I/O error (Errno 5 on shared hosting)
            error_code = getattr(e, 'errno', 'unknown')
            error_detail = f"Errno {error_code}: {str(e)}"
            if _cached_key_id:
                print(f"[Razorpay] WARNING: I/O error reading credentials ({error_detail}). Using cached key_id.")
                return _cached_key_id
            # Log technical detail but raise user-friendly error
            print(f"[Razorpay] ERROR: Shared hosting I/O restriction detected ({error_detail}). No cached credentials available.")
            raise IOError(f"Payment gateway configuration unavailable due to hosting restrictions. Please contact support.")
        except Exception as e:
            # Generic error accessing environment
            if _cached_key_id:
                print(f"[Razorpay] WARNING: Error reading credentials. Using cached key_id.")
                return _cached_key_id
            print(f"[Razorpay] ERROR: Unexpected error accessing RAZORPAY_LIVE_KEY_ID: {type(e).__name__}: {str(e)}")
            raise Exception(f"Payment gateway is temporarily unavailable. Please try again later.")
        
        if not key_id or not key_id.startswith('rzp_live_'):
            # Try cached value if validation fails
            if _cached_key_id and _cached_key_id.startswith('rzp_live_'):
                return _cached_key_id
            raise ValueError("⚠️ RAZORPAY_LIVE_KEY_ID must be set and start with 'rzp_live_'")
        
        # Cache the value
        _cached_key_id = key_id
        return key_id

    def _get_key_secret(self) -> str:
        """
        Get Razorpay LIVE Key Secret from environment or cache
        
        ⚠️ SECURITY: This must be stored in environment variables only
        ⚠️ NEVER commit the secret to version control
        Uses cached credentials if available to avoid I/O errors
        """
        global _cached_key_secret
        
        # Try cached first
        if _cached_key_secret:
            return _cached_key_secret
        
        try:
            key_secret = os.getenv('RAZORPAY_LIVE_KEY_SECRET')
        except (IOError, OSError) as e:
            # OS-level I/O error (Errno 5 on shared hosting)
            error_code = getattr(e, 'errno', 'unknown')
            error_detail = f"Errno {error_code}: {str(e)}"
            if _cached_key_secret:
                print(f"[Razorpay] WARNING: I/O error reading credentials ({error_detail}). Using cached key_secret.")
                return _cached_key_secret
            # Log technical detail but raise user-friendly error
            print(f"[Razorpay] ERROR: Shared hosting I/O restriction detected ({error_detail}). No cached credentials available.")
            raise IOError(f"Payment gateway configuration unavailable due to hosting restrictions. Please contact support.")
        except Exception as e:
            # Generic error accessing environment
            if _cached_key_secret:
                print(f"[Razorpay] WARNING: Error reading credentials. Using cached key_secret.")
                return _cached_key_secret
            print(f"[Razorpay] ERROR: Unexpected error accessing RAZORPAY_LIVE_KEY_SECRET: {type(e).__name__}: {str(e)}")
            raise Exception(f"Payment gateway is temporarily unavailable. Please try again later.")
        
        if not key_secret:
            # Try cached value if validation fails
            if _cached_key_secret:
                return _cached_key_secret
            raise ValueError("⚠️ RAZORPAY_LIVE_KEY_SECRET must be set in environment variables")
        
        # Cache the value
        _cached_key_secret = key_secret
        return key_secret

    def is_configured(self) -> bool:
        """Check if Razorpay is properly configured"""
        return bool(self.key_id and self.key_secret)
    
    def _get_requests_session(self) -> requests.Session:
        """Get or create a requests session with connection pooling.
        
        Connection pooling prevents creating new TCP connections for each request,
        which would exhaust system resources and cause 503 errors.
        """
        if not hasattr(self, '_session') or self._session is None:
            self._session = requests.Session()
            # Configure connection pooling with robust retries for transient errors
            try:
                from urllib3.util.retry import Retry
                retry_strategy = Retry(
                    total=3,
                    backoff_factor=0.5,
                    status_forcelist=[429, 500, 502, 503, 504],
                    allowed_methods=frozenset(["GET", "POST", "PUT", "DELETE", "PATCH"]),
                    raise_on_status=False,
                )
                adapter = requests.adapters.HTTPAdapter(
                    pool_connections=10,  # Max 10 simultaneous connections
                    pool_maxsize=10,      # Max requests per connection
                    max_retries=retry_strategy,
                )
            except Exception:
                # Fallback if urllib3 Retry is unavailable
                adapter = requests.adapters.HTTPAdapter(
                    pool_connections=10,
                    pool_maxsize=10,
                    max_retries=3,
                )
            self._session.mount('https://', adapter)
            self._session.mount('http://', adapter)
        return self._session

    def create_order(
        self,
        amount: int,  # Amount in paise (e.g., 5000 for 50 INR)
        currency: str = 'INR',
        receipt: Optional[str] = None,
        description: str = 'Booking Payment',
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a Razorpay order
        
        Args:
            amount: Amount in paise
            currency: Currency code (default: INR)
            receipt: Unique receipt ID (optional)
            description: Payment description
            notes: Additional notes/metadata
            
        Returns:
            Dictionary with order details including order_id
        """
        if not self.is_configured():
            raise ValueError(f"Razorpay not configured for {self.mode} mode")

        endpoint = f"{self.RAZORPAY_API_URL}/orders"
        
        payload = {
            'amount': amount,
            'currency': currency,
            'description': description,
        }
        
        if receipt:
            payload['receipt'] = receipt
        
        if notes:
            payload['notes'] = notes

        try:
            # Use requests session for connection pooling and resource reuse
            # This prevents creating new connections for each request
            session = self._get_requests_session()
            
            response = session.post(
                endpoint,
                json=payload,
                auth=(self.key_id, self.key_secret),
                timeout=15,  # Increased timeout
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'LebrQ-Payment-Service/1.0'
                }
            )
            response.raise_for_status()
            result = response.json()
            print(f"[Razorpay] Order created successfully: {result.get('id')}")
            return result
        except requests.exceptions.Timeout as e:
            # User-facing message
            user_msg = "Payment gateway is not responding. Please try again in a few minutes."
            # Log technical detail
            print(f"[Razorpay] ERROR: Request timeout (15s exceeded) - {str(e)}")
            raise requests.exceptions.Timeout(user_msg)
        except requests.exceptions.ConnectionError as e:
            # User-facing message
            user_msg = "Unable to connect to payment service. Please try again shortly."
            # Log technical detail
            print(f"[Razorpay] ERROR: Connection failed - {str(e)}")
            raise requests.exceptions.ConnectionError(user_msg)
        except requests.exceptions.HTTPError as e:
            # Extract error details for logging
            status_code = e.response.status_code if e.response else 'Unknown'
            error_detail = f"HTTP {status_code}"
            try:
                if e.response is not None:
                    error_json = e.response.json()
                    error_obj = error_json.get('error', {})
                    error_detail = error_obj.get('description', error_obj.get('message', str(error_json)))
            except:
                if e.response is not None and hasattr(e.response, 'text'):
                    error_detail = e.response.text[:200]  # Limit length
            # User-facing message
            user_msg = "Payment service encountered an error. Please try again or contact support."
            # Log technical detail
            print(f"[Razorpay] ERROR: HTTP error - {error_detail}")
            raise requests.exceptions.HTTPError(user_msg, response=e.response)
        except requests.exceptions.RequestException as e:
            # User-facing message
            user_msg = "Payment service is temporarily unavailable. Please try again later."
            # Log technical detail
            error_detail = str(e)
            try:
                if hasattr(e, 'response') and e.response is not None:
                    error_detail += f" - Response: {e.response.text[:200]}"
            except:
                pass
            print(f"[Razorpay] ERROR: Request failed - {error_detail}")
            raise Exception(user_msg)

    def verify_payment(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str
    ) -> bool:
        """
        Verify Razorpay payment signature
        
        Args:
            razorpay_order_id: Order ID from Razorpay
            razorpay_payment_id: Payment ID from Razorpay
            razorpay_signature: Signature from Razorpay
            
        Returns:
            True if signature is valid, False otherwise
        """
        # Prepare the data that was signed
        data = f"{razorpay_order_id}|{razorpay_payment_id}"
        
        # Create HMAC SHA256 signature
        computed_signature = hmac.new(
            self.key_secret.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Compare signatures
        return computed_signature == razorpay_signature

    def fetch_payment(self, payment_id: str) -> Dict[str, Any]:
        """
        Fetch payment details from Razorpay
        
        Args:
            payment_id: Razorpay Payment ID
            
        Returns:
            Payment details dictionary
        """
        if not self.is_configured():
            raise ValueError(f"Razorpay not configured for {self.mode} mode")

        endpoint = f"{self.RAZORPAY_API_URL}/payments/{payment_id}"
        
        try:
            response = requests.get(
                endpoint,
                auth=(self.key_id, self.key_secret),
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to fetch Razorpay payment: {str(e)}")

    def refund_payment(
        self,
        payment_id: str,
        amount: Optional[int] = None,
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Refund a Razorpay payment
        
        Args:
            payment_id: Razorpay Payment ID
            amount: Refund amount in paise (optional, full refund if not specified)
            notes: Refund notes/metadata
            
        Returns:
            Refund details dictionary
        """
        if not self.is_configured():
            raise ValueError(f"Razorpay not configured for {self.mode} mode")

        endpoint = f"{self.RAZORPAY_API_URL}/payments/{payment_id}/refund"
        
        payload = {}
        if amount is not None:
            payload['amount'] = amount
        if notes:
            payload['notes'] = notes

        try:
            response = requests.post(
                endpoint,
                json=payload,
                auth=(self.key_id, self.key_secret),
                timeout=10
            )
            
            # Get response details for better error messages
            try:
                response_json = response.json()
            except:
                response_json = None
            
            if not response.ok:
                error_msg = f"Razorpay API error: {response.status_code}"
                if response_json:
                    error_msg += f" - {response_json.get('error', {}).get('description', str(response_json))}"
                raise Exception(error_msg)
            
            return response.json()
        except requests.exceptions.RequestException as e:
            # Try to extract error details from response if available
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_json = e.response.json()
                    error_detail = error_json.get('error', {})
                    error_desc = error_detail.get('description', str(error_json))
                    raise Exception(f"Failed to refund Razorpay payment: {error_desc} (Status: {e.response.status_code})")
                except:
                    pass
            raise Exception(f"Failed to refund Razorpay payment: {str(e)}")


# Global instance and cached credentials
_razorpay_service = None
_service_lock = threading.Lock()
_cached_key_id = None
_cached_key_secret = None


def _get_cached_credentials():
    """Get cached credentials or read from environment with retry"""
    global _cached_key_id, _cached_key_secret
    import time
    
    # Return cached values if available
    if _cached_key_id and _cached_key_secret:
        return _cached_key_id, _cached_key_secret
    
    # Try to read from environment with retries
    max_retries = 5
    retry_delay = 0.3
    
    for attempt in range(max_retries):
        try:
            # Try to read credentials
            key_id = os.getenv('RAZORPAY_LIVE_KEY_ID', 'rzp_live_ReeNmC4MOSBLUo')
            key_secret = os.getenv('RAZORPAY_LIVE_KEY_SECRET', 'WFQmOtdvI7i6wbKMW3jLZHB2')
            
            # Validate
            if not key_id or not key_id.startswith('rzp_live_'):
                raise ValueError("RAZORPAY_LIVE_KEY_ID must start with 'rzp_live_'")
            if not key_secret:
                raise ValueError("RAZORPAY_LIVE_KEY_SECRET must be set")
            
            # Cache the values
            _cached_key_id = key_id
            _cached_key_secret = key_secret
            
            print(f"[Razorpay Credentials] Successfully loaded and cached on attempt {attempt + 1}")
            return key_id, key_secret
            
        except (IOError, OSError) as e:
            error_msg = str(e)
            print(f"[Razorpay Credentials] I/O error on attempt {attempt + 1}/{max_retries}: {error_msg}")
            
            if attempt < max_retries - 1:
                wait_time = retry_delay * (2 ** attempt)
                print(f"[Razorpay Credentials] Retrying in {wait_time}s...")
                time.sleep(wait_time)
                continue
            else:
                # If we have cached values, use them as fallback
                if _cached_key_id and _cached_key_secret:
                    print(f"[Razorpay Credentials] Using cached credentials due to I/O error")
                    return _cached_key_id, _cached_key_secret
                # As a last resort, return a ValueError so callers treat it as config issue not I/O
                raise ValueError(f"Failed to read Razorpay credentials after {max_retries} attempts: {error_msg}")
        except Exception as e:
            # For non-I/O errors, use cached if available
            if _cached_key_id and _cached_key_secret:
                print(f"[Razorpay Credentials] Using cached credentials due to error: {str(e)}")
                return _cached_key_id, _cached_key_secret
            raise
    
    # Fallback to defaults if all else fails
    # If still unavailable, raise a clear configuration error
    if not _cached_key_id or not _cached_key_secret:
        raise ValueError("Razorpay credentials not configured. Set RAZORPAY_LIVE_KEY_ID and RAZORPAY_LIVE_KEY_SECRET in environment.")

    return _cached_key_id, _cached_key_secret

def validate_razorpay_config() -> bool:
    """Validate that required Razorpay env vars are present and plausible."""
    key_id = os.getenv('RAZORPAY_LIVE_KEY_ID')
    key_secret = os.getenv('RAZORPAY_LIVE_KEY_SECRET')
    if not key_id or not key_secret:
        return False
    if not key_id.startswith('rzp_live_'):
        return False
    return True


def get_razorpay_service() -> RazorpayService:
    """
    Get or create Razorpay service instance with retry logic for I/O errors
    
    Retries initialization up to 3 times if I/O errors occur (which may be transient)
    Uses cached credentials to avoid repeated environment variable reads
    """
    global _razorpay_service
    import time
    
    if _razorpay_service is None:
        with _service_lock:
            if _razorpay_service is not None:
                return _razorpay_service
            max_retries = 5
            base_delay = 0.3
            
            for attempt in range(max_retries):
                try:
                    # Get credentials (with caching and retry)
                    try:
                        key_id, key_secret = _get_cached_credentials()
                        # Create service instance using cached credentials
                        service = RazorpayService(key_id=key_id, key_secret=key_secret)
                    except Exception as cred_error:
                        # If credential caching fails, try normal initialization (which will use cache internally)
                        print(f"[Razorpay Service] Credential cache failed, trying normal init: {str(cred_error)}")
                        service = RazorpayService()
                    
                    print(f"[Razorpay Service] Successfully initialized on attempt {attempt + 1}")
                    # Publish globally only after success to avoid half-initialized state
                    globals()['_razorpay_service'] = service
                    return service
                except (IOError, OSError) as e:
                    error_msg = str(e)
                    print(f"[Razorpay Service] I/O error on attempt {attempt + 1}/{max_retries}: {error_msg}")
                    
                    if attempt < max_retries - 1:
                        # Wait before retrying (exponential backoff with jitter)
                        wait_time = base_delay * (2 ** attempt) + random.uniform(0, 0.2)
                        print(f"[Razorpay Service] Retrying in {wait_time:.2f}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        # All retries exhausted
                        print(f"[Razorpay Service] Failed to initialize after {max_retries} attempts")
                        # Prefer surfacing as configuration error to avoid I/O-specific 503 on client
                        raise ValueError(f"Razorpay service initialization failed after {max_retries} attempts: {error_msg}")
                except Exception as e:
                    # For non-I/O errors, don't retry
                    print(f"[Razorpay Service] Non-retryable error during initialization: {str(e)}")
                    raise
    
    return _razorpay_service
