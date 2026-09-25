import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from backend.models import ObservationCreate
from backend.spatial_engine import cluster_observation, haversine_distance
from backend.vlm_verifier import verify_candidate_crop
from backend.policy_engine import evaluate_incident_policy
from backend.database import (
    insert_observation,
    update_observation_incident,
    get_incident,
    get_all_incidents,
    clear_database,
    insert_blackspot
)

# Realistic Bengaluru (Indiranagar / Ward 154) coordinates
SCENARIO_STEPS = [
    {
        "step": 1,
        "name": "Pass 1: Rider R-01 First Detection",
        "description": "Rider R-01 (Delivery Partner) captures roadside garbage on 100 Feet Road.",
        "vehicle_id": "R01-BLR-FLEET",
        "vehicle_name": "Delivery Partner R-01",
        "lat": 12.971920,
        "lon": 77.641210,
        "image_url": "/static/sample_images/mixed_waste_blurred.jpg",
        "raw_image_url": "/static/sample_images/mixed_waste_raw.jpg",
        "edge_confidence": 0.88,
        "gps_accuracy": 3.2,
        "category_hint": "mixed_waste",
        "time_offset_mins": 0
    },
    {
        "step": 2,
        "name": "Pass 2: Independent Vehicle R-02 Corroboration",
        "description": "Rider R-02 (Courier Van) passes 12 meters from previous spot 22 minutes later.",
        "vehicle_id": "R02-BLR-FLEET",
        "vehicle_name": "Courier Van R-02",
        "lat": 12.971990,
        "lon": 77.641150,
        "image_url": "/static/sample_images/mixed_waste_blurred.jpg",
        "raw_image_url": "/static/sample_images/mixed_waste_raw.jpg",
        "edge_confidence": 0.91,
        "gps_accuracy": 2.8,
        "category_hint": "mixed_waste",
        "time_offset_mins": 22
    },
    {
        "step": 3,
        "name": "Pass 3: False-Positive Filter (Stray Animal)",
        "description": "Cab R-03 camera triggers on animal near curb at CMH Road.",
        "vehicle_id": "R03-BLR-FLEET",
        "vehicle_name": "City Cab R-03",
        "lat": 12.978520,
        "lon": 77.643010,
        "image_url": "/static/sample_images/animal_blurred.jpg",
        "raw_image_url": "/static/sample_images/animal_raw.jpg",
        "edge_confidence": 0.79,
        "gps_accuracy": 4.1,
        "category_hint": "animal",
        "time_offset_mins": 35
    },
    {
        "step": 4,
        "name": "Pass 4: C&D Waste Triage (Human Review)",
        "description": "Rider R-01 spots unmortared construction debris obstructing pedestrian pathway.",
        "vehicle_id": "R01-BLR-FLEET",
        "vehicle_name": "Delivery Partner R-01",
        "lat": 12.974050,
        "lon": 77.635120,
        "image_url": "/static/sample_images/construction_blurred.jpg",
        "raw_image_url": "/static/sample_images/construction_raw.jpg",
        "edge_confidence": 0.85,
        "gps_accuracy": 3.6,
        "category_hint": "construction_debris",
        "time_offset_mins": 48
    },
    {
        "step": 5,
        "name": "Pass 5: Urgent Overflowing Municipal Bin",
        "description": "Rider R-02 detects overflowing public bin near Domlur junction.",
        "vehicle_id": "R02-BLR-FLEET",
        "vehicle_name": "Courier Van R-02",
        "lat": 12.961120,
        "lon": 77.639140,
        "image_url": "/static/sample_images/overflowing_bin_blurred.jpg",
        "raw_image_url": "/static/sample_images/overflowing_bin_raw.jpg",
        "edge_confidence": 0.94,
        "gps_accuracy": 2.5,
        "category_hint": "overflowing_bin",
        "time_offset_mins": 60
    },
    {
        "step": 6,
        "name": "Pass 6: Relapse at Historical Blackspot",
        "description": "Rider R-03 detects fresh garbage at a recurrent dump site on 12th Main.",
        "vehicle_id": "R03-BLR-FLEET",
        "vehicle_name": "City Cab R-03",
        "lat": 12.969150,
        "lon": 77.640200,
        "image_url": "/static/sample_images/mixed_waste_blurred.jpg",
        "raw_image_url": "/static/sample_images/mixed_waste_raw.jpg",
        "edge_confidence": 0.92,
        "gps_accuracy": 3.0,
        "category_hint": "mixed_waste",
        "time_offset_mins": 75
    }
]

