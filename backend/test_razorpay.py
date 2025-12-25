#!/usr/bin/env python
"""
Test script for Razorpay service
"""

import sys
sys.path.insert(0, '/home/app')

from app.razorpay_service import get_razorpay_service

def test_razorpay_service():
    print("Testing Razorpay Service...")
    
    service = get_razorpay_service()
    
    print(f"Mode: {service.mode}")
    print(f"Key ID: {service.key_id[:20]}...")
    print(f"Is Configured: {service.is_configured()}")
    
    if not service.is_configured():
        print("ERROR: Razorpay not configured!")
        return False
    
    try:
        print("\nTesting order creation...")
        order = service.create_order(
            amount=50000,  # 500 INR in paise
            currency='INR',
            receipt='test_order_001',
            description='Test Payment',
            notes={'test': True}
        )
        print(f"Order created: {order}")
        print(f"Order ID: {order.get('id')}")
        return True
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

if __name__ == '__main__':
    success = test_razorpay_service()
    sys.exit(0 if success else 1)
