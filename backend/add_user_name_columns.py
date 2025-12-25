"""Simple helper to add first_name/last_name columns to users table if missing.
Run from backend folder: python add_user_name_columns.py
"""
import mysql.connector
from app.core import settings

cnx = mysql.connector.connect(host=settings.MYSQL_HOST, user=settings.MYSQL_USER, password=settings.MYSQL_PASSWORD, port=settings.MYSQL_PORT, database=settings.MYSQL_DB)
cur = cnx.cursor()

# Check columns
cur.execute("SHOW COLUMNS FROM users")
cols = [r[0] for r in cur.fetchall()]
added = []
if 'first_name' not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN first_name VARCHAR(120) NULL")
    added.append('first_name')
if 'last_name' not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN last_name VARCHAR(120) NULL")
    added.append('last_name')
if 'mobile' not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN mobile VARCHAR(32) NULL")
    added.append('mobile')

if added:
    print('Added columns:', added)
    cnx.commit()
else:
    print('No changes required')

cur.close()
cnx.close()
