#!/usr/bin/env python3
"""
Simple script to populate venue and space data using API endpoints.
"""
import requests
from app.config_client import API_BASE_URL as BASE_URL

def populate_venues():
    """Populate sample venue and space data using API calls"""
    try:
        # Check if we already have the main venue
        response = requests.get(f"{BASE_URL}/venues")
        if response.status_code == 200:
            venues = response.json()
            main_venue = None
            for venue in venues:
                if venue['name'] == 'Lebrq Event Center':
                    main_venue = venue
                    break
            
            if main_venue:
                print(f"Main venue already exists: {main_venue['name']} (ID: {main_venue['id']})")
                return main_venue['id']
        
        print("Creating venue and space data...")
        print("Note: This would require POST endpoints to be implemented.")
        print("For now, we'll work with existing data.")
        
        # Get the first venue
        response = requests.get(f"{BASE_URL}/venues")
        if response.status_code == 200:
            venues = response.json()
            if venues:
                venue = venues[0]
                print(f"Using existing venue: {venue['name']} (ID: {venue['id']})")
                return venue['id']
        
        return None
        
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    venue_id = populate_venues()
    if venue_id:
        print(f"Venue ID: {venue_id}")
    else:
        print("No venue available")
