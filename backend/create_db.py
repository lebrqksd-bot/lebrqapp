"""Create the lebrq database using a Python connector (no mysql CLI needed).

Usage: from the `backend` folder run:
  python create_db.py

This script uses mysql-connector-python (install with pip if needed).
"""
from app.core import settings
import mysql.connector

def main():
    print(f"Connecting to MySQL on {settings.MYSQL_HOST} as {settings.MYSQL_USER}...")
    conn = mysql.connector.connect(host=settings.MYSQL_HOST, user=settings.MYSQL_USER, password=settings.MYSQL_PASSWORD)
    cursor = conn.cursor()
    cursor.execute(
        f"CREATE DATABASE IF NOT EXISTS {settings.MYSQL_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    )
    print(f"Database '{settings.MYSQL_DB}' created or already exists.")
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
