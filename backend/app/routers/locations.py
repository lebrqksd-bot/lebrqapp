"""
Location Services Router
Provides location autocomplete and distance calculation using multiple providers:
- OpenStreetMap Nominatim (FREE, no API key)
- Google Places API (paid, requires API key)
"""

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
import httpx
import os
from typing import Optional
import logging
import math

from app.core import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/locations", tags=["locations"])

# Configuration
# Force use of Nominatim (free open-source) - no Google API
LOCATION_PROVIDER = "nominatim"  # Always use Nominatim
USE_MOCK_DATA = settings.USE_MOCK_LOCATION_DATA if hasattr(settings, 'USE_MOCK_LOCATION_DATA') else False

# API URLs - Using only OpenStreetMap Nominatim (FREE, open-source)
NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_GEOCODE_URL = "https://nominatim.openstreetmap.org/search"

# Nominatim requires a User-Agent header
NOMINATIM_USER_AGENT = "LebrqBookingSystem/1.0"


# ============================================================================
# Helper Functions for Different Location Providers
# ============================================================================

async def nominatim_autocomplete(query: str, country_code: Optional[str] = None):
    """
    Search locations using OpenStreetMap Nominatim (FREE)
    """
    try:
        # Extract country code from components (country:in -> in)
        countrycodes = None
        if country_code and ":" in country_code:
            countrycodes = country_code.split(":")[1]
        
        params = {
            "q": query,
            "format": "json",
            "addressdetails": 1,
            "limit": 5,
        }
        
        if countrycodes:
            params["countrycodes"] = countrycodes
        
        headers = {
            "User-Agent": NOMINATIM_USER_AGENT
        }
        
        # Use reasonable timeout (8 seconds) to balance between responsiveness and reliability
        # Try to use connection limits if available (httpx >= 0.24.0)
        client_kwargs = {"timeout": 8.0}
        try:
            client_kwargs["limits"] = httpx.Limits(max_connections=5, max_keepalive_connections=2)
        except (AttributeError, TypeError):
            # Older httpx version doesn't support Limits
            pass
        
        async with httpx.AsyncClient(**client_kwargs) as client:
            response = await client.get(NOMINATIM_SEARCH_URL, params=params, headers=headers)
            
            if response.status_code != 200:
                logger.error(f"[Locations] Nominatim API error: {response.status_code}")
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch location suggestions")
            
            # Limit response size to prevent memory issues (max 1MB)
            if len(response.content) > 1024 * 1024:
                logger.warning(f"[Locations] Nominatim response too large: {len(response.content)} bytes")
                raise HTTPException(status_code=500, detail="Response too large")
            
            data = response.json()
            
            # Limit number of results to prevent memory issues
            if len(data) > 10:
                data = data[:10]
            
            # Convert Nominatim format to Google Places format for consistency
            predictions = []
            for place in data:
                predictions.append({
                    "description": place.get("display_name", ""),
                    "place_id": f"osm_{place.get('osm_type', '')}_{place.get('osm_id', '')}",
                    "structured_formatting": {
                        "main_text": place.get("name", place.get("display_name", "").split(",")[0]),
                        "secondary_text": ", ".join(place.get("display_name", "").split(",")[1:]).strip()
                    },
                    "lat": float(place.get("lat", 0)),
                    "lon": float(place.get("lon", 0)),
                })
            
            logger.info(f"[Locations] Nominatim query '{query}' returned {len(predictions)} results")
            
            return JSONResponse(content={"predictions": predictions, "status": "OK"})
    
    except MemoryError as e:
        logger.error(f"[Locations] Nominatim memory error: {str(e)}")
        # Return empty results instead of crashing
        return JSONResponse(content={"predictions": [], "status": "OK"})
    except httpx.TimeoutException:
        logger.warning("[Locations] Nominatim request timeout - returning empty results")
        # Return empty results instead of raising exception to prevent client errors
        return JSONResponse(content={"predictions": [], "status": "OK"})
    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 500 from API)
        raise
    except Exception as e:
        logger.error(f"[Locations] Nominatim autocomplete error: {str(e)}")
        # Return empty results on error to prevent server crashes
        return JSONResponse(content={"predictions": [], "status": "OK"})


