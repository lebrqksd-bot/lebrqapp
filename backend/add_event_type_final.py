#!/usr/bin/env python3
"""
Script to add event_type column to bookings table.
Uses centralized DB config from scripts_db (env-driven).
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
              AND COLUMN_NAME = 'event_type'
            """,
            (cfg['database'],),
        )

        result = cursor.fetchone()
        column_exists = (result and result[0] > 0)

        if column_exists:
            print("[OK] event_type column already exists in bookings table")

            # Check a sample booking to see if event_type has values
            cursor.execute("SELECT id, event_type FROM bookings LIMIT 5")
            sample_bookings = cursor.fetchall()
            print("\nSample bookings with event_type:")
            for booking in sample_bookings:
                print(f"  ID: {booking[0]}, event_type: {booking[1]}")
        else:
            print("[INFO] event_type column does NOT exist in bookings table")
            print("Adding event_type column...")

            # Add the event_type column
            cursor.execute(
                """
                ALTER TABLE bookings
                ADD COLUMN event_type VARCHAR(50) NULL
                AFTER booking_type
                """
            )

            connection.commit()
            print("[OK] Successfully added event_type column to bookings table")

        cursor.close()
        connection.close()
        print("\nDone!")
        return 0
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
