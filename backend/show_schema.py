"""Print CREATE TABLE for key tables in the lebrq database.
Run: python show_schema.py
"""
from app.core import settings
import mysql.connector

tables = [
    'users','vendor_profiles','venues','spaces','timeslots','items','bookings','booking_items','payments','booking_events'
]

conn = mysql.connector.connect(host=settings.MYSQL_HOST, user=settings.MYSQL_USER, password=settings.MYSQL_PASSWORD, database=settings.MYSQL_DB)
cur = conn.cursor()
for t in tables:
    try:
        cur.execute(f"SHOW CREATE TABLE `{t}`")
        row = cur.fetchone()
        if row:
            print('\n' + '='*80)
            print(f"Table: {t}\n")
            print(row[1])
        else:
            print(f"\nTable {t} does not exist")
    except Exception as e:
        print(f"\nError fetching {t}: {e}")

cur.close()
conn.close()
