Yes. I’ll break the **Kasa.Edge brief from the PDF** into two parts:

1. **What every component means** — in very simple terms.
2. **Exactly how you can implement it in a 36-hour hackathon**, including the architecture, tech stack, database structure, APIs, AI prompts, clustering logic, dashboard, and demo flow.

The central idea is:

> **“Don’t force citizens to report garbage. Let the city observe itself.”** fileciteturn0file0L2-L13

---

# 1. What is Kasa.Edge?

Kasa.Edge is basically an **AI-powered automatic garbage detection system for cities**.

Instead of this:

**Citizen sees garbage → takes photo → adds location → submits complaint**

you want this:

**Vehicle drives normally → camera sees road → AI notices possible garbage → AI verifies it → GPS location is attached → system checks whether it is a recurring problem → civic ticket is generated**

The PDF specifically proposes using **gig-worker vehicles** such as:

- delivery bikes
- courier vehicles
- cabs

as a distributed network of cameras. fileciteturn0file0L9-L13

So imagine 500 delivery riders moving around Bengaluru every day.

You don't need to send a dedicated garbage-inspection vehicle.

Their cameras are already moving around the city.

---

# 2. The most important concept: Passive Sensing

This is the **main innovation**.

Traditional system:

```text
Garbage
   ↓
Citizen notices
   ↓
Citizen stops
   ↓
Takes photo
   ↓
Adds location
   ↓
Reports
```

Kasa.Edge:

```text
Vehicle is already moving
        ↓
     Camera
        ↓
 Edge AI detects candidate
        ↓
 Small image crop
        ↓
 Gemini verifies
        ↓
 GPS + timestamp
        ↓
 Spatial clustering
        ↓
 Policy engine
        ↓
 Civic incident/ticket
```

The driver doesn't have to do anything.

The PDF explicitly describes this as **zero driver interaction**, with background capture while driving/charging. fileciteturn0file0L14-L23

---

# 3. Don't build the entire real-world system

This is extremely important for a **36-hour hackathon**.

You do **NOT** need:

- 500 actual riders
- actual dashcams
- real-time Bengaluru traffic
- complete municipal integration
- continuous 24-hour video processing
- production-scale AI infrastructure

Instead, build a **convincing simulator**.

Your demo can be:

```text
Pre-recorded dashcam video
          ↓
Your simulator pretends a vehicle is moving
          ↓
Detection happens
          ↓
Gemini verifies crops
          ↓
GPS coordinates are simulated
          ↓
Clustering happens
          ↓
Dashboard shows incident
          ↓
Evidence ticket generated
```

That is much more realistic for a hackathon.

---

# 4. Complete architecture

The PDF divides the system into five major stages. fileciteturn0file0L24-L47

I'd implement it like this:

```text
                    KASA.EDGE
                       │
                       ▼
             ┌──────────────────┐
             │ Dashcam Simulator│
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Edge Detector    │
             │ YOLO/OpenCV      │
             └────────┬─────────┘
                      │
                Candidate crop
                      │
                      ▼
             ┌──────────────────┐
             │ Gemini VLM       │
             │ Verification     │
             └────────┬─────────┘
                      │
               Structured JSON
                      │
                      ▼
             ┌──────────────────┐
             │ Spatial Engine   │
             │ 30m clustering   │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Policy Engine    │
             │ Rules + scoring  │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Incident/Ticket  │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Command Dashboard│
             │ Map + evidence   │
             └──────────────────┘
```

---

# 5. Component 1 — Sensing Layer

PDF:

> **Fleet Dashcams**

The idea is that a camera continuously sees the road, but the **video stays on the device**. Only small candidate images leave the device. fileciteturn0file0L24-L29

### In your hackathon

You can simulate this using a video.

For example:

```text
dashcam.mp4
```

Your Python program reads:

```python
cap = cv2.VideoCapture("dashcam.mp4")
```

Then:

```text
Frame 1
Frame 2
Frame 3
Frame 4
...
```

You process frames locally.

You don't send the whole video to Gemini.

---

# 6. Why not send the whole video to Gemini?

Because that would be:

- expensive
- slow
- bandwidth-heavy
- unnecessary
- privacy-sensitive

Instead:

