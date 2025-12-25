#!/usr/bin/env python3
"""
Test script to check venues API and populate data
"""
import requests
import json
from app.config_client import API_BASE_URL as BASE_URL

def test_venues_api():
    """Test the venues API endpoints"""
    try:
        # Test health endpoint
        print("Testing health endpoint...")
        response = requests.get(f"{BASE_URL}/health")
        print(f"Health: {response.status_code} - {response.json()}")
        
        # Test venues endpoint
        print("\nTesting venues endpoint...")
        response = requests.get(f"{BASE_URL}/venues")
        print(f"Venues: {response.status_code}")
        if response.status_code == 200:
            venues = response.json()
            print(f"Found {len(venues)} venues")
            for venue in venues:
                print(f"  - {venue['name']} (ID: {venue['id']})")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error testing API: {e}")

if __name__ == "__main__":
    test_venues_api()
