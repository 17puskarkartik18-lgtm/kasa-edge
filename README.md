# Kasa.Edge: Passive Urban-Waste Sensing & Civic-Triage System

> *"Don't force citizens to report garbage. Let the city observe itself."*

---

## 📌 Executive Summary

Traditional civic grievance platforms (such as Sahaaya) rely on **active citizen reporting**, creating significant friction (stopping, photographing, geotagging, submitting), duplicate complaints, and coverage blind spots in neglected wards.

**Kasa.Edge** turns existing gig-economy vehicle fleets (delivery riders, couriers, cabs) into a **passive urban sensing network**. Vehicle-mounted dashcams continuously scan the road curb in the background without requiring any rider interaction.

---

## 🏗️ 5-Stage System Architecture

```text
[1. Fleet Camera Stream]
         │ (Continuous video strictly stays in memory on-device)
         ▼
[2. Edge Detector & Privacy Filter]
         │ (Face & license plate anonymization; crops ≤ 150 KB)
         ▼
[3. Cloud VLM Verifier (Gemini)]
         │ (Extracts structured JSON: category, extent, path blockage)
         ▼
[4. Spatial Engine (30m Haversine)]
         │ (Correlates multi-pass observations into spatial Incident clusters)
         ▼
[5. Deterministic Policy & Civic Triage Engine]
         │ (Requires ≥ 2 independent vehicle passes before ticketing)
         ▼
[Greater Bengaluru Authority / BBMP Sahaaya 2.0 Dispatch]
```

---

## 📊 Data Abstraction Hierarchy

1. **Observation**: A single camera pass crop captured by a vehicle (`OBS-XXXX`). Contains timestamp, vehicle ID, GPS, and edge detection score.
2. **Incident**: A geographic cluster of observations within a **30-meter Haversine radius** (`INC-XXXX`).
3. **Blackspot**: An incident site showing a verified relapse history ($\ge 2$ recurrences across separate cycles).
4. **Civic Ticket**: An official, verified evidence package formatted for municipal compactor dispatch (`GBA-SHY-2026-XXXX`).

---

## 🛡️ Two-Tiered Verification & Triage Matrix

| Scene Type | VLM Classification | System Action | Policy Rationale |
| :--- | :--- | :--- | :--- |
| **Stray Animal** | `animal` | **REJECT** | Curbside dog/cow is non-waste fauna. Prevents spurious civic complaints. |
| **C&D Debris** | `construction_debris` | **HUMAN REVIEW** | Construction rubble requires heavy tipper trucks, not regular municipal sweepers. |
| **Roadside Dump** | `mixed_waste` | **CORROBORATE** | Evaluates persistence score; requires $\ge 2$ independent vehicle passes before dispatch. |
| **Overflowing Bin** | `overflowing_bin` | **ACCEPT (URGENT)** | Public infrastructure failure requiring immediate scheduled clearance. |

---

## 🔒 Privacy Guarantee

* **Zero Continuous Video Streaming**: Video frames never leave the moving vehicle over cellular networks.
* **Lightweight Candidate Crops**: Only bounded candidate patches ($\le 150\text{ KB}$) are transmitted.
* **On-Device Anonymization**: Faces and vehicle license plates are masked and blurred on-device prior to transmission. The dashboard includes an interactive toggle allowing inspection of the raw local buffer vs. the anonymized cloud crop.

---

## 🚀 Quickstart & Running the Application

### 1. Launch with One Command

```bash
./run.sh
```

Or run manually:

```bash
# Activate environment
source venv/bin/activate

# Start backend server
export PYTHONPATH=.
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Open your browser to: **[http://localhost:8000](http://localhost:8000)**

---

## 🎮 Simulator Walkthrough & Demo Guide

The built-in Fleet Simulator demonstrates the full lifecycle:

1. **Pass 1 (Rider R-01)**: Spots roadside garbage on 100 Feet Road. Status becomes `PENDING_CORROBORATION` (awaiting second pass to prevent spurious tickets).
2. **Pass 2 (Courier R-02)**: 22 minutes later, independent vehicle R-02 passes 10 meters away. Haversine clustering confirms spatial match! Status upgrades to `CONFIRMED`, persistence score jumps to 60, and ticket `GBA-SHY-2026-XXXX` is issued!
3. **Pass 3 (Cab R-03)**: Camera triggers on a sleeping street dog. VLM classifies as `animal` and deterministic policy rejects it (proving false-positive elimination).
4. **Pass 4 (Rider R-01)**: Spots brick rubble and cement bags. Routed to `HUMAN_REVIEW` queue for C&D specialized machinery.
5. **Pass 5 (Courier R-02)**: Spots an overflowing municipal container. Tagged `CONFIRMED` with `URGENT` priority.
6. **Pass 6 (Cab R-03)**: Dumps detected at an older cleared site. Spatial engine recognizes $\ge 2$ recurrences and flags a `CHRONIC_RELAPSE Blackspot`!
