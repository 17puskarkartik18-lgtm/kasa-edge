import os
import re
import uuid
import math
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
import cv2
import numpy as np
from PIL import Image, ImageFilter

from backend.config import STATIC_DIR, CONFIG
from backend.spatial_engine import resolve_location_name, cluster_observation, KNOWN_CORRIDORS
from backend.vlm_verifier import verify_candidate_crop
from backend.policy_engine import evaluate_incident_policy
from backend.database import insert_observation, update_incident, get_incident
from backend.privacy import apply_edge_privacy_filter

VIDEOS_DIR = os.path.join(STATIC_DIR, "uploads", "videos")
SAMPLE_VIDEOS_DIR = os.path.join(STATIC_DIR, "sample_videos")

os.makedirs(VIDEOS_DIR, exist_ok=True)
os.makedirs(SAMPLE_VIDEOS_DIR, exist_ok=True)

def parse_iso6709_string(text_or_bytes: bytes) -> Optional[Tuple[float, float, Optional[float]]]:
    """
    Parses ISO 6709 string representation commonly used in QuickTime / MP4 containers:
    Format: +DD.DDDD+DDD.DDDD/ or +DD.DDDD+DDD.DDDD+AAA.AAA/
    Examples:
        +12.9719+077.6412/
        +12.9785+077.6430+915.200/
    """
    pattern = rb'([+-]\d{2,3}(?:\.\d+)?)([+-]\d{2,3}(?:\.\d+)?)(?:([+-]\d+(?:\.\d+)?))?/'
    matches = re.findall(pattern, text_or_bytes)
    for m in matches:
        try:
            lat = float(m[0])
            lon = float(m[1])
            alt = float(m[2]) if m[2] else None
            if -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0:
                # Valid latitude and longitude range
                return lat, lon, alt
        except Exception:
            continue
    return None

def parse_xmp_gps(raw_bytes: bytes) -> Optional[Tuple[float, float]]:
    """
    Extracts GPS coordinates from XMP / XML blocks inside video metadata.
    """
    try:
        text = raw_bytes.decode('utf-8', errors='ignore')
        # Check standard XMP GPS tags
        lat_match = re.search(r'GPSLatitude="([+-]?\d+(?:\.\d+)?)"', text)
        lon_match = re.search(r'GPSLongitude="([+-]?\d+(?:\.\d+)?)"', text)
        if lat_match and lon_match:
            lat = float(lat_match.group(1))
            lon = float(lon_match.group(1))
            if -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0:
                return lat, lon
        
        # Check exif:GPSLatitude>12.971920< pattern
        lat_m2 = re.search(r'<exif:GPSLatitude>([+-]?\d+(?:\.\d+)?)</exif:GPSLatitude>', text)
        lon_m2 = re.search(r'<exif:GPSLongitude>([+-]?\d+(?:\.\d+)?)</exif:GPSLongitude>', text)
        if lat_m2 and lon_m2:
            lat = float(lat_m2.group(1))
            lon = float(lon_m2.group(1))
            if -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0:
                return lat, lon
    except Exception:
        pass
    return None

