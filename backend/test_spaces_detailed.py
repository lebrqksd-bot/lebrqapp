#!/usr/bin/env python3
"""
Detailed test of spaces API to debug 500 error
"""
import requests
import json
from app.config_client import API_BASE_URL

def test_spaces_detailed():
    try:
        # Test venues endpoint
        print("Testing venues endpoint...")
        response = requests.get(f'{API_BASE_URL}/venues')
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            venues = response.json()
            print(f"Venues: {json.dumps(venues, indent=2)}")
            
            if venues:
                venue_id = venues[0]['id']
                print(f"\nTesting spaces endpoint for venue {venue_id}...")
                
                # Test spaces endpoint
                spaces_response = requests.get(f'{API_BASE_URL}/venues/{venue_id}/spaces')
                print(f"Spaces Status: {spaces_response.status_code}")
                if spaces_response.status_code != 200:
                    print(f"Error response: {spaces_response.text}")
                else:
                    spaces = spaces_response.json()
                    print(f"Spaces: {json.dumps(spaces, indent=2)}")
                    
                # Test individual space endpoint
                print(f"\nTesting individual space endpoint...")
                space_response = requests.get(f'{API_BASE_URL}/venues/spaces/1')
                print(f"Space 1 Status: {space_response.status_code}")
                if space_response.status_code != 200:
                    print(f"Error response: {space_response.text}")
                else:
                    space = space_response.json()
                    print(f"Space 1: {json.dumps(space, indent=2)}")
        else:
            print(f"Error response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_spaces_detailed()
