import math
from typing import Tuple, Optional, List, Dict, Any
from backend.config import CONFIG
from backend.database import (
    get_all_incidents,
    get_incident,
    insert_incident,
    update_incident,
    get_observations_for_incident,
    get_all_blackspots,
    insert_blackspot
)

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points
    on the earth (specified in decimal degrees) in meters.
    """
    R = 6371000.0  # Earth's radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2

    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return R * c

# Comprehensive Bengaluru Ward 154 Corridor Gazetteer
KNOWN_CORRIDORS = [
    {
        "id": "CORR-100FT",
        "name": "100 Feet Road, Indiranagar",
        "short_name": "100 Feet Road",
        "ward_number": 154,
        "ward_name": "Ward 154 (Indiranagar / Shanthi Nagar)",
        "latitude": 12.971920,
        "longitude": 77.641210,
        "type": "Primary Commercial High Street",
        "description": "High-footfall commercial corridor with dining, retail, and delivery partner traffic.",
        "keywords": ["100 feet road", "100ft road", "100 feet", "100ft", "100", "indiranagar 100", "ward 154", "ward154"]
    },
    {
        "id": "CORR-CMH",
        "name": "CMH Road (Chinmaya Mission Hospital Rd)",
        "short_name": "CMH Road",
        "ward_number": 154,
        "ward_name": "Ward 154 (Indiranagar / Shanthi Nagar)",
        "latitude": 12.978520,
        "longitude": 77.643010,
        "type": "Metro & Retail Transit Spine",
        "description": "Key east-west metro line transit corridor with heavy curb activity and commercial retail.",
        "keywords": ["cmh road", "cmh", "chinmaya mission", "chinmaya", "hospital road", "ward 154"]
    },
    {
        "id": "CORR-12MAIN",
        "name": "12th Main Road, HAL 2nd Stage",
        "short_name": "12th Main Road",
        "ward_number": 154,
        "ward_name": "Ward 154 (Indiranagar / Shanthi Nagar)",
        "latitude": 12.974050,
        "longitude": 77.635120,
        "type": "Dining & Pedestrian Promenade",
        "keywords": ["12th main", "12th main road", "12 main", "hal 2nd stage", "hal stage 2", "ward 154"]
    },
    {
        "id": "CORR-DOMLUR",
        "name": "Domlur Flyover Junction / Ring Rd",
        "short_name": "Domlur Junction",
        "ward_number": 154,
        "ward_name": "Ward 154 (Indiranagar / Shanthi Nagar)",
        "latitude": 12.961120,
        "longitude": 77.639140,
        "type": "Major Arterial Flyover & Interchange",
        "keywords": ["domlur", "domlur flyover", "domlur junction", "inner ring road", "ward 154"]
    },
    {
        "id": "CORR-8CROSS",
        "name": "12th Main & 8th Cross Corner",
        "short_name": "8th Cross Blackspot",
        "ward_number": 154,
        "ward_name": "Ward 154 (Indiranagar / Shanthi Nagar)",
        "latitude": 12.969150,
        "longitude": 77.640200,
        "type": "Chronic Waste Hotspot (BS-IND-01)",
        "keywords": ["8th cross", "12th main corner", "blackspot", "relapse spot", "ward 154"]
    },
    {
        "id": "CORR-DEFENCE",
        "name": "Defence Colony, Indiranagar",
        "short_name": "Defence Colony",
        "ward_number": 154,
        "ward_name": "Ward 154 (Indiranagar / Shanthi Nagar)",
        "latitude": 12.977200,
        "longitude": 77.638500,
        "type": "Residential Neighborhood Zone",
        "keywords": ["defence colony", "defense colony", "defence", "defense", "ward 154"]
    },
    {
        "id": "CORR-DOOPANA",
        "name": "Doopanahalli & 80 Feet Road Junction",
        "short_name": "Doopanahalli",
        "ward_number": 154,
        "ward_name": "Ward 154 (Indiranagar / Shanthi Nagar)",
        "latitude": 12.966500,
        "longitude": 77.636000,
        "type": "Mixed Residential & Commercial Link",
        "keywords": ["doopanahalli", "80 feet road", "80ft", "80 feet", "ward 154"]
    },
    {
        "id": "CORR-WARD154",
        "name": "BBMP Ward 154 Central Command (Indiranagar)",
        "short_name": "Ward 154 Headquarters",
        "ward_number": 154,
        "ward_name": "Ward 154 (Indiranagar / Shanthi Nagar)",
        "latitude": 12.971920,
        "longitude": 77.641210,
        "type": "GBA / BBMP Governance Division",
        "keywords": ["ward 154", "ward", "154", "ward154", "shanthi nagar", "indiranagar", "bbmp", "gba"]
    }
]

def resolve_location_name(lat: float, lon: float) -> str:
    """
    Reverse-geocodes coordinate pair to the closest street / corridor in Ward 154.
    """
    closest = None
    min_dist = float('inf')
    for corr in KNOWN_CORRIDORS:
        if corr["id"] == "CORR-WARD154":
            continue
        d = haversine_distance(lat, lon, corr["latitude"], corr["longitude"])
        if d < min_dist:
            min_dist = d
            closest = corr

    if closest and min_dist <= 300:
        if min_dist <= 60:
            return closest["name"]
        else:
            return f"{closest['short_name']} (~{int(min_dist)}m)"
    return f"Ward 154 Corridor ({round(lat, 4)}, {round(lon, 4)})"

def cluster_observation(
    obs_id: str,
    vehicle_id: str,
    lat: float,
    lon: float,
    category: str,
    timestamp: str,
    initial_status: str = "pending_corroboration"
) -> Tuple[str, bool, float]:
    """
    Assigns an observation to an existing incident cluster within 30 meters,
    or creates a new incident.

    Returns:
        (incident_id, is_new_incident, distance_meters)
    """
    incidents = get_all_incidents()
    closest_incident = None
    min_dist = float('inf')

    # Exclude rejected incidents from accepting normal waste clusters
    active_incidents = [
        inc for inc in incidents 
        if inc["status"] != "rejected" and inc["status"] != "cleared"
    ]

    for inc in active_incidents:
        dist = haversine_distance(lat, lon, inc["latitude"], inc["longitude"])
        if dist < min_dist:
            min_dist = dist
            closest_incident = inc

    radius = CONFIG.cluster_radius_meters

    if closest_incident and min_dist <= radius:
        # Correlate with existing incident cluster
        inc_id = closest_incident["id"]
        obs_list = get_observations_for_incident(inc_id)
        
        # Calculate new centroid moving average
        count = closest_incident["observation_count"] + 1
        new_lat = ((closest_incident["latitude"] * closest_incident["observation_count"]) + lat) / count
        new_lon = ((closest_incident["longitude"] * closest_incident["observation_count"]) + lon) / count

        # Count unique vehicle IDs
        vehicle_ids = set([o["vehicle_id"] for o in obs_list] + [vehicle_id])

        fields = {
            "latitude": round(new_lat, 6),
            "longitude": round(new_lon, 6),
            "observation_count": count,
            "vehicle_count": len(vehicle_ids),
            "last_seen": timestamp
        }
        update_incident(inc_id, fields)
        return inc_id, False, round(min_dist, 2)
    else:
        # Create brand new incident
        import uuid
        new_inc_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
        loc_name = resolve_location_name(lat, lon)

        new_incident_data = {
            "id": new_inc_id,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "location_name": loc_name,
            "category": category,
            "status": initial_status,
            "observation_count": 1,
            "vehicle_count": 1,
            "persistence_score": 25.0,
            "first_seen": timestamp,
            "last_seen": timestamp,
            "priority": "LOW",
            "ward_number": CONFIG.default_ward,
            "corporation": CONFIG.corporation,
            "civic_authority": CONFIG.civic_authority,
            "ticket_id": None,
            "is_blackspot": 0
        }
        insert_incident(new_incident_data)

        # Check for historical recurrence at this spot (Blackspot analysis)
        check_and_update_blackspot(lat, lon, timestamp, new_inc_id)

        return new_inc_id, True, 0.0

def check_and_update_blackspot(lat: float, lon: float, timestamp: str, incident_id: str):
    """
    Checks if this location has experienced repeated dumps across time (>= 2 recurrences).
    If so, flags the site as a Chronic Civic Blackspot.
    """
    all_incidents = get_all_incidents()
    nearby_historical = [
        inc for inc in all_incidents 
        if haversine_distance(lat, lon, inc["latitude"], inc["longitude"]) <= 35.0
    ]

    if len(nearby_historical) >= CONFIG.recurrence_threshold_for_blackspot:
        import uuid
        blackspots = get_all_blackspots()
        existing_bs = None
        for bs in blackspots:
            if haversine_distance(lat, lon, bs["latitude"], bs["longitude"]) <= 35.0:
                existing_bs = bs
                break

        if existing_bs:
            bs_id = existing_bs["id"]
            inc_count = existing_bs["incident_count"] + 1
            rec_score = min(100.0, 50.0 + (inc_count * 15.0))
            insert_blackspot({
                "id": bs_id,
                "latitude": existing_bs["latitude"],
                "longitude": existing_bs["longitude"],
                "incident_count": inc_count,
                "first_seen": existing_bs["first_seen"],
                "last_seen": timestamp,
                "recurrence_score": rec_score,
                "status": "CHRONIC_RELAPSE",
                "remediation_history": f"Recurrent dumping detected {inc_count} times. Requires bin installation or CCTV surveillance."
            })
        else:
            bs_id = f"BS-{uuid.uuid4().hex[:6].upper()}"
            insert_blackspot({
                "id": bs_id,
                "latitude": round(lat, 6),
                "longitude": round(lon, 6),
                "incident_count": len(nearby_historical),
                "first_seen": nearby_historical[0]["first_seen"],
                "last_seen": timestamp,
                "recurrence_score": 65.0,
                "status": "ACTIVE_BLACKSPOT",
                "remediation_history": "Repeated dumping relapses identified by passive sensing passes."
            })

        update_incident(incident_id, {"is_blackspot": 1})
