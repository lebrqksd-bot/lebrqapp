#!/usr/bin/env python3
"""
Check current spaces data in the database
"""
import requests
import json
from app.config_client import API_BASE_URL

def check_spaces():
    try:
        response = requests.get(f"{API_BASE_URL}/venues")
        if response.status_code == 200:
            venues = response.json()
            print('Venues:')
            for venue in venues:
                print(f'  - {venue["name"]} (ID: {venue["id"]})')

            if venues:
                venue_id = venues[0]['id']
                spaces_response = requests.get(f"{API_BASE_URL}/venues/{venue_id}/spaces")
                if spaces_response.status_code == 200:
                    spaces = spaces_response.json()
                    print(f'\nSpaces for venue {venue_id}:')
                    for space in spaces:
                        print(f'  - {space["name"]} (ID: {space["id"]}) - Capacity: {space["capacity"]}, Price: {space["price_per_hour"]}/hr')
                        if space.get('features'):
                            print(f'    Features: {space["features"]}')
                else:
                    print(f'Error getting spaces: {spaces_response.status_code}')
        else:
            print(f'Error getting venues: {response.status_code}')
    except Exception as e:
        print(f'Error: {e}')

if __name__ == "__main__":
    check_spaces()