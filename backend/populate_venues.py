#!/usr/bin/env python3
"""
Script to populate sample venue and space data
"""
import asyncio
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

import mysql.connector
from mysql.connector import Error
from scripts_db import get_mysql_connector_config, echo_config


def populate_venues():
    """Populate sample venue and space data"""
    db_config = get_mysql_connector_config()
    
    connection = None
    try:
        connection = mysql.connector.connect(**db_config)
        if connection.is_connected():
            print(f"Connected to MySQL database: {db_config['database']} @ {db_config['host']}:{db_config.get('port', 3306)}")
            
            cursor = connection.cursor()
            
            # Check if venues already exist
            cursor.execute("SELECT COUNT(*) FROM venues")
            venue_count = cursor.fetchone()[0]
            
            if venue_count > 0:
                print("Venues already exist. Skipping population.")
                return
            
            # Create main venue
            venue_data = {
                'name': 'Lebrq Event Center',
                'address': '123 Event Street, Downtown',
                'city': 'Your City',
                'timezone': 'Asia/Kolkata',
                'metadata_json': '{"description": "Premium event venue with multiple spaces", "amenities": ["Parking", "Security", "Catering", "WiFi"], "contact_phone": "+91-9876543210", "contact_email": "info@lebrq.com"}'
            }
            
            cursor.execute("""
                INSERT INTO venues (name, address, city, timezone, metadata_json, created_at, updated_at)
                VALUES (%(name)s, %(address)s, %(city)s, %(timezone)s, %(metadata_json)s, NOW(), NOW())
            """, venue_data)
            
            venue_id = cursor.lastrowid
            
            # Create Grant Hall space
            grant_hall_features = {
                "amenities": [
                    {"id": "mic", "label": "Mic", "icon": "mic-outline"},
                    {"id": "sound", "label": "Sound System", "icon": "volume-high-outline"},
                    {"id": "ac", "label": "AC", "icon": "snow-outline"},
                    {"id": "capacity", "label": "500 Seats", "icon": "people-outline"},
                    {"id": "food", "label": "Food", "icon": "restaurant-outline"},
                    {"id": "drinks", "label": "Drinks", "icon": "wine-outline"},
                    {"id": "projector", "label": "Projector", "icon": "tv-outline"}
                ],
                "images": [
                    {"url": "/static/images/grantHall.jpg", "alt": "Grant Hall Interior"}
                ],
                "description": "Large hall perfect for weddings, conferences, and major events",
                "dimensions": "50ft x 30ft",
                "lighting": "Professional stage lighting available",
                "sound": "High-quality PA system included"
            }
            
            cursor.execute("""
                INSERT INTO spaces (venue_id, name, capacity, price_per_hour, features, active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
            """, (venue_id, 'Grant Hall', 500, 1000.0, str(grant_hall_features).replace("'", '"'), True))
            
            # Create Meeting Room space
            meeting_room_features = {
                "amenities": [
                    {"id": "tv", "label": "TV/Display", "icon": "tv-outline"},
                    {"id": "wifi", "label": "Wi-Fi", "icon": "wifi-outline"},
                    {"id": "ac", "label": "AC", "icon": "snow-outline"},
                    {"id": "capacity", "label": "12 Seats", "icon": "people-outline"},
                    {"id": "drinks", "label": "Drinking Water", "icon": "water-outline"}
                ],
                "images": [
                    {"url": "/static/images/conference.jpg", "alt": "Meeting Room"}
                ],
                "description": "Compact meeting room with TV and essentials",
                "dimensions": "15ft x 12ft",
                "equipment": "Smart TV, Whiteboard, Conference table",
                "internet": "High-speed WiFi included"
            }
            
            cursor.execute("""
                INSERT INTO spaces (venue_id, name, capacity, price_per_hour, features, active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
            """, (venue_id, 'Meeting Room', 12, 1000.0, str(meeting_room_features).replace("'", '"'), True))
            
            # Create Jockey Night space
            jockey_night_features = {
                "amenities": [
                    {"id": "dance-floor", "label": "Dance Floor", "icon": "musical-notes-outline"},
                    {"id": "sound", "label": "Sound System", "icon": "volume-high-outline"},
                    {"id": "lighting", "label": "Party Lighting", "icon": "bulb-outline"},
                    {"id": "capacity", "label": "200 People", "icon": "people-outline"},
                    {"id": "bar", "label": "Bar Area", "icon": "wine-outline"}
                ],
                "images": [
                    {"url": "/static/images/jockeynight.jpg", "alt": "Jockey Night Venue"}
                ],
                "description": "Perfect for parties, DJ nights, and social events",
                "dimensions": "30ft x 25ft",
                "atmosphere": "Party lighting and sound system",
                "special_features": "Dance floor with professional lighting"
            }
            
            cursor.execute("""
                INSERT INTO spaces (venue_id, name, capacity, price_per_hour, features, active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
            """, (venue_id, 'Jockey Night', 200, 800.0, str(jockey_night_features).replace("'", '"'), True))
            
            connection.commit()
            print("Successfully populated venue and space data!")
            print(f"Created venue: Lebrq Event Center")
            print(f"Created spaces: Grant Hall, Meeting Room, Jockey Night")
            
    except Error as e:
        print(f"Error populating data: {e}")
        return False
    finally:
        if connection and connection.is_connected():
            connection.close()
    
    return True


if __name__ == "__main__":
    populate_venues()
