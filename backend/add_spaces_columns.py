#!/usr/bin/env python3
"""
Add required columns to spaces table for dynamic venue pages
"""
import asyncio
import json
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
def get_database_url() -> str:
    return os.environ.get("DB_URL") or os.environ.get("DATABASE_URL") or "sqlite+aiosqlite:///./lebrq.db"

async def add_spaces_columns():
    """Add new columns to spaces table"""
    url = get_database_url()
    print('Using DATABASE_URL:', url)
    engine = create_async_engine(url, echo=True)
    
    async with engine.begin() as conn:
        # Add new columns to spaces table
        columns_to_add = [
            "ALTER TABLE spaces ADD COLUMN description TEXT",
            "ALTER TABLE spaces ADD COLUMN image_url VARCHAR(500)",
            # Core JSON columns used by the API when saving a space
            "ALTER TABLE spaces ADD COLUMN features JSON",
            "ALTER TABLE spaces ADD COLUMN pricing_overrides JSON",
            "ALTER TABLE spaces ADD COLUMN event_types JSON",
            "ALTER TABLE spaces ADD COLUMN stage_options JSON", 
            "ALTER TABLE spaces ADD COLUMN banner_sizes JSON"
        ]
        
        for column_sql in columns_to_add:
            try:
                await conn.execute(text(column_sql))
                print(f"✓ Added column: {column_sql}")
            except Exception as e:
                print(f"✗ Error adding column: {e}")
        
        print("\nUpdating existing spaces with sample data...")
        
        # Update Grant Hall (ID: 1) with comprehensive data
        grant_hall_data = {
            "description": "Customize your event with add-ons and decorations",
            "image_url": "/assets/images/grantHall.jpg",
            "event_types": [
                {
                    "id": "birthday",
                    "label": "Birthday",
                    "icon": "gift-outline",
                    "addOns": [
                        {"id": "balloons", "label": "Balloons", "price": 100},
                        {"id": "party-candles", "label": "Candles", "price": 100},
                        {"id": "welcome-board", "label": "Welcome Board", "price": 250}
                    ]
                },
                {
                    "id": "engagement",
                    "label": "Engagement",
                    "icon": "diamond-outline", 
                    "addOns": [
                        {"id": "ring-tray", "label": "Ring Tray Decor", "price": 900},
                        {"id": "floral-backdrop", "label": "Floral Backdrop", "price": 2200}
                    ]
                },
                {
                    "id": "wedding",
                    "label": "Reception",
                    "icon": "heart-outline",
                    "addOns": [
                        {"id": "mandap-decor", "label": "Mandap Decor", "price": 4500},
                        {"id": "stage-lighting", "label": "Stage Lighting", "price": 1800}
                    ]
                },
                {
                    "id": "corporate",
                    "label": "Corporate Event",
                    "icon": "briefcase-outline",
                    "addOns": [
                        {"id": "projector-rent", "label": "Projector Rent", "price": 1200},
                        {"id": "podium", "label": "Podium", "price": 700},
                        {"id": "registration-desk", "label": "Registration Desk", "price": 500}
                    ]
                },
                {
                    "id": "conference",
                    "label": "Conference / Seminar",
                    "icon": "school-outline",
                    "addOns": [
                        {"id": "whiteboard", "label": "Whiteboard & Markers", "price": 250},
                        {"id": "pa-system", "label": "PA System", "price": 950}
                    ]
                },
                {
                    "id": "cultural",
                    "label": "Cultural Program",
                    "icon": "musical-notes-outline",
                    "addOns": [
                        {"id": "stage-lights", "label": "Stage Lights", "price": 1400},
                        {"id": "sound-basic", "label": "Sound System (Basic)", "price": 1200}
                    ]
                }
            ],
            "stage_options": [
                {"id": "stage-default", "label": "Default Stage", "image": "/assets/images/decoration_default.png", "price": 0},
                {"id": "stage-floral", "label": "Floral Theme", "image": "/assets/images/decoration2.png", "price": 900},
                {"id": "stage-premium", "label": "Premium", "image": "/assets/images/decoration3.png", "price": 1000},
                {"id": "stage-legacy", "label": "Classic", "image": "/assets/images/decoration1.jpg", "price": 700}
            ],
            "banner_sizes": [
                {"id": "banner-s", "label": "4x2 ft", "width": 4, "height": 2, "price": 600},
                {"id": "banner-m", "label": "6x3 ft", "width": 6, "height": 3, "price": 900}
            ]
        }
        
        # Update features for Grant Hall
        grant_hall_features = [
            {"id": "mic", "label": "Mic", "image": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=60&auto=format&fit=crop"},
            {"id": "sound", "label": "Sound System", "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=60&auto=format&fit=crop"},
            {"id": "ac", "label": "AC", "image": "https://images.unsplash.com/photo-1604335399105-a0d7d9c9f51f?w=400&q=60&auto=format&fit=crop"},
            {"id": "capacity", "label": "500 Seats", "image": "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=400&q=60&auto=format&fit=crop"},
            {"id": "food", "label": "Food", "image": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&q=60&auto=format&fit=crop"},
            {"id": "drinks", "label": "Drinks", "image": "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?w=400&q=60&auto=format&fit=crop"},
            {"id": "projector", "label": "Projector", "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&q=60&auto=format&fit=crop"}
        ]
        
        # Update Grant Hall
        await conn.execute(text("""
            UPDATE spaces SET 
                description = :description,
                image_url = :image_url,
                features = :features,
                event_types = :event_types,
                stage_options = :stage_options,
                banner_sizes = :banner_sizes
            WHERE id = 1
        """), {
            "description": grant_hall_data["description"],
            "image_url": grant_hall_data["image_url"],
            "features": json.dumps(grant_hall_features),
            "event_types": json.dumps(grant_hall_data["event_types"]),
            "stage_options": json.dumps(grant_hall_data["stage_options"]),
            "banner_sizes": json.dumps(grant_hall_data["banner_sizes"])
        })
        
        # Update Meeting Room (ID: 2) with simpler data
        meeting_room_data = {
            "description": "Book a compact meeting room with TV and essentials",
            "image_url": "/assets/images/conference.jpg",
            "event_types": [],
            "stage_options": [],
            "banner_sizes": []
        }
        
        meeting_room_features = [
            {"id": "tv", "label": "TV/Display", "image": "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=400&q=60&auto=format&fit=crop"},
            {"id": "wifi", "label": "Wi‑Fi", "image": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=60&auto=format&fit=crop"},
            {"id": "ac", "label": "AC", "image": "https://images.unsplash.com/photo-1604335399105-a0d7d9c9f51f?w=400&q=60&auto=format&fit=crop"},
            {"id": "capacity", "label": "12 Seats", "image": "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=400&q=60&auto=format&fit=crop"},
            {"id": "drinks", "label": "Drinking Water", "image": "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?w=400&q=60&auto=format&fit=crop"}
        ]
        
        # Update Meeting Room
        await conn.execute(text("""
            UPDATE spaces SET 
                description = :description,
                image_url = :image_url,
                features = :features,
                event_types = :event_types,
                stage_options = :stage_options,
                banner_sizes = :banner_sizes
            WHERE id = 2
        """), {
            "description": meeting_room_data["description"],
            "image_url": meeting_room_data["image_url"],
            "features": json.dumps(meeting_room_features),
            "event_types": json.dumps(meeting_room_data["event_types"]),
            "stage_options": json.dumps(meeting_room_data["stage_options"]),
            "banner_sizes": json.dumps(meeting_room_data["banner_sizes"])
        })
        
        print("✓ Updated Grant Hall (ID: 1) with comprehensive data")
        print("✓ Updated Meeting Room (ID: 2) with basic data")
        
        # Verify the updates
        result = await conn.execute(text("SELECT id, name, description, image_url FROM spaces WHERE id IN (1, 2)"))
        rows = result.fetchall()
        print("\nUpdated spaces:")
        for row in rows:
            print(f"  - {row[1]} (ID: {row[0]}): {row[2]}")

if __name__ == "__main__":
    asyncio.run(add_spaces_columns())
