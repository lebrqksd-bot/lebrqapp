#!/usr/bin/env python3

import mysql.connector
from scripts_db import get_mysql_connector_config, echo_config

try:
    cfg = get_mysql_connector_config()
    conn = mysql.connector.connect(**cfg)
    cursor = conn.cursor()

    # Check if event_type column exists
    cursor.execute("""
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = %s 
        AND TABLE_NAME = 'bookings' 
        AND COLUMN_NAME = 'event_type'
    """, (cfg['database'],))
    
    result = cursor.fetchone()
    
    if result:
        print('✅ event_type column exists in bookings table')
    else:
        print('❌ event_type column does NOT exist in bookings table')
        print('Adding event_type column...')
        
        # Add the event_type column
        cursor.execute("""
            ALTER TABLE bookings 
            ADD COLUMN event_type VARCHAR(50) NULL 
            AFTER booking_type
        """)
        
        conn.commit()
        print('✅ Successfully added event_type column to bookings table')

    cursor.close()
    conn.close()
    
except Exception as e:
    print(f'Error: {e}')