```text
VIDEO
 ↓
Edge detector
 ↓
Potential garbage?
 ↓ YES
Crop only garbage region
 ↓
Gemini
```

For example:

Original:

```text
┌──────────────────────────────┐
│                              │
│      ROAD                    │
│                              │
│                █████         │
│                █ GARBAGE     │
│                █████         │
│                              │
│      BUILDINGS               │
└──────────────────────────────┘
```

Send only:

```text
┌───────────────┐
│    GARBAGE    │
│      ███      │
│      ███      │
└───────────────┘
```

The PDF specifies candidate crops of **≤150 KB** leaving the edge. fileciteturn0file0L26-L33

---

# 7. Component 2 — Edge Detector

This is your **first AI/computer-vision filter**.

Its job isn't to perfectly understand the garbage.

Its job is:

> "Does this frame contain something that might be waste?"

That's why the PDF calls it a **high-recall candidate detector**. fileciteturn0file0L30-L33

### Important distinction

You have two different AI stages.

### Stage 1

```text
Edge Detector
```

Question:

> "Could this be garbage?"

### Stage 2

```text
Gemini VLM
```

Question:

> "What exactly is this, and should the city care?"

---

# 8. What should you use for Edge Detection?

For a hackathon, you have several options.

### Option A — YOLO

Use a lightweight YOLO model.

```text
Camera frame
      ↓
YOLO
      ↓
Bounding box
```

For example:

```json
{
  "x": 420,
  "y": 270,
  "width": 160,
  "height": 130
}
```

Then crop that area.

### Option B — simple computer vision

If you don't have time to train a model, use:

- OpenCV
- motion/scene-change detection
- predefined candidate frames

### Option C — simulated detector

For the hackathon demo, you can even have predefined timestamps:

```python
candidate_frames = [
    125,
    290,
    481,
    650
]
```

When the video reaches one of those frames:

```text
Candidate detected!
```

This is acceptable for a prototype **as long as you clearly describe it as a simulator**.

---

# 9. Component 3 — Gemini VLM

This is where Gemini becomes important.

VLM = **Vision Language Model**.

It understands images.

Your edge detector might say:

> "Something suspicious is here."

Gemini can say:

> "This appears to be a roadside mixed-waste pile blocking part of the pedestrian path."

The PDF specifically requires Gemini to return structured information including category, extent, and path-blocking status. fileciteturn0file0L34-L37

---

# 10. Gemini JSON

This is one of the most important parts of your implementation.

Don't ask Gemini:

> "What do you see?"

Instead force structured output.

Something like:

```json
{
  "category": "mixed_waste",
  "extent": "medium",
  "blocks_path": true,
  "confidence": 0.91
}
```

Your backend can then process this automatically.

---

# 11. Categories

The document mentions:

```text
mixed_waste
construction_debris
animal
overflowing_bin
```

The first three are explicitly shown in the verification matrix, with overflowing bins also included. fileciteturn0file0L50-L58

You should therefore define something like:

```text
animal
construction_debris
mixed_waste
overflowing_bin
unknown
```

---

# 12. Why Gemini verification is needed

Imagine your camera detects:

```text
██████
```

The edge detector thinks:

> Garbage!

But it could actually be:

```text
cow
```

or:

```text
construction material
```

or:

```text
shadow
```

Therefore:

```text
Edge detector
      ↓
Candidate
      ↓
Gemini
      ↓
Semantic verification
```

This reduces false positives.

---

# 13. Two-Tier Verification Matrix

This is one of the most important sections of the PDF.

The system doesn't simply say:

```text
AI says garbage → create complaint
```

Instead:

```text
AI
 ↓
Classification
 ↓
Policy
 ↓
Decision
```

The PDF defines different routing decisions for animals, construction debris, roadside waste, and overflowing bins. fileciteturn0file0L50-L58

---

# 14. Animal → Reject

Suppose:

```json
{
  "category": "animal"
}
```

Your system should do:

```text
Gemini
 ↓
animal
 ↓
REJECT
```

Why?

Because a cow standing beside the road isn't automatically a garbage incident.

Store it as:

```text
non_waste_object
```

and don't create a civic ticket.

---

# 15. Construction debris → Human Review

If Gemini says:

```json
{
  "category": "construction_debris"
}
```

the document says:

```text
HUMAN REVIEW
```

So:

```text
Construction debris
       ↓
Review queue
       ↓
Human officer
       ↓
Approve / reject
```

This is important because construction debris may require a different civic workflow than ordinary waste.

---

# 16. Roadside Dump → Accept

Example:

```json
{
  "category": "mixed_waste",
  "blocks_path": true
}
```

Decision:

```text
ACCEPT
```

Then it goes to an incident cluster.

---

# 17. Overflowing Bin → Accept

If:

```json
{
  "category": "overflowing_bin"
}
```

the PDF routes it directly to an accepted incident for municipal bin clearance. fileciteturn0file0L55-L58

---

# 18. Component 4 — GPS

Every observation needs a location.

Your data should contain something like:

```json
{
  "latitude": 12.9716,
  "longitude": 77.5946
}
```

Also:

```text
timestamp
vehicle_id
GPS accuracy
```

Example:

```json
{
  "vehicle_id": "RIDER_042",
  "latitude": 12.97161,
  "longitude": 77.59458,
  "timestamp": "2026-09-24T18:32:21",
  "gps_accuracy_m": 7
}
```

---

# 19. Component 5 — Spatial Engine

This is another **core innovation**.

Suppose:

```text
Rider A → garbage → GPS 12.97160, 77.59460

Rider B → garbage → GPS 12.97162, 77.59459

Rider C → garbage → GPS 12.97159, 77.59463
```

They're essentially seeing the same garbage.

You shouldn't create:

```text
Incident 1
Incident 2
Incident 3
```

Instead:

```text
          ┌ Observation A
          │
       ┌──┴──┐
       │ 30m │
       └──┬──┘
          │
          ├ Observation B
          │
          └ Observation C

              ↓

        ONE INCIDENT
```

The PDF specifically specifies a **30-meter Haversine radius**. fileciteturn0file0L38-L46

---

# 20. What is Haversine?

Latitude and longitude aren't normal X/Y coordinates.

Haversine calculates the approximate distance between two points on Earth.

Conceptually:

```text
GPS A
  ●
   \
    \ 12 metres
     \
      ●
     GPS B
```

If:

```text
distance <= 30m
```

then they can belong to the same incident cluster.

---

# 21. How to implement clustering

For a hackathon, don't overcomplicate it.

Store observations:

```python
observations = [
    {
        "lat": 12.9716,
        "lon": 77.5946,
        "vehicle_id": "R01"
    },
    ...
]
```

Calculate distance.

Pseudo-code:

```python
for observation in observations:

    for incident in incidents:

        distance = haversine(
            observation.lat,
            observation.lon,
            incident.lat,
            incident.lon
        )

        if distance <= 30:
            incident.add(observation)
            break
```

Otherwise:

```python
create_new_incident()
```

---

# 22. Why Vehicle ID matters

Suppose:

```text
Rider 01 sees garbage
Rider 01 sees same garbage 20 times
```

That's not necessarily 20 independent confirmations.

But:

```text
Rider 01
Rider 02
Rider 03
```

seeing it is stronger evidence.

Therefore store:

```text
vehicle_id
```

The PDF explicitly talks about corroboration across distinct vehicle IDs. fileciteturn0file0L38-L46

---

# 23. Observation → Incident → Blackspot → Ticket

This hierarchy is **very important**.

The PDF defines:

```text
Observation
     ↓
Incident
     ↓
Blackspot
     ↓
Civic Ticket
```

fileciteturn0file0L46-L47

Let's understand each.

---

# 24. Observation

One camera sees something.

Example:

```text
Vehicle R01
12:31 PM
GPS X,Y
mixed_waste
```

That's:

```text
OBSERVATION
```

It doesn't necessarily mean there is a confirmed problem yet.

---

# 25. Incident

Multiple observations around the same location get grouped.

Example:

```text
R01 → 12:30
R03 → 12:37
R08 → 12:48
```

All within 30m.

Therefore:

```text
INCIDENT #102
```

---

# 26. Blackspot

Suppose the same location keeps generating incidents.

Monday:

```text
Incident
```

Wednesday:

```text
Incident
```

Friday:

```text
Incident
```

Then:

```text
BLACKSPOT
```

The document defines this as a derived recurrence of at least two times. fileciteturn0file0L46-L47

