"""Add series_reference column to bookings table if missing.
Run from backend folder: python add_series_reference_column.py
Env vars: MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_PORT, MYSQL_DB
"""
import mysql.connector
from app.core import settings

cnx = mysql.connector.connect(host=settings.MYSQL_HOST, user=settings.MYSQL_USER, password=settings.MYSQL_PASSWORD, port=settings.MYSQL_PORT, database=settings.MYSQL_DB)
cur = cnx.cursor()

cur.execute("SHOW COLUMNS FROM bookings")
cols = [r[0] for r in cur.fetchall()]

if 'series_reference' not in cols:
    cur.execute("ALTER TABLE bookings ADD COLUMN series_reference VARCHAR(64) NULL AFTER booking_reference")
    cnx.commit()
    print('Added column: series_reference')
else:
    print('No changes required')

cur.close()
cnx.close()


