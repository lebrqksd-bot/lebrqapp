#!/bin/bash
# Google Maps API Key Setup Script
# Usage: ./setup_google_api_key.sh YOUR_API_KEY_HERE

if [ -z "$1" ]; then
    echo "Error: Please provide your Google Maps API key"
    echo "Usage: ./setup_google_api_key.sh YOUR_API_KEY_HERE"
    echo "Example: ./setup_google_api_key.sh AIzaSyB2JsABFlrKNtwxnoKxatuk7IvbaeCs1_8"
    exit 1
fi

API_KEY=$1

# Check if .env file exists
if [ -f .env ]; then
    # Remove old GOOGLE_PLACES_API_KEY if exists
    sed -i.bak '/^GOOGLE_PLACES_API_KEY=/d' .env
    # Add new API key
    echo "GOOGLE_PLACES_API_KEY=$API_KEY" >> .env
    echo "✅ Google Maps API key updated in .env file"
else
    # Create new .env file
    echo "GOOGLE_PLACES_API_KEY=$API_KEY" > .env
    echo "LOCATION_PROVIDER=google" >> .env
    echo "✅ Created .env file with Google Maps API key"
fi

echo ""
echo "📝 Configuration:"
echo "   API Key: $API_KEY"
echo "   Location Provider: Google Maps"
echo ""
echo "⚠️  Make sure to restart your backend server for changes to take effect!"
echo ""

