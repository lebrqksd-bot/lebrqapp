#!/usr/bin/env python3
"""
Script to add comprehensive event details including:
- Detailed sub-items with images for each event type
- Icons for all event types and sub-types
- Purchasing capability for all items
"""

import pymysql
import json
from typing import Dict, Any
from scripts_db import get_pymysql_config


def get_connection():
    """Get database connection (env-driven)."""
    return pymysql.connect(**get_pymysql_config())

def update_event_types_with_details():
    """Update event_types with comprehensive details including sub-items, images, and icons"""
    
    # Comprehensive event types with detailed sub-items and icons
    comprehensive_event_types = {
        "🎉 Social & Life Events": {
            "id": "social-life",
            "label": "🎉 Social & Life Events",
            "icon": "gift-outline",
            "subcategories": [
                {
                    "id": "birthday-party",
                    "label": "Birthday Party",
                    "icon": "cake-outline",
                    "price": 0,
                    "addOns": [
                        {
                            "id": "balloons",
                            "label": "Balloons",
                            "type": "detailed",
                            "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&q=60&auto=format&fit=crop",
                            "subItems": [
                                {"id": "latex-balloons", "label": "Latex Balloons (Pack of 50)", "price": 150, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "foil-balloons", "label": "Foil Balloons (Pack of 20)", "price": 200, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"},
                                {"id": "helium-balloons", "label": "Helium Balloons (Pack of 10)", "price": 300, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "number-balloons", "label": "Number Balloons (Set of 2)", "price": 250, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"}
                            ]
                        },
                        {
                            "id": "decorations",
                            "label": "Decorations",
                            "type": "detailed",
                            "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&q=60&auto=format&fit=crop",
                            "subItems": [
                                {"id": "banners", "label": "Happy Birthday Banner", "price": 180, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "streamers", "label": "Colorful Streamers (Pack of 5)", "price": 120, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"},
                                {"id": "confetti", "label": "Confetti (Pack of 3)", "price": 80, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "table-centerpieces", "label": "Table Centerpieces (Set of 6)", "price": 400, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"}
                            ]
                        },
                        {
                            "id": "party-supplies",
                            "label": "Party Supplies",
                            "type": "detailed",
                            "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&q=60&auto=format&fit=crop",
                            "subItems": [
                                {"id": "paper-plates", "label": "Disposable Plates (Pack of 50)", "price": 100, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "cups", "label": "Disposable Cups (Pack of 50)", "price": 80, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"},
                                {"id": "napkins", "label": "Themed Napkins (Pack of 100)", "price": 60, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "party-hats", "label": "Party Hats (Pack of 20)", "price": 150, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"}
                            ]
                        }
                    ]
                },
                {
                    "id": "wedding-reception",
                    "label": "Wedding Reception",
                    "icon": "heart-outline",
                    "price": 0,
                    "addOns": [
                        {
                            "id": "floral-arrangements",
                            "label": "Floral Arrangements",
                            "type": "detailed",
                            "image": "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=400&q=60&auto=format&fit=crop",
                            "subItems": [
                                {"id": "bridal-bouquet", "label": "Bridal Bouquet", "price": 2500, "image": "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=200&q=60&auto=format&fit=crop"},
                                {"id": "centerpieces", "label": "Table Centerpieces (Set of 10)", "price": 3000, "image": "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=200&q=60&auto=format&fit=crop"},
                                {"id": "arch-decoration", "label": "Wedding Arch Decoration", "price": 4000, "image": "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=200&q=60&auto=format&fit=crop"},
                                {"id": "aisle-markers", "label": "Aisle Markers (Set of 12)", "price": 1500, "image": "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=200&q=60&auto=format&fit=crop"}
                            ]
                        },
                        {
                            "id": "lighting",
                            "label": "Lighting & Ambiance",
                            "type": "detailed",
                            "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&q=60&auto=format&fit=crop",
                            "subItems": [
                                {"id": "string-lights", "label": "String Lights (50 meters)", "price": 800, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "spotlights", "label": "Spotlights (Set of 4)", "price": 1200, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"},
                                {"id": "candles", "label": "Decorative Candles (Set of 20)", "price": 600, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "chandelier", "label": "Decorative Chandelier", "price": 2500, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"}
                            ]
                        }
                    ]
                }
            ]
        },
        "🏢 Corporate & Business Events": {
            "id": "corporate-business",
            "label": "🏢 Corporate & Business Events",
            "icon": "business-outline",
            "subcategories": [
                {
                    "id": "conference",
                    "label": "Conference / Summit",
                    "icon": "people-outline",
                    "price": 0,
                    "addOns": [
                        {
                            "id": "av-equipment",
                            "label": "Audio-Visual Equipment",
                            "type": "detailed",
                            "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&q=60&auto=format&fit=crop",
                            "subItems": [
                                {"id": "projector", "label": "HD Projector", "price": 1500, "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200&q=60&auto=format&fit=crop"},
                                {"id": "microphone", "label": "Wireless Microphone Set", "price": 800, "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200&q=60&auto=format&fit=crop"},
                                {"id": "speakers", "label": "Professional Speakers (Set of 4)", "price": 2000, "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200&q=60&auto=format&fit=crop"},
                                {"id": "screen", "label": "Projection Screen (10ft)", "price": 600, "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200&q=60&auto=format&fit=crop"}
                            ]
                        },
                        {
                            "id": "stationery",
                            "label": "Conference Stationery",
                            "type": "detailed",
                            "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&q=60&auto=format&fit=crop",
                            "subItems": [
                                {"id": "notepads", "label": "Conference Notepads (50 pcs)", "price": 300, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "pens", "label": "Branded Pens (50 pcs)", "price": 250, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"},
                                {"id": "name-tags", "label": "Name Tags (100 pcs)", "price": 200, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "folders", "label": "Conference Folders (50 pcs)", "price": 500, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"}
                            ]
                        }
                    ]
                }
            ]
        },
        "🎓 Educational & Academic": {
            "id": "educational-academic",
            "label": "🎓 Educational & Academic",
            "icon": "school-outline",
            "subcategories": [
                {
                    "id": "academic-seminar",
                    "label": "Academic Seminar",
                    "icon": "library-outline",
                    "price": 0,
                    "addOns": [
                        {
                            "id": "presentation-tools",
                            "label": "Presentation Tools",
                            "type": "detailed",
                            "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&q=60&auto=format&fit=crop",
                            "subItems": [
                                {"id": "laptop", "label": "Presentation Laptop", "price": 2000, "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200&q=60&auto=format&fit=crop"},
                                {"id": "clicker", "label": "Presentation Clicker", "price": 150, "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200&q=60&auto=format&fit=crop"},
                                {"id": "pointer", "label": "Laser Pointer", "price": 100, "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200&q=60&auto=format&fit=crop"},
                                {"id": "whiteboard", "label": "Mobile Whiteboard", "price": 800, "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200&q=60&auto=format&fit=crop"}
                            ]
                        }
                    ]
                }
            ]
        },
        "🎭 Entertainment & Arts": {
            "id": "entertainment-arts",
            "label": "🎭 Entertainment & Arts",
            "icon": "musical-notes-outline",
            "subcategories": [
                {
                    "id": "karaoke-night",
                    "label": "Karaoke Night",
                    "icon": "mic-outline",
                    "price": 0,
                    "addOns": [
                        {
                            "id": "karaoke-equipment",
                            "label": "Karaoke Equipment",
                            "type": "detailed",
                            "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&q=60&auto=format&fit=crop",
                            "subItems": [
                                {"id": "karaoke-machine", "label": "Professional Karaoke Machine", "price": 3000, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "wireless-mics", "label": "Wireless Microphones (Set of 4)", "price": 1200, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"},
                                {"id": "song-books", "label": "Song Books (Set of 10)", "price": 400, "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&q=60&auto=format&fit=crop"},
                                {"id": "stage-lights", "label": "Stage Lighting Kit", "price": 1500, "image": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=60&auto=format&fit=crop"}
                            ]
                        }
                    ]
                }
            ]
        },
        "🍽️ Culinary & Themed Socials": {
            "id": "culinary-themed",
            "label": "🍽️ Culinary & Themed Socials",
            "icon": "restaurant-outline",
            "subcategories": [
                {
                    "id": "gala-dinner",
                    "label": "Gala Dinner / Banquet",
                    "icon": "wine-outline",
                    "price": 0,
                    "addOns": [
                        {
                            "id": "table-settings",
                            "label": "Table Settings",
                            "type": "detailed",
                            "image": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&q=60&auto=format&fit=crop",
                            "subItems": [
                                {"id": "fine-china", "label": "Fine China Set (per table)", "price": 800, "image": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&q=60&auto=format&fit=crop"},
                                {"id": "crystal-glasses", "label": "Crystal Wine Glasses (Set of 12)", "price": 600, "image": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&q=60&auto=format&fit=crop"},
                                {"id": "table-linen", "label": "Premium Table Linen", "price": 200, "image": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&q=60&auto=format&fit=crop"},
                                {"id": "centerpieces", "label": "Elegant Centerpieces (Set of 8)", "price": 1200, "image": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&q=60&auto=format&fit=crop"}
                            ]
                        }
                    ]
                }
            ]
        }
    }
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Update the event_types for space_id = 1 (Grant Hall)
        update_query = """
        UPDATE spaces 
        SET event_types = %s 
        WHERE id = 1
        """
        
        cursor.execute(update_query, (json.dumps(comprehensive_event_types),))
        conn.commit()
        
        print("SUCCESS: Comprehensive event details added successfully!")
        print(f"   - Added detailed sub-items with images")
        print(f"   - Added icons for all event types and sub-types")
        print(f"   - Implemented purchasing capability")
        print(f"   - Updated {len(comprehensive_event_types)} main categories")
        
        # Count total subcategories and add-ons
        total_subcategories = sum(len(cat['subcategories']) for cat in comprehensive_event_types.values())
        total_addons = sum(
            len(subcat.get('addOns', [])) 
            for cat in comprehensive_event_types.values() 
            for subcat in cat['subcategories']
        )
        
        print(f"   - Total subcategories: {total_subcategories}")
        print(f"   - Total add-on categories: {total_addons}")
        
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("Starting comprehensive event details update...")
    update_event_types_with_details()
    print("Update completed!")
