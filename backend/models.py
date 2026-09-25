from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ObservationCreate(BaseModel):
    vehicle_id: str
    latitude: float
    longitude: float
    timestamp: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    edge_confidence: float = 0.85
    gps_accuracy: float = 4.5
    raw_image_url: Optional[str] = None
    privacy_blurred: bool = True

class VLMVerificationResult(BaseModel):
    category: str  # mixed_waste | overflowing_bin | construction_debris | animal | clean_road
    extent: str = "medium"  # small | medium | large
    blocks_path: bool = False
    confidence: float = 0.90
    verification_notes: str = ""
    triage_decision: str = "ACCEPT"  # ACCEPT | REJECT | HUMAN_REVIEW

class ObservationRecord(BaseModel):
    id: str
    vehicle_id: str
    timestamp: str
    latitude: float
    longitude: float
    image_url: str
    video_url: Optional[str] = None
    gps_source: Optional[str] = None
    raw_image_url: Optional[str] = None
    edge_confidence: float
    category: str
    extent: str
    blocks_path: bool
    vlm_confidence: float
    triage_action: str
    privacy_blurred: bool
    gps_accuracy: float
    incident_id: Optional[str] = None

class IncidentRecord(BaseModel):
    id: str
    latitude: float
    longitude: float
    location_name: Optional[str] = "Ward 154 Corridor, Indiranagar"
    category: str
    status: str  # pending_corroboration | confirmed | human_review_required | rejected | cleared
    observation_count: int
    vehicle_count: int
    persistence_score: float
    first_seen: str
    last_seen: str
    priority: str
    ward_number: int
    corporation: str
    civic_authority: str
    ticket_id: Optional[str] = None
    is_blackspot: bool = False
    video_url: Optional[str] = None
    gps_source: Optional[str] = None
    observations: Optional[List[ObservationRecord]] = None

class BlackspotRecord(BaseModel):
    id: str
    latitude: float
    longitude: float
    incident_count: int
    first_seen: str
    last_seen: str
    recurrence_score: float
    status: str
    remediation_history: Optional[str] = None

class CivicTicketRecord(BaseModel):
    id: str
    incident_id: str
    civic_authority: str
    corporation: str
    ward_number: int
    intake_channel: str
    priority: str
    evidence_url: str
    evidence_summary: Dict[str, Any]
    status: str
    created_at: str

class PolicyEvaluationResult(BaseModel):
    incident_id: str
    prior_status: str
    updated_status: str
    persistence_score: float
    unique_vehicles: int
    observation_count: int
    ticket_generated: bool
    ticket_id: Optional[str] = None
    decision_rationale: List[str]
