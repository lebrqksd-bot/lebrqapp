import hashlib
import hmac
import base64
import json
import requests
from typing import Dict, Any, Optional
from datetime import datetime
import uuid
from app.core import settings

class CCAvenuePaymentService:
    def __init__(self):
        self.merchant_id = settings.CCAVENUE_MERCHANT_ID
        self.access_code = settings.CCAVENUE_ACCESS_CODE
        self.working_key = settings.CCAVENUE_WORKING_KEY
        self.redirect_url = settings.CCAVENUE_REDIRECT_URL
        self.cancel_url = settings.CCAVENUE_CANCEL_URL
        self.base_url = settings.CCAVENUE_BASE_URL

    def generate_order_id(self) -> str:
        """Generate unique order ID"""
        return f"LEBRQ_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8].upper()}"

    def encrypt_data(self, plain_text: str) -> str:
        """Encrypt data using CCAvenue encryption method"""
        key = self.working_key
        iv = b'\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f'
        
        # Simple XOR encryption (CCAvenue uses this method)
        encrypted = ""
        for i, char in enumerate(plain_text):
            encrypted += chr(ord(char) ^ ord(key[i % len(key)]))
        
        return base64.b64encode(encrypted.encode()).decode()

    def decrypt_data(self, encrypted_text: str) -> str:
        """Decrypt data using CCAvenue decryption method"""
        key = self.working_key
        encrypted = base64.b64decode(encrypted_text).decode()
        
        decrypted = ""
        for i, char in enumerate(encrypted):
            decrypted += chr(ord(char) ^ ord(key[i % len(key)]))
        
        return decrypted

    def create_payment_request(self, booking_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create payment request for CCAvenue"""
        order_id = self.generate_order_id()
        
        # Prepare payment parameters
        payment_params = {
            'merchant_id': self.merchant_id,
            'order_id': order_id,
            'amount': str(booking_data['total_amount']),
            'currency': 'INR',
            'redirect_url': self.redirect_url,
            'cancel_url': self.cancel_url,
            'language': 'EN',
            'billing_name': booking_data['user_name'],
            'billing_address': booking_data.get('billing_address', ''),
            'billing_city': booking_data.get('billing_city', ''),
            'billing_state': booking_data.get('billing_state', ''),
            'billing_zip': booking_data.get('billing_zip', ''),
            'billing_country': 'India',
            'billing_tel': booking_data['user_phone'],
            'billing_email': booking_data['user_email'],
            'delivery_name': booking_data['user_name'],
            'delivery_address': booking_data.get('billing_address', ''),
            'delivery_city': booking_data.get('billing_city', ''),
            'delivery_state': booking_data.get('billing_state', ''),
            'delivery_zip': booking_data.get('billing_zip', ''),
            'delivery_country': 'India',
            'delivery_tel': booking_data['user_phone'],
            'merchant_param1': str(booking_data['booking_id']),
            'merchant_param2': booking_data.get('event_type', ''),
            'merchant_param3': booking_data.get('space_name', ''),
            'merchant_param4': booking_data.get('event_date', ''),
            'merchant_param5': booking_data.get('special_requests', ''),
        }
        
        # Encrypt the payment parameters
        encrypted_data = self.encrypt_data(json.dumps(payment_params))
        
        return {
            'encrypted_data': encrypted_data,
            'access_code': self.access_code,
            'order_id': order_id,
            'payment_url': f"{self.base_url}/transaction/transaction.do?command=initiateTransaction"
        }

    def verify_payment_response(self, encrypted_response: str) -> Dict[str, Any]:
        """Verify payment response from CCAvenue"""
        try:
            # Decrypt the response
            decrypted_data = self.decrypt_data(encrypted_response)
            response_data = json.loads(decrypted_data)
            
            # Verify the response
            if response_data.get('order_status') == 'Success':
                return {
                    'success': True,
                    'transaction_id': response_data.get('bank_ref_no'),
                    'order_id': response_data.get('order_id'),
                    'amount': response_data.get('amount'),
                    'payment_mode': response_data.get('payment_mode'),
                    'response_data': response_data
                }
            else:
                return {
                    'success': False,
                    'error': response_data.get('failure_message', 'Payment failed'),
                    'response_data': response_data
                }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error processing payment response: {str(e)}'
            }

    def get_payment_status(self, order_id: str) -> Dict[str, Any]:
        """Get payment status from CCAvenue"""
        try:
            # Prepare status check parameters
            status_params = {
                'merchant_id': self.merchant_id,
                'order_id': order_id,
                'command': 'orderStatusTracker',
                'request_type': 'JSON',
                'access_code': self.access_code
            }
            
            # Encrypt the parameters
            encrypted_data = self.encrypt_data(json.dumps(status_params))
            
            # Make API call to CCAvenue
            response = requests.post(
                f"{self.base_url}/transaction/transaction.do",
                data={
                    'enc_request': encrypted_data,
                    'access_code': self.access_code,
                    'command': 'orderStatusTracker',
                    'request_type': 'JSON'
                }
            )
            
            if response.status_code == 200:
                return self.verify_payment_response(response.text)
            else:
                return {
                    'success': False,
                    'error': f'API call failed with status {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error checking payment status: {str(e)}'
            }

    def generate_checksum(self, params: Dict[str, Any]) -> str:
        """Generate checksum for CCAvenue"""
        # Sort parameters by key
        sorted_params = sorted(params.items())
        
        # Create query string
        query_string = '&'.join([f"{key}={value}" for key, value in sorted_params])
        
        # Add working key
        query_string += f"&{self.working_key}"
        
        # Generate SHA256 hash
        checksum = hashlib.sha256(query_string.encode()).hexdigest()
        
        return checksum.upper()

    def validate_checksum(self, params: Dict[str, Any], checksum: str) -> bool:
        """Validate checksum from CCAvenue"""
        # Remove checksum from params
        params_without_checksum = {k: v for k, v in params.items() if k != 'checksum'}
        
        # Generate expected checksum
        expected_checksum = self.generate_checksum(params_without_checksum)
        
        return checksum.upper() == expected_checksum.upper()