def extract_video_metadata(video_path: str) -> Dict[str, Any]:
    """
    Extracts duration, resolution, frame rate, and embedded GPS metadata from video container.
    """
    meta: Dict[str, Any] = {
        "has_gps": False,
        "latitude": None,
        "longitude": None,
        "altitude": None,
        "gps_source": "NONE",
        "duration_sec": 0.0,
        "fps": 0.0,
        "frame_count": 0,
        "width": 0,
        "height": 0,
        "location_name": "Unknown Location"
    }

    # 1. OpenCV Stream Properties
    cap = cv2.VideoCapture(video_path)
    if cap.isOpened():
        meta["fps"] = round(cap.get(cv2.CAP_PROP_FPS), 2)
        meta["frame_count"] = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if meta["fps"] > 0 and meta["frame_count"] > 0:
            meta["duration_sec"] = round(meta["frame_count"] / meta["fps"], 2)
        meta["width"] = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        meta["height"] = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

    # 2. Extract Embedded GPS Metadata (Scan header bytes)
    try:
        with open(video_path, 'rb') as f:
            # Read first 1MB and last 1MB where moov/udta atoms usually live
            head = f.read(1024 * 1024)
            f.seek(0, os.SEEK_END)
            size = f.tell()
            tail_offset = max(0, size - (1024 * 1024))
            f.seek(tail_offset)
            tail = f.read()

        scan_bytes = head + tail

        # Check QuickTime ISO 6709 location atom
        iso_res = parse_iso6709_string(scan_bytes)
        if iso_res:
            meta["has_gps"] = True
            meta["latitude"] = round(iso_res[0], 6)
            meta["longitude"] = round(iso_res[1], 6)
            meta["altitude"] = round(iso_res[2], 1) if iso_res[2] else None
            meta["gps_source"] = "QUICKTIME_ISO6709"
        else:
            # Check XMP metadata
            xmp_res = parse_xmp_gps(scan_bytes)
            if xmp_res:
                meta["has_gps"] = True
                meta["latitude"] = round(xmp_res[0], 6)
                meta["longitude"] = round(xmp_res[1], 6)
                meta["gps_source"] = "XMP_METADATA"

        if meta["has_gps"] and meta["latitude"] and meta["longitude"]:
            meta["location_name"] = resolve_location_name(meta["latitude"], meta["longitude"])
    except Exception as e:
        print(f"Error extracting video GPS metadata: {e}")

    return meta

def extract_video_frames(
    video_path: str,
    output_prefix: str,
    num_frames: int = 3
) -> List[Dict[str, Any]]:
    """
    Extracts evenly spaced candidate waste crop frames, runs on-device privacy blurring,
    and returns metadata for each frame.
    """
    extracted = []
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return extracted

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    if total_frames <= 0:
        total_frames = 30

    # Determine frame indices to sample
    if total_frames <= num_frames:
        indices = list(range(total_frames))
    else:
        step = total_frames // (num_frames + 1)
        indices = [step * (i + 1) for i in range(num_frames)]

    for idx, frame_no in enumerate(indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
        ret, frame = cap.read()
        if not ret or frame is None:
            continue

        raw_filename = f"{output_prefix}_frame_{idx+1}_raw.jpg"
        blurred_filename = f"{output_prefix}_frame_{idx+1}_blurred.jpg"

        raw_path = os.path.join(VIDEOS_DIR, raw_filename)
        blurred_path = os.path.join(VIDEOS_DIR, blurred_filename)

        # Save raw frame
        cv2.imwrite(raw_path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), 88])

        # Apply edge privacy filter (Gaussian blur on faces and license plates)
        apply_edge_privacy_filter(raw_path, blurred_path)

        # Calculate edge sharpness / confidence
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        edge_conf = min(0.98, max(0.75, round(0.70 + (min(lap_var, 500) / 2000.0), 2)))

        timestamp_sec = round(frame_no / fps, 2)

        extracted.append({
            "frame_index": idx + 1,
            "timestamp_sec": timestamp_sec,
            "raw_image_url": f"/static/uploads/videos/{raw_filename}",
            "image_url": f"/static/uploads/videos/{blurred_filename}",
            "edge_confidence": edge_conf
        })

    cap.release()
    return extracted

def embed_iso6709_in_mp4(mp4_bytes: bytes, lat: float, lon: float, alt: float = 920.0) -> bytes:
    """
    Embeds ISO 6709 QuickTime location atom into an MP4 byte stream.
    """
    iso_str = f"{lat:+08.4f}{lon:+09.4f}{alt:+08.1f}/".encode('utf-8')
    atom_data = b'\x15\xc7' + iso_str
    atom_len = len(atom_data) + 8
    atom = atom_len.to_bytes(4, 'big') + b'\xa9xyz' + atom_data
    meta_tag = b'com.apple.quicktime.location.ISO6709\x00' + iso_str
    return mp4_bytes + atom + meta_tag