class FleetSimulator:
    def __init__(self):
        self.current_step = 0

    def get_status(self) -> Dict[str, Any]:
        return {
            "current_step": self.current_step,
            "total_steps": len(SCENARIO_STEPS),
            "next_scenario": SCENARIO_STEPS[self.current_step] if self.current_step < len(SCENARIO_STEPS) else None
        }

    def reset(self):
        clear_database()
        self.current_step = 0

        # Seed pre-existing historical blackspot to demonstrate relapse detection
        # Spot at 12th Main had 2 historical cleared incidents in previous week
        hist_time_1 = (datetime.now() - timedelta(days=7)).isoformat()
        hist_time_2 = (datetime.now() - timedelta(days=3)).isoformat()
        
        insert_blackspot({
            "id": "BS-IND-01",
            "latitude": 12.969150,
            "longitude": 77.640200,
            "incident_count": 2,
            "first_seen": hist_time_1,
            "last_seen": hist_time_2,
            "recurrence_score": 75.0,
            "status": "CHRONIC_RELAPSE",
            "remediation_history": "Site cleared twice previously by BBMP compactors. Commercial eateries repeatedly dump after 10 PM."
        })

        return {"message": "Simulation reset. Historical blackspots seeded.", "current_step": 0}

    def execute_next_step(self) -> Dict[str, Any]:
        if self.current_step >= len(SCENARIO_STEPS):
            return {"message": "Scenario completed. Reset to run again.", "finished": True}

        step_data = SCENARIO_STEPS[self.current_step]
        result = self.process_step(step_data)
        self.current_step += 1
        return result

    def execute_corridor_step(self, corridor_id: str) -> Dict[str, Any]:
        mapping = {
            "CORR-100FT": 0,
            "CORR-CMH": 2,
            "CORR-12MAIN": 3,
            "CORR-DOMLUR": 4,
            "CORR-8CROSS": 5,
        }
        idx = mapping.get(corridor_id, 0)
        if idx < len(SCENARIO_STEPS):
            step_data = SCENARIO_STEPS[idx]
            result = self.process_step(step_data)
            return result
        return {"message": "Invalid corridor id"}

    def process_step(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        obs_id = f"OBS-{uuid.uuid4().hex[:8].upper()}"
        ts = (datetime.now() - timedelta(minutes=(75 - step_data["time_offset_mins"]))).isoformat()

        # Step 1: VLM Verification
        vlm_res = verify_candidate_crop(step_data["image_url"], step_data.get("category_hint"))

        # Step 2: Spatial Clustering
        initial_status = "pending_corroboration"
        if vlm_res.triage_decision == "REJECT":
            initial_status = "rejected"
        elif vlm_res.triage_decision == "HUMAN_REVIEW":
            initial_status = "human_review_required"

        incident_id, is_new, distance = cluster_observation(
            obs_id=obs_id,
            vehicle_id=step_data["vehicle_id"],
            lat=step_data["lat"],
            lon=step_data["lon"],
            category=vlm_res.category,
            timestamp=ts,
            initial_status=initial_status
        )

        # Step 3: Insert Observation
        insert_observation({
            "id": obs_id,
            "vehicle_id": step_data["vehicle_id"],
            "timestamp": ts,
            "latitude": step_data["lat"],
            "longitude": step_data["lon"],
            "image_url": step_data["image_url"],
            "raw_image_url": step_data.get("raw_image_url"),
            "edge_confidence": step_data["edge_confidence"],
            "category": vlm_res.category,
            "extent": vlm_res.extent,
            "blocks_path": 1 if vlm_res.blocks_path else 0,
            "vlm_confidence": vlm_res.confidence,
            "triage_action": vlm_res.triage_decision,
            "privacy_blurred": 1,
            "gps_accuracy": step_data["gps_accuracy"],
            "incident_id": incident_id
        })

        # Step 4: Deterministic Policy Evaluation
        policy_res = evaluate_incident_policy(incident_id)

        return {
            "step_executed": step_data["step"],
            "scenario_name": step_data["name"],
            "description": step_data["description"],
            "vehicle": step_data["vehicle_name"],
            "observation_id": obs_id,
            "incident_id": incident_id,
            "is_new_incident": is_new,
            "cluster_distance_meters": distance,
            "vlm_result": vlm_res.dict(),
            "policy_result": policy_res.dict(),
            "coordinates": {"lat": step_data["lat"], "lon": step_data["lon"]}
        }

SIMULATOR = FleetSimulator()
