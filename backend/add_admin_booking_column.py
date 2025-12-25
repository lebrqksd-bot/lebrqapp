#!/usr/bin/env python3
"""
Script to add is_admin_booking column to bookings table.

Reads DB config from environment variables (or .env) via backend/scripts_db.py
to avoid editing credentials in multiple places.
"""

import sys
import pymysql

from scripts_db import get_pymysql_config, echo_config


def main() -> int:
    cfg = get_pymysql_config()
    try:
        # Connect to database
        connection = pymysql.connect(**cfg)
        cursor = connection.cursor()

        print("Connected to database:", echo_config())

        # Check if column exists
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = %s
              AND TABLE_NAME = 'bookings'
              AND COLUMN_NAME = 'is_admin_booking'
            """,
            (cfg['database'],),
        )

        result = cursor.fetchone()
        column_exists = (result and result[0] > 0)

        if column_exists:
            print("[OK] is_admin_booking column already exists in bookings table")

            # Check a sample booking to see if is_admin_booking has values
            cursor.execute("SELECT id, is_admin_booking FROM bookings LIMIT 5")
            sample_bookings = cursor.fetchall()
            print("\nSample bookings with is_admin_booking:")
            for booking in sample_bookings:
                print(f"  ID: {booking[0]}, is_admin_booking: {booking[1]}")
        else:
            print("[INFO] is_admin_booking column does NOT exist in bookings table")
            print("Adding is_admin_booking column...")

            # Add the is_admin_booking column
            cursor.execute(
                """
                ALTER TABLE bookings
                ADD COLUMN is_admin_booking BOOLEAN DEFAULT FALSE
                AFTER event_type
                """
            )

            connection.commit()
            print("[OK] Successfully added is_admin_booking column to bookings table")

        cursor.close()
        connection.close()
        print("\nDone!")
        return 0
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