This is valuable because you're no longer simply saying:

> "There is garbage."

You're saying:

> "This location repeatedly develops waste problems."

That gives municipal authorities **spatial intelligence**.

---

# 27. Civic Ticket

Once the policy engine decides the evidence is sufficient:

```text
Incident
 ↓
Policy check
 ↓
Verified
 ↓
Civic ticket
```

The ticket should contain:

```text
Ticket ID
Category
Location
Timestamp
Evidence images
Number of observations
Number of independent vehicles
Persistence score
GPS accuracy
Priority
Authority
Ward
Intake channel
```

---

# 28. Policy Engine

This is the **deterministic part**.

The PDF specifically says critical state logic and ticket generation should use deterministic policy code, while AI is used for semantic/spatial ambiguity. fileciteturn0file0L81-L84

This is a very good architecture.

Don't let Gemini decide everything.

For example:

```python
if independent_vehicles >= 2:
    confirmed = True
else:
    confirmed = False
```

Gemini shouldn't decide this.

Your code should.

---

# 29. Example Policy

You could implement:

```text
IF category == animal
    → REJECT

IF category == construction_debris
    → HUMAN REVIEW

IF category == mixed_waste
AND blocks_path == true
AND independent_vehicle_count >= 2
    → ACCEPT

IF category == overflowing_bin
    → ACCEPT
```

This directly follows the document's verification concept while adding the stated independent-pass confirmation rule. fileciteturn0file0L42-L45

---

# 30. Persistence Score

You need a score showing how persistent a garbage problem is.

For example:

```text
1 observation → 20
2 vehicles → 50
3 vehicles → 70
5 vehicles → 90
```

And recurrence increases it further.

For example:

```text
observations = 8
unique vehicles = 5
previous incidents = 3
```

You could calculate:

```python
score = (
    vehicle_factor +
    observation_factor +
    recurrence_factor
)
```

Keep the formula deterministic and show it in the UI.

---

# 31. Don't hide the scoring

A judge may ask:

> "Why did your system mark this as high priority?"

Your dashboard should be able to say:

```text
Priority: HIGH

Reason:
✓ 5 independent vehicles
✓ 11 observations
✓ Path blocked
✓ Repeated 3 times
✓ GPS accuracy: 6m
```

This makes the AI system **explainable**.

---

# 32. Privacy

This is another major component.

The PDF says:

- video stays on device
- candidate crops only are sent
- automatic blurring
- no continuous video storage
- no rider trajectory tracking
- no license-plate identification fileciteturn0file0L73-L80

So your architecture should visually communicate:

```text
RAW VIDEO
   │
   │ stays local
   ▼
EDGE DEVICE
   │
   │ crop
   ▼
BLUR
   │
   ▼
GEMINI
```

---

# 33. Privacy demo

This could actually be a great hackathon demo.

Show:

### Before

```text
Face
License plate
Person
```

### After

```text
Blurred face
Blurred plate
```

Then explain:

> "The city doesn't receive the full video. It receives only a privacy-filtered evidence crop."

That's much stronger than merely saying "we care about privacy."

---

# 34. Civic Governance

The PDF says you shouldn't hardcode one particular legacy municipal structure.

Instead use configurable fields:

```text
civic_authority
corporation
ward_number
intake_channel
```

This makes your system adaptable. fileciteturn0file0L59-L62

Your database could have:

```json
{
  "civic_authority": "GBA",
  "corporation": "Greater Bengaluru Authority",
  "ward_number": 154,
  "intake_channel": "Sahaaya 2.0"
}
```

---

# 35. Evidence Package

This is what makes the ticket credible.

Store:

```text
Evidence Package
│
├── timestamp
├── GPS coordinates
├── GPS accuracy
├── crop 1
├── crop 2
├── crop 3
├── vehicle IDs
├── category
├── persistence score
└── verification result
```

The PDF specifically calls for immutable evidence packages containing timestamps, GPS accuracy metrics, multi-pass crops, and persistence ratings. fileciteturn0file0L59-L62

---

# 36. Dashboard

The final part is your **Command Dashboard**.

The PDF asks for a dark-mode Mapbox dashboard with live incident pins and automatically generated evidence tickets. fileciteturn0file0L85-L95

