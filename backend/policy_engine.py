import uuid
import json
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from backend.config import CONFIG
from backend.models import PolicyEvaluationResult
from backend.database import (
    get_incident,
    update_incident,
    get_observations_for_incident,
    insert_ticket,
    get_all_tickets
)

def evaluate_incident_policy(incident_id: str) -> PolicyEvaluationResult:
    """
    Applies deterministic business rules to an incident cluster.
    Decides whether the incident is confirmed, rejected, flagged for review,
    or requires additional independent passes before ticket generation.
    """
    incident = get_incident(incident_id)
    if not incident:
        raise ValueError(f"Incident {incident_id} not found")

    observations = get_observations_for_incident(incident_id)
    obs_count = len(observations)
    unique_vehicles = len(set(o["vehicle_id"] for o in observations))
    prior_status = incident["status"]

    # Gather category breakdown
    categories = [o["category"] for o in observations]
    primary_category = max(set(categories), key=categories.count) if categories else incident["category"]
    any_blocks_path = any(bool(o["blocks_path"]) for o in observations)
    is_blackspot = bool(incident.get("is_blackspot", 0))

    rationale: List[str] = []
    updated_status = prior_status
    priority = "LOW"
    persistence_score = 0.0
    ticket_generated = False
    ticket_id = incident.get("ticket_id")

    # RULE 0: Clean Road / Patrol Clearance
    if primary_category == "clean_road":
        updated_status = "cleared" if prior_status == "confirmed" else "rejected"
        persistence_score = 0.0
        priority = "NONE"
        rationale.append("CLEAN ROAD DETECTED: Visual inspection confirmed zero roadside municipal waste accumulation.")
        rationale.append("Civic spam protection: Zero municipal tickets dispatched for clean street patrols.")

    # RULE 1: Stray Animal / Non-waste filter
    elif primary_category == "animal":
        updated_status = "rejected"
        persistence_score = 0.0
        priority = "NONE"
        rationale.append("REJECTED: VLM detected stray animal or live fauna (curbside non-waste).")
        rationale.append("Civic spam protection: Zero municipal tickets dispatched for non-waste occurrences.")

    # RULE 2: Construction & Demolition Debris
    elif primary_category == "construction_debris":
        updated_status = "human_review_required"
        persistence_score = 40.0
        priority = "MEDIUM"
        rationale.append("FLAGGED FOR REVIEW: Construction & Demolition (C&D) debris requires specialized heavy haulage.")
        rationale.append("Forwarded to BBMP Engineering Department review queue instead of standard MSW sweepers.")

    # RULE 3: Overflowing Municipal Bin
    elif primary_category == "overflowing_bin":
        updated_status = "confirmed"
        priority = "URGENT"
        persistence_score = 90.0
        rationale.append("CONFIRMED: Overflowing public municipal container.")
        rationale.append("High civic priority: Direct auto-dispatch to local ward waste contractor.")

        if not ticket_id:
            ticket_id, ticket_generated = _issue_civic_ticket(incident, observations, priority, rationale)

    # RULE 4: Mixed Waste / Roadside Garbage Dump
    else:
        # Calculate Explainable Persistence Score (0 - 100)
        vehicle_points = min(unique_vehicles, 3) * 20.0       # Up to 60 pts
        observation_points = min(obs_count, 4) * 5.0          # Up to 20 pts
        path_penalty = 10.0 if any_blocks_path else 0.0        # +10 pts if pedestrian path blocked
        blackspot_penalty = 10.0 if is_blackspot else 0.0      # +10 pts if recurring spot

        persistence_score = round(vehicle_points + observation_points + path_penalty + blackspot_penalty, 1)

        # Deterministic Corroboration Threshold
        if unique_vehicles >= CONFIG.independent_vehicles_for_confirmation or persistence_score >= 55.0:
            updated_status = "confirmed"
            if persistence_score >= 75.0 or any_blocks_path:
                priority = "HIGH"
            else:
                priority = "MEDIUM"

            rationale.append(f"CONFIRMED: Corroborated across {unique_vehicles} independent vehicle passes ({', '.join(set(o['vehicle_id'] for o in observations))}).")
            rationale.append(f"Persistence score reached {persistence_score}/100 with {obs_count} total observations.")
            if any_blocks_path:
                rationale.append("Path Obstruction: Rubbish is physically encroaching on pedestrian walkway.")
            if is_blackspot:
                rationale.append("Blackspot History: Location has verified relapse history (chronic dumping site).")

            if not ticket_id:
                ticket_id, ticket_generated = _issue_civic_ticket(incident, observations, priority, rationale)
        else:
            updated_status = "pending_corroboration"
            priority = "LOW"
            rationale.append(f"PENDING CORROBORATION: Single vehicle pass recorded ({observations[0]['vehicle_id']}).")
            rationale.append("To prevent spurious tickets, awaiting second independent vehicle confirmation.")

    # Update database record
    update_incident(incident_id, {
        "status": updated_status,
        "priority": priority,
        "persistence_score": persistence_score,
        "category": primary_category,
        "ticket_id": ticket_id
    })

    return PolicyEvaluationResult(
        incident_id=incident_id,
        prior_status=prior_status,
        updated_status=updated_status,
        persistence_score=persistence_score,
        unique_vehicles=unique_vehicles,
        observation_count=obs_count,
        ticket_generated=ticket_generated,
        ticket_id=ticket_id,
        decision_rationale=rationale
    )

def _issue_civic_ticket(incident: Dict[str, Any], observations: List[Dict[str, Any]], priority: str, rationale: List[str]) -> Tuple[str, bool]:
    ticket_id = f"GBA-SHY-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
    evidence_url = observations[-1]["image_url"] if observations else ""
    
    summary = {
        "incident_id": incident["id"],
        "coordinates": {"lat": incident["latitude"], "lon": incident["longitude"]},
        "observation_count": len(observations),
        "vehicle_ids": list(set(o["vehicle_id"] for o in observations)),
        "first_seen": incident["first_seen"],
        "last_seen": incident["last_seen"],
        "rationale": rationale,
        "evidence_crops": [o["image_url"] for o in observations[-3:]]
    }

    insert_ticket({
        "id": ticket_id,
        "incident_id": incident["id"],
        "civic_authority": incident["civic_authority"],
        "corporation": incident["corporation"],
        "ward_number": incident["ward_number"],
        "intake_channel": CONFIG.intake_channel,
        "priority": priority,
        "evidence_url": evidence_url,
        "evidence_summary": json.dumps(summary),
        "status": "ISSUED",
        "created_at": datetime.now().isoformat()
    })

    return ticket_id, True
