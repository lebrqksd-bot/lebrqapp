#!/usr/bin/env python3
"""
Check payments table and recent payment records
"""
import sqlite3
import json
from datetime import datetime

def check_payments():
    try:
        conn = sqlite3.connect('lebrq.db')
        cursor = conn.cursor()
        
        # Check if payments table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='payments'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            print("❌ Payments table does not exist")
            return
        
        print("✅ Payments table exists")
        
        # Count total payments
        cursor.execute('SELECT COUNT(*) FROM payments')
        total_count = cursor.fetchone()[0]
        print(f"📊 Total payments: {total_count}")
        
        # Get recent payments
        cursor.execute('''
            SELECT id, booking_id, amount, status, provider, order_id, 
                   provider_payment_id, created_at, paid_at
            FROM payments 
            ORDER BY created_at DESC 
            LIMIT 10
        ''')
        
        payments = cursor.fetchall()
        
        if payments:
            print("\n📋 Recent payments:")
            print("-" * 80)
            for payment in payments:
                pid, booking_id, amount, status, provider, order_id, payment_id, created_at, paid_at = payment
                print(f"ID: {pid}")
                print(f"  Booking ID: {booking_id}")
                print(f"  Amount: ₹{amount}")
                print(f"  Status: {status}")
                print(f"  Provider: {provider}")
                print(f"  Order ID: {order_id}")
                print(f"  Payment ID: {payment_id}")
                print(f"  Created: {created_at}")
                print(f"  Paid: {paid_at}")
                print("-" * 40)
        else:
            print("📭 No payments found")
        
        # Check payment statuses
        cursor.execute('SELECT status, COUNT(*) FROM payments GROUP BY status')
        status_counts = cursor.fetchall()
        
        if status_counts:
            print("\n📈 Payment status breakdown:")
            for status, count in status_counts:
                print(f"  {status}: {count}")
        
        # Check recent bookings
        cursor.execute('''
            SELECT id, booking_reference, status, total_amount, created_at
            FROM bookings 
            ORDER BY created_at DESC 
            LIMIT 5
        ''')
        
        bookings = cursor.fetchall()
        
        if bookings:
            print("\n🎫 Recent bookings:")
            print("-" * 60)
            for booking in bookings:
                bid, ref, status, amount, created = booking
                print(f"ID: {bid}, Ref: {ref}, Status: {status}, Amount: ₹{amount}, Created: {created}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error checking payments: {e}")

if __name__ == "__main__":
    check_payments()