Your dashboard should look approximately like:

```text
┌───────────────────────────────────────────────┐
│ KASA.EDGE COMMAND CENTER                      │
├───────────────┬───────────────────────────────┤
│               │                               │
│ INCIDENTS     │           MAP                 │
│               │                               │
│ 127           │      🔴                      │
│               │             🟠               │
│ BLACKSPOTS    │                  🔴           │
│               │                               │
│ 18            │          🟡                  │
│               │                               │
│ REVIEW QUEUE  │                               │
│               │                               │
│ 7             │                               │
└───────────────┴───────────────────────────────┘
```

---

# 37. What happens when you click a pin?

This is where you should impress the judges.

Click:

```text
🔴 Incident #1042
```

Show:

```text
ROADSIDЕ DUMP

Status: VERIFIED
Priority: HIGH

Location:
12.97160, 77.59460

Independent vehicles:
5

Observations:
11

Recurrence:
3 incidents

Path blocked:
YES

Persistence:
92/100
```

Then:

```text
Evidence

[IMAGE 1]
[IMAGE 2]
[IMAGE 3]
```

Then:

```text
GENERATED CIVIC TICKET
```

---

# 38. Recommended tech stack

For a 36-hour hackathon, I would keep the stack relatively simple.

### Frontend

```text
React
+
Tailwind CSS
+
Mapbox
```

### Backend

```text
Python
FastAPI
```

### Computer Vision

```text
OpenCV
+
YOLO
```

### VLM

```text
Gemini API
```

### Database

For speed:

```text
Supabase/PostgreSQL
```

or even:

```text
SQLite
```

for the initial demo.

### Storage

```text
Supabase Storage
```

or local storage during prototype.

---

# 39. Recommended folder structure

Build it like this:

```text
kasa-edge/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map.jsx
│   │   │   ├── IncidentCard.jsx
│   │   │   ├── EvidencePanel.jsx
│   │   │   └── Dashboard.jsx
│   │   │
│   │   └── App.jsx
│   │
│   └── package.json
│
├── backend/
│   ├── main.py
│   ├── detector.py
│   ├── gemini.py
│   ├── clustering.py
│   ├── policy.py
│   ├── scoring.py
│   └── models.py
│
├── simulator/
│   ├── dashcam.mp4
│   ├── route.json
│   └── simulator.py
│
├── data/
│   ├── observations.json
│   ├── incidents.json
│   └── tickets.json
│
└── README.md
```

---

# 40. Database design

You can keep four main tables.

### observations

```text
id
vehicle_id
timestamp
latitude
longitude
image_url
category
extent
blocks_path
confidence
gps_accuracy
```

### incidents

```text
id
latitude
longitude
category
observation_count
vehicle_count
persistence_score
status
created_at
```

### blackspots

```text
id
latitude
longitude
incident_count
first_seen
last_seen
recurrence_score
```

### tickets

```text
id
incident_id
civic_authority
corporation
ward_number
intake_channel
priority
evidence_url
status
created_at
```

---

# 41. API endpoints

Your FastAPI backend could have:

```text
POST /observation
```

Create observation.

```text
POST /verify
```

Send crop to Gemini.

```text
POST /cluster
```

Assign observation to incident.

```text
POST /policy/evaluate
```

Run deterministic rules.

```text
GET /incidents
```

Get dashboard incidents.

```text
GET /incidents/{id}
```

Get evidence.

```text
GET /blackspots
```

Get recurring locations.

```text
POST /tickets
```

Generate civic ticket.

---

# 42. Gemini implementation

Your prompt should be very strict.

For example, conceptually:

```text
You are a civic waste verification system.

Analyze the provided image.

Return ONLY valid JSON.

Allowed categories:
- mixed_waste
- construction_debris
- animal
- overflowing_bin
- unknown

Determine:
1. category
2. extent
3. whether pedestrian/road path is blocked
4. confidence

Do not identify people.
Do not identify license plates.
```

Then expected output:

```json
{
  "category": "mixed_waste",
  "extent": "large",
  "blocks_path": true,
  "confidence": 0.94
}
```

---

# 43. Important: AI shouldn't control your database

Don't do this:

```text
Gemini
 ↓
"Create ticket"
```

Instead:

