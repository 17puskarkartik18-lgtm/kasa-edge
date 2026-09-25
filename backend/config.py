import os
from pydantic import BaseModel

class CivicGovernanceConfig(BaseModel):
    civic_authority: str = "Greater Bengaluru Authority (GBA)"
    corporation: str = "BBMP - East Zone"
    default_ward: int = 154  # Shanthi Nagar / Indiranagar division
    intake_channel: str = "Sahaaya 2.0 API"
    cluster_radius_meters: float = 30.0
    independent_vehicles_for_confirmation: int = 2
    recurrence_threshold_for_blackspot: int = 2
    gemini_model: str = "gemini-1.5-flash"
    gemini_model_verified: bool = False

CONFIG = CivicGovernanceConfig()

def get_gemini_key() -> str:
    return os.environ.get("GEMINI_API_KEY", "")

def set_gemini_key(key: str):
    os.environ["GEMINI_API_KEY"] = key.strip()

DATABASE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "kasa_edge.db")
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
