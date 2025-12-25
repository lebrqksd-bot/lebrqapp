#!/usr/bin/env python3

import mysql.connector
from app.core import settings

# Database configuration from centralized settings
config = {
    'host': settings.MYSQL_HOST,
    'user': settings.MYSQL_USER,
    'password': settings.MYSQL_PASSWORD,
    'database': settings.MYSQL_DB,
}

try:
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor()

    # Check if event_type column exists in bookings table
    cursor.execute('DESCRIBE bookings')
    columns = cursor.fetchall()
    
    print('Columns in bookings table:')
    event_type_exists = False
    for col in columns:
        print(f'  {col[0]} - {col[1]} - {col[2]} - {col[3]} - {col[4]} - {col[5]}')
        if col[0] == 'event_type':
            event_type_exists = True
    
    if event_type_exists:
        print('\n✅ event_type column exists in bookings table')
    else:
        print('\n❌ event_type column does NOT exist in bookings table')
        print('Need to add the column:')
        print('ALTER TABLE bookings ADD COLUMN event_type VARCHAR(50) NULL AFTER booking_type;')

    cursor.close()
    conn.close()
    
except Exception as e:
    print(f'Error: {e}')