```text
Gemini
 ↓
structured facts
 ↓
your backend
 ↓
deterministic policy
 ↓
ticket
```

This distinction is important because the PDF explicitly describes a hybrid architecture. fileciteturn0file0L81-L84

---

# 44. What does "Agentic AI" mean here?

A judge may ask:

> "Isn't this just computer vision?"

Your answer should be based on the architecture in the document:

```text
Computer vision
+
VLM reasoning
+
spatial reasoning
+
policy execution
+
civic workflow
```

The AI is not simply:

```text
image → label
```

It participates in resolving semantic/spatial ambiguity while deterministic code controls critical actions. fileciteturn0file0L81-L84

---

# 45. What NOT to call Agentic AI

Don't claim:

> "Gemini autonomously manages the entire city."

That's unnecessary and weakens your credibility.

Instead:

> **"Kasa.Edge uses a hybrid architecture: deterministic policy code controls civic actions, while Gemini handles semantic verification and ambiguity."**

That's much stronger.

---

# 46. Your complete demo

This is how I would structure the **actual 3–5 minute hackathon demo**.

### Step 1

Show dashboard.

```text
0 verified incidents
```

### Step 2

Start dashcam simulator.

```text
Vehicle R01
Scanning...
```

### Step 3

A candidate appears.

```text
Candidate detected
```

### Step 4

Show crop.

```text
Candidate crop → Gemini
```

### Step 5

Gemini returns:

```json
{
  "category": "mixed_waste",
  "blocks_path": true
}
```

### Step 6

Policy engine:

```text
Only 1 vehicle

→ WAIT FOR CORROBORATION
```

This is excellent because you're demonstrating that your system **doesn't spam tickets**.

---

# 47. Second vehicle

Run:

```text
Vehicle R07
```

It sees the same location.

Now:

```text
Vehicle count = 2
```

System:

```text
30m clustering
       ↓
same incident
       ↓
policy satisfied
       ↓
VERIFIED
```

---

# 48. Ticket generated

Dashboard suddenly shows:

```text
🔴 NEW VERIFIED INCIDENT

Mixed Waste
Path Blocked

2 independent vehicles
4 observations

Priority: HIGH
```

Then show:

```text
Generate Evidence Ticket
```

---

# 49. Third/fourth observation

Now demonstrate recurrence.

Later in simulated time:

```text
Same location
Different day
```

System detects:

```text
Incident #1
Incident #2
```

Then:

```text
BLACKSPOT DETECTED
```

This is a very strong demonstration because it shows the system becoming **spatially intelligent** rather than merely doing object detection.

---

# 50. Demonstrate the false-positive case

This is explicitly useful because the hackathon brief says to show a failure handled gracefully.

Send a cow image.

Gemini:

```json
{
  "category": "animal"
}
```

Policy:

```text
REJECTED
```

Dashboard:

```text
Candidate rejected
Reason: non-waste object
```

This directly demonstrates the two-tier verification design. fileciteturn0file0L50-L58

---

# 51. Demonstrate construction debris

Then:

```text
construction_debris
```

System:

```text
HUMAN REVIEW
```

Dashboard:

```text
Review Queue: 1
```

Now judges can see that your system doesn't blindly automate everything.

---

# 52. What the judges are really seeing

Your demo isn't really about garbage detection.

The bigger story is:

```text
CITY
 ↓
Existing moving vehicles
 ↓
Passive sensing
 ↓
Edge AI
 ↓
Multimodal AI
 ↓
Spatial intelligence
 ↓
Deterministic governance
 ↓
Actionable civic evidence
```

That is your pitch.

---

# 53. The four things you absolutely must build

The PDF itself identifies four major hackathon deliverables: passive sensing simulator, Gemini VLM verification, triage/policy engine, and command dashboard. fileciteturn0file0L85-L95

So your MVP should have:

### 1. Simulator

```text
Video → simulated vehicle
```

### 2. Gemini verification

```text
Crop → structured JSON
```

### 3. Triage engine

```text
Observation
 ↓
Cluster
 ↓
Recurrence
 ↓
Policy
```

### 4. Dashboard

```text
Map
+
Incidents
+
Evidence
+
Tickets
```

---

# 54. What you DON'T need to spend time on

Don't waste your 36 hours building:

