import sqlite3
import os
import json
from typing import List, Optional, Dict, Any
from backend.config import DATABASE_PATH

def get_db_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        image_url TEXT NOT NULL,
        raw_image_url TEXT,
        video_url TEXT,
        edge_confidence REAL NOT NULL,
        category TEXT NOT NULL,
        extent TEXT NOT NULL,
        blocks_path INTEGER NOT NULL,
        vlm_confidence REAL NOT NULL,
        triage_action TEXT NOT NULL,
        privacy_blurred INTEGER NOT NULL,
        gps_accuracy REAL NOT NULL,
        incident_id TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        location_name TEXT,
        video_url TEXT,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        observation_count INTEGER NOT NULL,
        vehicle_count INTEGER NOT NULL,
        persistence_score REAL NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        priority TEXT NOT NULL,
        ward_number INTEGER NOT NULL,
        corporation TEXT NOT NULL,
        civic_authority TEXT NOT NULL,
        ticket_id TEXT,
        is_blackspot INTEGER DEFAULT 0
    );
    """)

    try:
        cursor.execute("ALTER TABLE incidents ADD COLUMN location_name TEXT;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE observations ADD COLUMN video_url TEXT;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE incidents ADD COLUMN video_url TEXT;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE incidents ADD COLUMN gps_source TEXT;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE observations ADD COLUMN gps_source TEXT;")
    except Exception:
        pass

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS blackspots (
        id TEXT PRIMARY KEY,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        incident_count INTEGER NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        recurrence_score REAL NOT NULL,
        status TEXT NOT NULL,
        remediation_history TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        civic_authority TEXT NOT NULL,
        corporation TEXT NOT NULL,
        ward_number INTEGER NOT NULL,
        intake_channel TEXT NOT NULL,
        priority TEXT NOT NULL,
        evidence_url TEXT NOT NULL,
        evidence_summary TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_obs_incident ON observations(incident_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_obs_coords ON observations(latitude, longitude);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_inc_coords ON incidents(latitude, longitude);")

    conn.commit()
    conn.close()

def insert_observation(data: Dict[str, Any]):
    if "video_url" not in data:
        data["video_url"] = None
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO observations (
            id, vehicle_id, timestamp, latitude, longitude,
            image_url, raw_image_url, video_url, edge_confidence, category,
            extent, blocks_path, vlm_confidence, triage_action,
            privacy_blurred, gps_accuracy, incident_id
        ) VALUES (
            :id, :vehicle_id, :timestamp, :latitude, :longitude,
            :image_url, :raw_image_url, :video_url, :edge_confidence, :category,
            :extent, :blocks_path, :vlm_confidence, :triage_action,
            :privacy_blurred, :gps_accuracy, :incident_id
        )
    """, data)
    conn.commit()
    conn.close()

def update_observation_incident(obs_id: str, incident_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE observations SET incident_id = ? WHERE id = ?", (incident_id, obs_id))
    conn.commit()
    conn.close()

def insert_incident(data: Dict[str, Any]):
    if not data.get("location_name"):
        from backend.spatial_engine import resolve_location_name
        data["location_name"] = resolve_location_name(data["latitude"], data["longitude"])
    if "video_url" not in data:
        data["video_url"] = None

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO incidents (
            id, latitude, longitude, location_name, video_url, category, status,
            observation_count, vehicle_count, persistence_score,
            first_seen, last_seen, priority, ward_number,
            corporation, civic_authority, ticket_id, is_blackspot
        ) VALUES (
            :id, :latitude, :longitude, :location_name, :video_url, :category, :status,
            :observation_count, :vehicle_count, :persistence_score,
            :first_seen, :last_seen, :priority, :ward_number,
            :corporation, :civic_authority, :ticket_id, :is_blackspot
        )
    """, data)
    conn.commit()
    conn.close()

def update_incident(incident_id: str, fields: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    set_clause = ", ".join([f"{k} = :{k}" for k in fields.keys()])
    fields["id"] = incident_id
    cursor.execute(f"UPDATE incidents SET {set_clause} WHERE id = :id", fields)
    conn.commit()
    conn.close()

def get_incident(incident_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    if not d.get("location_name"):
        from backend.spatial_engine import resolve_location_name
        d["location_name"] = resolve_location_name(d["latitude"], d["longitude"])
    return d

def get_all_incidents() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents ORDER BY last_seen DESC")
    rows = cursor.fetchall()
    conn.close()
    from backend.spatial_engine import resolve_location_name
    results = []
    for r in rows:
        d = dict(r)
        if not d.get("location_name"):
            d["location_name"] = resolve_location_name(d["latitude"], d["longitude"])
        results.append(d)
    return results

def get_observations_for_incident(incident_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM observations WHERE incident_id = ? ORDER BY timestamp ASC", (incident_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_all_observations() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM observations ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def insert_ticket(data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO tickets (
            id, incident_id, civic_authority, corporation,
            ward_number, intake_channel, priority,
            evidence_url, evidence_summary, status, created_at
        ) VALUES (
            :id, :incident_id, :civic_authority, :corporation,
            :ward_number, :intake_channel, :priority,
            :evidence_url, :evidence_summary, :status, :created_at
        )
    """, data)
    conn.commit()
    conn.close()

def get_all_tickets() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tickets ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    res = []
    for r in rows:
        d = dict(r)
        if isinstance(d.get("evidence_summary"), str):
            try:
                d["evidence_summary"] = json.loads(d["evidence_summary"])
            except Exception:
                pass
        res.append(d)
    return res

def insert_blackspot(data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO blackspots (
            id, latitude, longitude, incident_count,
            first_seen, last_seen, recurrence_score,
            status, remediation_history
        ) VALUES (
            :id, :latitude, :longitude, :incident_count,
            :first_seen, :last_seen, :recurrence_score,
            :status, :remediation_history
        )
    """, data)
    conn.commit()
    conn.close()

def get_all_blackspots() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM blackspots ORDER BY recurrence_score DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def clear_database():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM observations;")
    cursor.execute("DELETE FROM incidents;")
    cursor.execute("DELETE FROM blackspots;")
    cursor.execute("DELETE FROM tickets;")
    conn.commit()
    conn.close()