async def google_places_autocomplete(query: str, components: Optional[str] = None):
    """
    Search locations using Google Places API (requires API key)
    """
    if not GOOGLE_PLACES_API_KEY:
        logger.error("[Locations] Google Places API key not configured")
        raise HTTPException(status_code=500, detail="Google Places API not configured")
    
    try:
        params = {
            "input": query,
            "key": GOOGLE_PLACES_API_KEY,
            "components": components,
            "types": "geocode|establishment",
        }
        
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(GOOGLE_PLACES_AUTOCOMPLETE_URL, params=params)
            
            if response.status_code != 200:
                logger.error(f"[Locations] Google Places API error: {response.status_code}")
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch location suggestions")
            
            data = response.json()
            
            if data.get("status") != "OK" and data.get("status") != "ZERO_RESULTS":
                logger.error(f"[Locations] Google Places API status: {data.get('status')}")
                raise HTTPException(status_code=500, detail=f"Location service error: {data.get('status')}")
            
            logger.info(f"[Locations] Google Places query '{query}' returned {len(data.get('predictions', []))} results")
            
            return JSONResponse(content=data)
    
    except httpx.TimeoutException:
        logger.error("[Locations] Google Places request timeout")
        raise HTTPException(status_code=504, detail="Location service timeout")
    except Exception as e:
        logger.error(f"[Locations] Google Places autocomplete error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to search locations")


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two points using Haversine formula
    Returns distance in kilometers
    """
    R = 6371  # Earth's radius in kilometers
    
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    # Haversine formula
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    return distance


async def nominatim_distance(origin: str, destination: str, mode: str = "driving"):
    """
    Calculate distance using OpenStreetMap Nominatim (FREE)
    Uses geocoding + Haversine formula for distance calculation
    """
    try:
        headers = {"User-Agent": NOMINATIM_USER_AGENT}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Geocode origin with retry logic
            origin_lat = None
            origin_lon = None
            origin_attempts = [
                origin,  # Try full address first
                origin.split(',')[0] if ',' in origin else origin,  # Try first part
                origin.split(',')[-1] if ',' in origin else origin,  # Try last part (city/state)
            ]
            
            for attempt in origin_attempts:
                try:
                    origin_response = await client.get(
                        NOMINATIM_GEOCODE_URL,
                        params={"q": attempt.strip(), "format": "json", "limit": 3, "countrycodes": "in"},
                        headers=headers
                    )
                    
                    if origin_response.status_code == 200 and origin_response.json():
                        origin_data = origin_response.json()[0]
                        origin_lat = float(origin_data["lat"])
                        origin_lon = float(origin_data["lon"])
                        logger.info(f"[Locations] Geocoded origin '{attempt}' → ({origin_lat}, {origin_lon})")
                        break
                except Exception as e:
                    logger.warning(f"[Locations] Failed to geocode origin '{attempt}': {e}")
                    continue
            
            if origin_lat is None or origin_lon is None:
                raise HTTPException(status_code=404, detail=f"Origin location not found: {origin}")
            
            # Geocode destination with retry logic
            dest_lat = None
            dest_lon = None
            dest_attempts = [
                destination,  # Try full address first
                destination.split(',')[0] if ',' in destination else destination,  # Try first part
                destination.split(',')[-1] if ',' in destination else destination,  # Try last part
                "Kasaragod, Kerala, India",  # Fallback to city
                "Kasaragod",  # Fallback to city name only
            ]
            
            for attempt in dest_attempts:
                try:
                    dest_response = await client.get(
                        NOMINATIM_GEOCODE_URL,
                        params={"q": attempt.strip(), "format": "json", "limit": 3, "countrycodes": "in"},
                        headers=headers
                    )
                    
                    if dest_response.status_code == 200 and dest_response.json():
                        dest_data = dest_response.json()[0]
                        dest_lat = float(dest_data["lat"])
                        dest_lon = float(dest_data["lon"])
                        logger.info(f"[Locations] Geocoded destination '{attempt}' → ({dest_lat}, {dest_lon})")
                        break
                except Exception as e:
                    logger.warning(f"[Locations] Failed to geocode destination '{attempt}': {e}")
                    continue
            
            if dest_lat is None or dest_lon is None:
                raise HTTPException(status_code=404, detail=f"Destination location not found: {destination}")
        
        # Calculate distance using Haversine formula
        distance_km = calculate_haversine_distance(origin_lat, origin_lon, dest_lat, dest_lon)
        
        # Estimate duration (assuming average speed)
        avg_speed_kmh = {"driving": 40, "walking": 5, "bicycling": 15, "transit": 30}
        speed = avg_speed_kmh.get(mode, 40)
        duration_seconds = int((distance_km / speed) * 3600)
        
        result = {
            "origin": origin,
            "destination": destination,
            "distance_km": round(distance_km, 2),
            "distance_text": f"{distance_km:.1f} km",
            "duration_seconds": duration_seconds,
            "duration_text": f"{duration_seconds // 60} mins" if duration_seconds < 3600 else f"{duration_seconds // 3600} hours {(duration_seconds % 3600) // 60} mins",
            "mode": mode,
        }
        
        logger.info(f"[Locations] Nominatim distance: {origin} → {destination} = {distance_km:.2f} km")
        
        return JSONResponse(content=result)
    
    except httpx.TimeoutException:
        logger.error("[Locations] Nominatim request timeout")
        raise HTTPException(status_code=504, detail="Location service timeout")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Locations] Nominatim distance error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to calculate distance")


async def google_distance_matrix(origin: str, destination: str, mode: str = "driving"):
    """
    Calculate distance using Google Distance Matrix API (requires API key)
    """
    if not GOOGLE_PLACES_API_KEY:
        logger.error("[Locations] Google Places API key not configured")
        raise HTTPException(status_code=500, detail="Google Distance Matrix API not configured")
    
    try:
        params = {
            "origins": origin,
            "destinations": destination,
            "key": GOOGLE_PLACES_API_KEY,
            "mode": mode,
            "units": "metric",
        }
        
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(GOOGLE_DISTANCE_MATRIX_URL, params=params)
            
            if response.status_code != 200:
                logger.error(f"[Locations] Google Distance Matrix API error: {response.status_code}")
                raise HTTPException(status_code=response.status_code, detail="Failed to calculate distance")
            
            data = response.json()
            
            if data.get("status") != "OK":
                logger.error(f"[Locations] Google Distance Matrix API status: {data.get('status')}")
                raise HTTPException(status_code=500, detail=f"Distance calculation error: {data.get('status')}")
            
            rows = data.get("rows", [])
            if not rows or not rows[0].get("elements"):
                raise HTTPException(status_code=404, detail="No route found between the locations")
            
            element = rows[0]["elements"][0]
            
            if element.get("status") != "OK":
                raise HTTPException(status_code=404, detail=f"Route not found: {element.get('status')}")
            
            distance = element.get("distance", {})
            duration = element.get("duration", {})
            
            distance_km = distance.get("value", 0) / 1000
            distance_text = distance.get("text", "")
            duration_seconds = duration.get("value", 0)
            duration_text = duration.get("text", "")
            
            result = {
                "origin": origin,
                "destination": destination,
                "distance_km": round(distance_km, 2),
                "distance_text": distance_text,
                "duration_seconds": duration_seconds,
                "duration_text": duration_text,
                "mode": mode,
            }
            
            logger.info(f"[Locations] Google distance: {origin} → {destination} = {distance_km:.2f} km")
            
            return JSONResponse(content=result)
    
    except httpx.TimeoutException:
        logger.error("[Locations] Google Distance Matrix request timeout")
        raise HTTPException(status_code=504, detail="Location service timeout")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Locations] Google Distance Matrix error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to calculate distance")


# ============================================================================
# Main Endpoints
# ============================================================================

@router.get("/office-address")
async def get_office_address():
    """
    Get the configured office/company address for distance calculations.
    Returns a simplified address that works better with Nominatim geocoding.
    """
    full_address = settings.COMPANY_ADDRESS
    # Provide both full address and simplified version for better geocoding
    simplified_address = "Kasaragod, Kerala, India"  # Simplified for Nominatim
    
    return JSONResponse(content={
        "address": full_address,
        "simplified_address": simplified_address,  # Use this for Nominatim geocoding
        "name": "Le BRQ Office"
    })


@router.get("/autocomplete")
async def location_autocomplete(
    input: str = Query(..., min_length=3, description="Search query for location"),
    components: Optional[str] = Query("country:in", description="Restrict to specific country (e.g., country:in for India)"),
):
    """
    Get location suggestions using OpenStreetMap Nominatim (FREE, open-source)
    
    Args:
        input: Search query (minimum 3 characters)
        components: Country restriction (default: India)
    
    Returns:
        JSON response with location predictions
    """
    # Always use OpenStreetMap Nominatim (FREE, no API key needed)
    return await nominatim_autocomplete(input, components)
    
    # Fallback to mock data for testing
    if USE_MOCK_DATA:
        logger.info(f"[Locations] Using mock data for autocomplete query: {input}")
        mock_predictions = [
            {
                "description": f"{input.capitalize()} International Airport, Kerala, India",
                "place_id": f"mock_place_id_{input}_airport",
                "structured_formatting": {
                    "main_text": f"{input.capitalize()} International Airport",
                    "secondary_text": "Kerala, India"
                }
            },
            {
                "description": f"{input.capitalize()} Railway Station, Kerala, India",
                "place_id": f"mock_place_id_{input}_railway",
                "structured_formatting": {
                    "main_text": f"{input.capitalize()} Railway Station",
                    "secondary_text": "Kerala, India"
                }
            },
            {
                "description": f"{input.capitalize()} Bus Stand, Ernakulam, Kerala, India",
                "place_id": f"mock_place_id_{input}_bus",
                "structured_formatting": {
                    "main_text": f"{input.capitalize()} Bus Stand",
                    "secondary_text": "Ernakulam, Kerala, India"
                }
            },
            {
                "description": f"{input.capitalize()}, Kochi, Kerala, India",
                "place_id": f"mock_place_id_{input}_city",
                "structured_formatting": {
                    "main_text": input.capitalize(),
                    "secondary_text": "Kochi, Kerala, India"
                }
            }
        ]
        return JSONResponse(content={"predictions": mock_predictions, "status": "OK"})
    
    # This code should not be reached due to the logic above, but kept as backup
    # Fallback to Nominatim if we reach here
    return await nominatim_autocomplete(input, components)


@router.get("/distance")
async def calculate_distance(
    origin: str = Query(..., description="Starting location (address or place name)"),
    destination: str = Query(..., description="Destination location (address or place name)"),
    mode: Optional[str] = Query("driving", description="Travel mode: driving, walking, bicycling, transit"),
):
    """
    Calculate distance and duration between two locations using OpenStreetMap Nominatim (FREE, open-source)
    
    Args:
        origin: Starting location
        destination: Destination location
        mode: Travel mode (default: driving)
    
    Returns:
        JSON response with distance and duration information
    """
    # Always use OpenStreetMap Nominatim (FREE, no API key needed)
    try:
        return await nominatim_distance(origin, destination, mode)
    except httpx.TimeoutException:
        logger.error("[Locations] Request timeout")
        raise HTTPException(status_code=504, detail="Location service timeout")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Locations] Distance calculation error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to calculate distance")