❌ Full Sahaaya integration  
❌ Real municipal authentication  
❌ Real gig-worker deployment  
❌ Custom foundation model  
❌ Training a huge AI model  
❌ Massive cloud infrastructure  
❌ Perfect Bengaluru map coverage  
❌ Actual 24-hour video ingestion  

Instead simulate these parts.

---

# 55. 36-hour implementation plan

## Hours 0–3 — Setup

Create:

```text
React frontend
FastAPI backend
Gemini API
Database
Mapbox
```

Get everything communicating.

---

## Hours 3–8 — Simulator

Build:

```text
video → frames → candidate events
```

Add:

```text
vehicle ID
GPS
timestamp
```

---

## Hours 8–13 — Gemini

Build:

```text
crop → Gemini → JSON
```

Test:

```text
animal
mixed waste
construction debris
overflowing bin
```

---

## Hours 13–18 — Spatial engine

Implement:

```text
Haversine
30m clustering
unique vehicle counting
```

---

## Hours 18–22 — Policy engine

Implement:

```text
animal → reject

construction debris
→ review

mixed waste + path blocked + corroboration
→ accept

overflowing bin
→ accept
```

---

## Hours 22–28 — Dashboard

Build:

```text
map
pins
incident list
incident details
evidence
blackspots
review queue
```

---

## Hours 28–32 — Evidence/tickets

Create:

```text
ticket generator
```

Show:

```text
Ticket ID
Evidence
Location
Timestamp
Vehicles
Persistence
Priority
Ward
Authority
```

---

## Hours 32–36 — Demo polish

Prepare exactly:

```text
Normal detection
      ↓
False positive
      ↓
Second corroborating vehicle
      ↓
Ticket
      ↓
Recurring incident
      ↓
Blackspot
```

Do not spend the final hours adding random features.

---

# 56. The single most important data flow

If you understand this, you understand the entire project:

```text
                    CAMERA
                      │
                      ▼
                 VIDEO FRAME
                      │
                      ▼
              EDGE DETECTOR
                      │
                 candidate?
                   /     \
                 NO       YES
                 │         │
               DROP      CROP
                           │
                           ▼
                       PRIVACY
                        BLUR
                           │
                           ▼
                       GEMINI
                           │
                           ▼
                  STRUCTURED JSON
                           │
                           ▼
                  SPATIAL ENGINE
                           │
                     within 30m?
                      /       \
                    YES        NO
                     │          │
                EXISTING      NEW
                INCIDENT     INCIDENT
                     │          │
                     └────┬─────┘
                          ▼
                    POLICY ENGINE
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
            REJECT      REVIEW      ACCEPT
                                      │
                                      ▼
                                CIVIC TICKET
                                      │
                                      ▼
                                  DASHBOARD
```

---

# 57. Your minimum viable version

If you're running out of time, **this is the version you should finish first**:

```text
Dashcam video
     ↓
Candidate detection
     ↓
Crop
     ↓
Gemini
     ↓
JSON
     ↓
GPS
     ↓
30m clustering
     ↓
2 independent vehicles
     ↓
Verified incident
     ↓
Mapbox pin
     ↓
Evidence ticket
```

Then add:

```text
blackspots
```

Then:

```text
review queue
```

Then:

```text
privacy blur
```

in that order.

---

# 58. Final mental model

Think of Kasa.Edge as **four brains**:

### 👁️ Eyes

**Dashcam + Edge Detector**

> "I see something."

### 🧠 Understanding

**Gemini VLM**

> "This appears to be mixed waste and it blocks the path."

### 🗺️ Memory

**Spatial Engine**

> "I've seen this problem at this location before."

### ⚖️ Rules

**Policy Engine**

> "There are enough independent observations, so this can become a civic incident."

Then:

### 🏛️ Action

**Civic Ticket + Dashboard**

> "Here is the verified evidence package for the city."

That is the complete Kasa.Edge concept as described in your brief. fileciteturn0file0L24-L47

If you're actually going to build this for the hackathon, **the next step should be turning this into the actual project**: I can lay out the **exact tech stack, database schema, API endpoints, Gemini prompt, folder structure, frontend screens, and code for each component in build order**, so you can implement it step-by-step rather than trying to figure out the architecture yourself.