def ensure_sample_videos():
    """
    Generates realistic Bengaluru dashcam clips with embedded GPS metadata for instant demoing.
    """
    samples = [
        {
            "filename": "dashcam_100ft_waste.mp4",
            "lat": 12.971920,
            "lon": 77.641210,
            "corridor": "100 Feet Road, Indiranagar",
            "sample_img": "mixed_waste_raw.jpg",
            "hud_text": "CAM-01 // 100 FT RD // 12.97192N 77.64121E // SPEED: 24 KM/H"
        },
        {
            "filename": "dashcam_domlur_bin.mp4",
            "lat": 12.961120,
            "lon": 77.639140,
            "corridor": "Domlur Flyover Junction",
            "sample_img": "overflowing_bin_raw.jpg",
            "hud_text": "VAN-02 // DOMLUR JUNCTION // 12.96112N 77.63914E // SPEED: 32 KM/H"
        },
        {
            "filename": "dashcam_cmh_animal.mp4",
            "lat": 12.978520,
            "lon": 77.643010,
            "corridor": "CMH Road, Indiranagar",
            "sample_img": "animal_raw.jpg",
            "hud_text": "CAB-03 // CMH METRO RD // 12.97852N 77.64301E // SPEED: 18 KM/H"
        }
    ]

    for s in samples:
        target_path = os.path.join(SAMPLE_VIDEOS_DIR, s["filename"])
        if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
            continue

        # Load sample base image
        img_path = os.path.join(STATIC_DIR, "sample_images", s["sample_img"])
        if not os.path.exists(img_path):
            continue

        base_img = cv2.imread(img_path)
        if base_img is None:
            continue

        h, w, _ = base_img.shape
        w = (w // 2) * 2
        h = (h // 2) * 2
        base_img = cv2.resize(base_img, (w, h))

        tmp_path = target_path + ".tmp.mp4"
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        fps = 15.0
        duration_frames = 45  # 3 seconds clip
        out = cv2.VideoWriter(tmp_path, fourcc, fps, (w, h))

        for f_idx in range(duration_frames):
            frame = base_img.copy()

            # Slight simulated dashcam vibration and zoom motion
            shift_x = int(math.sin(f_idx * 0.4) * 3)
            shift_y = int(math.cos(f_idx * 0.4) * 2)
            M = np.float32([[1, 0, shift_x], [0, 1, shift_y]])
            frame = cv2.warpAffine(frame, M, (w, h))

            # Render tactical dashcam HUD telemetry bar at bottom
            overlay = frame.copy()
            cv2.rectangle(overlay, (0, h - 36), (w, h), (10, 15, 25), -1)
            cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

            timestamp_str = f"2026-09-25 {datetime.now().strftime('%H:%M:%S')}.{f_idx*66:03d} GMT+0530"
            cv2.putText(frame, s["hud_text"], (15, h - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 245, 160), 1, cv2.LINE_AA)
            cv2.putText(frame, timestamp_str, (15, h - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (180, 200, 220), 1, cv2.LINE_AA)

            # Red REC recording blinking dot
            if (f_idx // 8) % 2 == 0:
                cv2.circle(frame, (w - 60, 25), 6, (0, 0, 255), -1)
                cv2.putText(frame, "REC", (w - 48, 29), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 255), 1, cv2.LINE_AA)

            out.write(frame)

        out.release()

        # Embed ISO 6709 GPS metadata
        with open(tmp_path, 'rb') as f:
            raw_bytes = f.read()

        tagged_bytes = embed_iso6709_in_mp4(raw_bytes, s["lat"], s["lon"])
        with open(target_path, 'wb') as f:
            f.write(tagged_bytes)

        if os.path.exists(tmp_path):
            os.remove(tmp_path)
