"""Smoke test: seed user, login, create venue+space in DB, create a booking via API.
Run from backend folder: python smoke_test.py
"""
import time
import httpx
import mysql.connector
from app.core import settings
BASE = settings.BASE_URL if hasattr(settings, 'BASE_URL') elsehttps://taxtower.in:8002/api
'
API = BASE + '/api'

# Step 1: seed dummy user
print('Seeding dummy user...')
resp = httpx.post(f'{API}/users/seed-dummy')
print('seed response:', resp.status_code, resp.text)

# Step 2: login
login_payload = {'username': 'dummy@example.com', 'password': 'secret123'}
resp = httpx.post(f'{API}/auth/login', json=login_payload)
print('login response:', resp.status_code, resp.text)
if resp.status_code != 200:
    raise SystemExit('Login failed')

token = resp.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}

# Step 3: create venue+space directly in DB
host = settings.MYSQL_HOST
user = settings.MYSQL_USER
password = settings.MYSQL_PASSWORD
db = settings.MYSQL_DB

print('Creating venue and space in DB...')
from datetime import datetime
now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
conn = mysql.connector.connect(host=host, user=user, password=password, database=db)
cur = conn.cursor()
cur.execute(
    "INSERT INTO venues (name, city, created_at, updated_at) VALUES (%s,%s,%s,%s)",
    ('Smoke Test Venue', 'TestCity', now, now),
)
venue_id = cur.lastrowid
cur.execute(
    "INSERT INTO spaces (venue_id, name, capacity, price_per_hour, active, created_at, updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
    (venue_id, 'Smoke Hall', 100, 50.0, 1, now, now),
)
space_id = cur.lastrowid
conn.commit()
cur.close()
conn.close()
print('venue_id, space_id =', venue_id, space_id)

# Step 4: create booking
from datetime import datetime, timedelta
start = datetime.utcnow() + timedelta(hours=1)
end = start + timedelta(hours=3)
payload = {
    'space_id': space_id,
    'start_datetime': start.isoformat() + 'Z',
    'end_datetime': end.isoformat() + 'Z',
    'attendees': 10,
    'items': []
}
print('Creating booking via API...')
resp = httpx.post(f'{API}/bookings', json=payload, headers=headers)
print('booking response:', resp.status_code)
print(resp.text)

if resp.status_code == 200:
    print('Smoke test booking created successfully')
else:
    print('Smoke test failed')
