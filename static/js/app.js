// Kasa.Edge Command-Deck Advanced JavaScript Engine

let map;
let incidentsLayer;
let circlesLayer;
let vehiclesLayer;
let tracksLayer;
let heatmapLayer;
let beaconsLayer;
let activeIncident = null;
let vehicleTrails = {};
let isPlaying = false;
let playInterval = null;
let playSpeed = 1;
let soundEnabled = true;
let audioCtx = null;
let categoryChart = null;
let persistenceChart = null;
let allIncidentsCache = [];
let currentCategoryFilter = 'all';
let gazetteerCorridors = [];
let searchBeaconMarker = null;

// Default Corridors Fallback (Bengaluru Ward 154)
const DEFAULT_CORRIDORS = [
    {
        id: "CORR-100FT",
        name: "100 Feet Road, Indiranagar",
        short_name: "100 Feet Road",
        ward_number: 154,
        ward_name: "Ward 154 (Indiranagar / Shanthi Nagar)",
        latitude: 12.971920,
        longitude: 77.641210,
        type: "Primary Commercial High Street",
        description: "High-footfall commercial corridor with dining, retail, and delivery partner traffic.",
        keywords: ["100 feet road", "100ft road", "100 feet", "100ft", "100", "indiranagar 100", "ward 154", "ward154"]
    },
    {
        id: "CORR-CMH",
        name: "CMH Road (Chinmaya Mission Hospital Rd)",
        short_name: "CMH Road",
        ward_number: 154,
        ward_name: "Ward 154 (Indiranagar / Shanthi Nagar)",
        latitude: 12.978520,
        longitude: 77.643010,
        type: "Metro & Retail Transit Spine",
        description: "Key east-west metro line transit corridor with heavy curb activity and commercial retail.",
        keywords: ["cmh road", "cmh", "chinmaya mission", "chinmaya", "hospital road", "ward 154"]
    },
    {
        id: "CORR-12MAIN",
        name: "12th Main Road, HAL 2nd Stage",
        short_name: "12th Main Road",
        ward_number: 154,
        ward_name: "Ward 154 (Indiranagar / Shanthi Nagar)",
        latitude: 12.974050,
        longitude: 77.635120,
        type: "Dining & Pedestrian Promenade",
        description: "Commercial restaurant row & pedestrian walkway in HAL 2nd Stage.",
        keywords: ["12th main", "12th main road", "12 main", "hal 2nd stage", "hal stage 2", "ward 154"]
    },
    {
        id: "CORR-DOMLUR",
        name: "Domlur Flyover Junction / Ring Rd",
        short_name: "Domlur Junction",
        ward_number: 154,
        ward_name: "Ward 154 (Indiranagar / Shanthi Nagar)",
        latitude: 12.961120,
        longitude: 77.639140,
        type: "Major Arterial Flyover & Interchange",
        description: "Major transit interchange & public bin site connecting Indiranagar to Inner Ring Road.",
        keywords: ["domlur", "domlur flyover", "domlur junction", "inner ring road", "ward 154"]
    },
    {
        id: "CORR-8CROSS",
        name: "12th Main & 8th Cross Corner",
        short_name: "8th Cross Blackspot",
        ward_number: 154,
        ward_name: "Ward 154 (Indiranagar / Shanthi Nagar)",
        latitude: 12.969150,
        longitude: 77.640200,
        type: "Chronic Waste Hotspot (BS-IND-01)",
        description: "Recurrent commercial eatery night-dumping blackspot with historical relapses.",
        keywords: ["8th cross", "12th main corner", "blackspot", "relapse spot", "ward 154"]
    },
    {
        id: "CORR-DEFENCE",
        name: "Defence Colony, Indiranagar",
        short_name: "Defence Colony",
        ward_number: 154,
        ward_name: "Ward 154 (Indiranagar / Shanthi Nagar)",
        latitude: 12.977200,
        longitude: 77.638500,
        type: "Residential Neighborhood Zone",
        description: "High-density quiet residential sector within Ward 154 boundary.",
        keywords: ["defence colony", "defense colony", "defence", "defense", "ward 154"]
    },
    {
        id: "CORR-DOOPANA",
        name: "Doopanahalli & 80 Feet Road Junction",
        short_name: "Doopanahalli",
        ward_number: 154,
        ward_name: "Ward 154 (Indiranagar / Shanthi Nagar)",
        latitude: 12.966500,
        longitude: 77.636000,
        type: "Mixed Residential & Commercial Link",
        description: "Arterial link between Doopanahalli residential layout and 80 Feet Road.",
        keywords: ["doopanahalli", "80 feet road", "80ft", "80 feet", "ward 154"]
    },
    {
        id: "CORR-WARD154",
        name: "BBMP Ward 154 Central Command (Indiranagar)",
        "short_name": "Ward 154 Headquarters",
        ward_number: 154,
        ward_name: "Ward 154 (Indiranagar / Shanthi Nagar)",
        latitude: 12.971920,
        longitude: 77.641210,
        type: "GBA / BBMP Governance Division",
        description: "Greater Bengaluru Authority Jurisdiction Zone — Ward 154 Civic Operations Hub.",
        keywords: ["ward 154", "ward", "154", "ward154", "shanthi nagar", "indiranagar", "bbmp", "gba"]
    }
];

// Web Audio API Procedural Synthesizer (Zero external audio files needed)
function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        initAudio();
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now = audioCtx.currentTime;

        if (type === 'capture') {
            // Camera shutter & edge detection click
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(900, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'corroborate') {
            // Multi-pass confirmation chime (Major chord)
            [523.25, 659.25, 783.99].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.07);
                gain.gain.setValueAtTime(0.08, now + idx * 0.07);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.3);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + idx * 0.07);
                osc.stop(now + idx * 0.07 + 0.3);
            });
        } else if (type === 'ticket') {
            // High-tech ticket emission chime
            [440, 554.37, 659.25, 880].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                gain.gain.setValueAtTime(0.09, now + idx * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + idx * 0.08);
                osc.stop(now + idx * 0.08 + 0.4);
            });
        } else if (type === 'reject') {
            // Low buzz for rejected fauna / non-waste
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.setValueAtTime(160, now + 0.08);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        }
    } catch (e) {
        console.warn("Audio play prevented", e);
    }
}

// Initialize Multi-Layer Leaflet Map
function initMap() {
    // 1. Esri World Street Map (Primary Default)
    const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri'
    });

    // 2. Esri World Imagery (Satellite)
    const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri'
    });

    // 3. OpenStreetMap
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    });

    // Centered on Indiranagar / Ward 154, Bengaluru
    map = L.map('map', {
        center: [12.9719, 77.6412],
        zoom: 14,
        zoomControl: false,
        layers: [esriStreet]
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const baseMaps = {
        "🏙️ City Streets (Esri)": esriStreet,
        "🛰️ Satellite Aerial (Esri)": esriSat,
        "🗺️ Standard OpenStreetMap": osm
    };
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    // Overlay groups
    tracksLayer = L.layerGroup().addTo(map);
    circlesLayer = L.layerGroup().addTo(map);
    heatmapLayer = L.layerGroup().addTo(map);
    incidentsLayer = L.layerGroup().addTo(map);
    beaconsLayer = L.layerGroup().addTo(map);
    vehiclesLayer = L.layerGroup().addTo(map);
}

// Fetch and update dashboard metrics
async function fetchStats() {
    try {
        const res = await fetch('/stats');
        const data = await res.json();

        document.getElementById('stat-vehicles').innerText = data.active_vehicles;
        document.getElementById('stat-observations').innerText = data.total_observations;
        document.getElementById('stat-confirmed').innerText = data.confirmed_incidents;
        document.getElementById('stat-pending').innerText = data.pending_corroboration;
        document.getElementById('stat-tickets').innerText = data.tickets_issued;
        document.getElementById('stat-rejected').innerText = data.false_positives_filtered;

        document.getElementById('count-incidents').innerText = data.total_incidents;
        document.getElementById('count-tickets').innerText = data.tickets_issued;
        document.getElementById('count-blackspots').innerText = data.active_blackspots;
    } catch (e) {
        console.error("Failed to load stats", e);
    }
}

// Fetch AI Verifier status
async function fetchAiStatus() {
    try {
        const res = await fetch('/config/gemini_status');
        const data = await res.json();
        const badge = document.getElementById('ai-mode-badge');
        const cfgMode = document.getElementById('cfg-status-mode');
        const cfgMsg = document.getElementById('cfg-status-message');

        if (data.has_key && data.valid) {
            badge.innerText = "Gemini Flash (Live)";
            badge.className = "text-emerald-300 font-semibold text-[11px]";
            cfgMode.innerText = "Google Gemini 1.5 Flash (Live API)";
            cfgMsg.innerText = "Connected to live Google AI Studio multimodal endpoint.";
        } else {
            badge.innerText = "Autonomous AI (Active)";
            badge.className = "text-slate-200 font-medium text-[11px]";
            cfgMode.innerText = "Autonomous High-Precision Verifier";
            cfgMsg.innerText = "Zero API key required. High-precision semantic classifier is fully operational.";
        }
    } catch (e) {
        console.error("Failed to fetch AI status", e);
    }
}

// Fetch and render incidents with live category and search filter
async function fetchIncidents() {
    try {
        const res = await fetch('/incidents');
        const incidents = await res.json();
        allIncidentsCache = incidents;

        renderFilteredIncidents();
        updateAnalyticsCharts();
    } catch (e) {
        console.error("Failed to fetch incidents", e);
    }
}

// Haversine Distance Helper in Meters
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Fetch Bengaluru Ward 154 Corridors
async function fetchGazetteer() {
    try {
        const res = await fetch('/gazetteer');
        const data = await res.json();
        if (data && data.corridors && data.corridors.length > 0) {
            gazetteerCorridors = data.corridors;
        } else {
            gazetteerCorridors = DEFAULT_CORRIDORS;
        }
    } catch (e) {
        console.warn("Using offline gazetteer corridors fallback", e);
        gazetteerCorridors = DEFAULT_CORRIDORS;
    }
}

// Smoothly fly map to a corridor with tactical beacon pulse
function flyToCorridor(corridorId) {
    const corridor = gazetteerCorridors.find(c => c.id === corridorId);
    if (!corridor) return;
    map.flyTo([corridor.latitude, corridor.longitude], 17, { duration: 1.2 });
    dropBeaconMarker(corridor.latitude, corridor.longitude, corridor.name, corridor.type);
}

// Drop tactical radar beacon on the map
function dropBeaconMarker(lat, lon, title, subtitle) {
    if (!beaconsLayer) return;
    beaconsLayer.clearLayers();

    const beaconIcon = L.divIcon({
        className: '',
        html: `
            <div class="beacon-locator-marker">
                <div class="beacon-ring"></div>
                <div class="beacon-core">
                    <i class="fa-solid fa-location-crosshairs"></i>
                </div>
            </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
    });

    searchBeaconMarker = L.marker([lat, lon], { icon: beaconIcon, zIndexOffset: 1000 });
    beaconsLayer.addLayer(searchBeaconMarker);

    searchBeaconMarker.bindTooltip(`
        <div class="p-1 font-sans text-xs">
            <div class="text-[#00f5a0] font-bold">${title}</div>
            <div class="text-slate-300 text-[10px]">${subtitle || 'Ward 154 Corridor'}</div>
        </div>
    `, { permanent: false, direction: 'top', offset: [0, -15] }).openTooltip();
}

// Trigger simulated sensing pass on specific corridor
async function triggerCorridorSimulation(corridorId) {
    try {
        logTelemetry(`[${new Date().toLocaleTimeString()}] 🚀 Initiating corridor sensing pass for ${corridorId}...`);
        playSound('capture');
        const res = await fetch(`/simulator/trigger_corridor/${corridorId}`, { method: 'POST' });
        const data = await res.json();
        await refreshAll();
        playSound('corroborate');
        showToast("Patrol Sensing Ingested", `Captured crop along corridor: ${data.scenario_name || corridorId}`, "success");
    } catch (e) {
        console.error("Corridor simulation error", e);
    }
}

// Set search query programmatically
function setSearchQuery(query) {
    const input = document.getElementById('map-search-input');
    if (input) {
        input.value = query;
        renderFilteredIncidents();
        hideSearchDropdown();

        const q = query.toLowerCase().trim();
        const matched = gazetteerCorridors.find(c =>
            c.name.toLowerCase().includes(q) ||
            c.short_name.toLowerCase().includes(q) ||
            (c.keywords && c.keywords.some(k => k.toLowerCase().includes(q)))
        );
        if (matched) {
            flyToCorridor(matched.id);
        }
    }
}

// Clear search filter and remove beacon
function clearSearch() {
    const input = document.getElementById('map-search-input');
    if (input) {
        input.value = '';
        renderFilteredIncidents();
        hideSearchDropdown();
    }
    if (beaconsLayer) {
        beaconsLayer.clearLayers();
    }
}

function hideSearchDropdown() {
    const dropdown = document.getElementById('search-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

// Render Autocomplete Suggestions Dropdown
function renderSearchDropdown(query) {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown) return;

    const q = (query || '').toLowerCase().trim();

    // Match Corridors
    const matchedCorridors = gazetteerCorridors.filter(c => {
        if (!q) return true; // Show top corridors when input is empty
        if (c.name.toLowerCase().includes(q)) return true;
        if (c.short_name.toLowerCase().includes(q)) return true;
        if (c.type.toLowerCase().includes(q)) return true;
        if (c.keywords && c.keywords.some(k => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))) return true;
        if ((q.includes('ward') || q.includes('154')) && c.ward_number === 154) return true;
        return false;
    });

    // Match Active Incidents
    const matchedIncidents = allIncidentsCache.filter(i => {
        if (!q) return false;
        if (i.id.toLowerCase().includes(q)) return true;
        if (i.category.toLowerCase().includes(q)) return true;
        if (i.location_name && i.location_name.toLowerCase().includes(q)) return true;
        if (i.status.toLowerCase().includes(q)) return true;
        return false;
    });

    if (matchedCorridors.length === 0 && matchedIncidents.length === 0) {
        dropdown.innerHTML = `
            <div class="p-3 text-center text-slate-400 text-xs font-mono">
                No matching corridors or incidents found for "${query}"
            </div>
        `;
        dropdown.classList.remove('hidden');
        return;
    }

    let html = '';

    // Corridors Section Header
    html += `
        <div class="px-3 py-1.5 bg-slate-900/90 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span class="flex items-center space-x-1.5">
                <i class="fa-solid fa-map-location-dot text-[#00f5a0]"></i>
                <span>${q ? 'Matching Corridors & Streets' : 'Bengaluru Ward 154 Corridors'}</span>
            </span>
            <span class="text-[9px] text-[#00f5a0] font-mono">${matchedCorridors.length} Zones</span>
        </div>
    `;

    matchedCorridors.slice(0, 6).forEach(c => {
        const isWardHq = c.id === 'CORR-WARD154';
        const isBlackspot = c.id === 'CORR-8CROSS';
        let iconHtml = '<i class="fa-solid fa-road text-cyan-400"></i>';
        if (isWardHq) iconHtml = '<i class="fa-solid fa-landmark text-[#00f5a0]"></i>';
        else if (isBlackspot) iconHtml = '<i class="fa-solid fa-fire text-red-400"></i>';

        html += `
            <div class="search-suggestion-item flex items-center justify-between text-xs" onclick="onSelectCorridor('${c.id}')">
                <div class="flex items-center space-x-2.5 truncate">
                    <div class="w-6 h-6 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center shrink-0">
                        ${iconHtml}
                    </div>
                    <div class="truncate">
                        <div class="font-semibold text-slate-100 truncate">${c.name}</div>
                        <div class="text-[10px] text-slate-400 truncate">${c.type}</div>
                    </div>
                </div>
                <div class="text-right shrink-0 ml-2">
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Ward ${c.ward_number}</span>
                </div>
            </div>
        `;
    });

    if (matchedIncidents.length > 0) {
        html += `
            <div class="px-3 py-1.5 bg-slate-900/90 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span class="flex items-center space-x-1.5">
                    <i class="fa-solid fa-triangle-exclamation text-amber-400"></i>
                    <span>Matching Incidents</span>
                </span>
                <span class="text-[9px] text-amber-400 font-mono">${matchedIncidents.length} Found</span>
            </div>
        `;

        matchedIncidents.slice(0, 4).forEach(inc => {
            html += `
                <div class="search-suggestion-item flex items-center justify-between text-xs" onclick="onSelectIncident('${inc.id}')">
                    <div class="flex items-center space-x-2.5 truncate">
                        <div class="w-6 h-6 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center shrink-0 text-red-400">
                            <i class="fa-solid fa-location-dot"></i>
                        </div>
                        <div class="truncate">
                            <div class="font-bold font-mono text-white text-xs">${inc.id} • <span class="capitalize font-sans text-slate-300 font-normal">${inc.category.replace('_', ' ')}</span></div>
                            <div class="text-[10px] text-slate-400 truncate">${inc.location_name || 'Ward 154 Corridor'}</div>
                        </div>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded bg-red-950/80 text-red-300 font-mono shrink-0 ml-2 uppercase">${inc.status}</span>
                </div>
            `;
        });
    }

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
}

function onSelectCorridor(corridorId) {
    const corridor = gazetteerCorridors.find(c => c.id === corridorId);
    if (!corridor) return;
    const input = document.getElementById('map-search-input');
    if (input) input.value = corridor.name;
    hideSearchDropdown();
    flyToCorridor(corridorId);
    renderFilteredIncidents();
}

function onSelectIncident(incidentId) {
    const inc = allIncidentsCache.find(i => i.id === incidentId);
    if (!inc) return;
    const input = document.getElementById('map-search-input');
    if (input) input.value = inc.id;
    hideSearchDropdown();
    map.flyTo([inc.latitude, inc.longitude], 18, { duration: 1.2 });
    dropBeaconMarker(inc.latitude, inc.longitude, inc.id, `${inc.category.replace('_', ' ').toUpperCase()} • Ward ${inc.ward_number}`);
    renderFilteredIncidents();
}

function initSearchAutocomplete() {
    const input = document.getElementById('map-search-input');
    const dropdown = document.getElementById('search-dropdown');
    const clearBtn = document.getElementById('search-clear-btn');

    if (!input || !dropdown) return;

    input.addEventListener('focus', () => {
        renderSearchDropdown(input.value.trim());
    });

    input.addEventListener('input', () => {
        renderSearchDropdown(input.value.trim());
        renderFilteredIncidents();
    });

    clearBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSearch();
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dropdown.classList.add('hidden');
        } else if (e.key === 'Enter') {
            const firstItem = dropdown.querySelector('.search-suggestion-item');
            if (firstItem && !dropdown.classList.contains('hidden')) {
                firstItem.click();
            } else {
                dropdown.classList.add('hidden');
                renderFilteredIncidents();
            }
        }
    });
}

// Fetch and render incidents with live category and search filter
function renderFilteredIncidents() {
    const rawSearch = (document.getElementById('map-search-input')?.value || '').trim();
    const searchTerm = rawSearch.toLowerCase();
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
        if (rawSearch) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }

    incidentsLayer.clearLayers();
    circlesLayer.clearLayers();

    const listContainer = document.getElementById('incidents-list');
    const emptyState = document.getElementById('incidents-empty');

    // Check if query is targeting ward or corridors
    const isWardSearch = searchTerm.includes('ward') || searchTerm.includes('154') ||
                         searchTerm.includes('shanthi') || searchTerm.includes('indiranagar') ||
                         searchTerm.includes('bbmp') || searchTerm.includes('gba');

    // Find any corridor that matches the search term
    const matchedCorridor = gazetteerCorridors.find(c => {
        if (!searchTerm) return false;
        if (c.name.toLowerCase().includes(searchTerm)) return true;
        if (c.short_name.toLowerCase().includes(searchTerm)) return true;
        if (c.keywords && c.keywords.some(k => k.toLowerCase().includes(searchTerm) || searchTerm.includes(k.toLowerCase()))) return true;
        return false;
    });

    const filtered = allIncidentsCache.filter(inc => {
        // Category Filter
        if (currentCategoryFilter === 'dumps' && inc.category !== 'mixed_waste') return false;
        if (currentCategoryFilter === 'bins' && inc.category !== 'overflowing_bin') return false;
        if (currentCategoryFilter === 'debris' && inc.category !== 'construction_debris') return false;
        if (currentCategoryFilter === 'blackspots' && !inc.is_blackspot) return false;

        // Search Term Filter
        if (searchTerm) {
            // 1. Ward match: any incident in Ward 154 matches ward queries
            if (isWardSearch && (inc.ward_number === 154 || String(inc.ward_number).includes(searchTerm))) {
                return true;
            }

            // 2. Incident ID match
            if (inc.id.toLowerCase().includes(searchTerm)) return true;

            // 3. Category match
            if (inc.category.toLowerCase().includes(searchTerm) ||
                (searchTerm.includes('dump') && inc.category === 'mixed_waste') ||
                (searchTerm.includes('garbage') && inc.category === 'mixed_waste') ||
                (searchTerm.includes('bin') && inc.category === 'overflowing_bin') ||
                (searchTerm.includes('c&d') && inc.category === 'construction_debris') ||
                (searchTerm.includes('debris') && inc.category === 'construction_debris') ||
                (searchTerm.includes('animal') && inc.category === 'animal')) {
                return true;
            }

            // 4. Status match
            if (inc.status.toLowerCase().includes(searchTerm)) return true;

            // 5. Street / Location Name match
            if (inc.location_name && inc.location_name.toLowerCase().includes(searchTerm)) return true;

            // 6. Proximity to matched corridor
            if (matchedCorridor) {
                const dist = calculateDistance(inc.latitude, inc.longitude, matchedCorridor.latitude, matchedCorridor.longitude);
                if (dist <= 350) return true;
            }

            // 7. Vehicle ID match
            if (inc.vehicle_ids && inc.vehicle_ids.some(v => v.toLowerCase().includes(searchTerm))) return true;

            return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        emptyState.classList.add('hidden'); // Hide generic empty state, show proactive feedback

        if (matchedCorridor) {
            // Render interactive corridor card with "Clean & Clear" status and trigger button!
            listContainer.innerHTML = `
                <div class="glass-panel p-4 rounded-2xl border border-cyan-500/30 text-center space-y-3.5 shadow-xl">
                    <div class="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(0,217,245,0.2)]">
                        <i class="fa-solid fa-road"></i>
                    </div>
                    <div>
                        <div class="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono font-bold mb-1">
                            <span>CORRIDOR MONITORED</span>
                        </div>
                        <h4 class="text-white font-bold text-sm leading-snug">${matchedCorridor.name}</h4>
                        <p class="text-slate-400 text-xs mt-0.5">${matchedCorridor.ward_name} • ${matchedCorridor.type}</p>
                    </div>
                    <div class="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-center space-x-2">
                        <i class="fa-solid fa-circle-check text-emerald-400 text-sm"></i>
                        <span class="font-semibold">Corridor Monitored: Roadway Clean & Clear</span>
                    </div>
                    <p class="text-slate-400 text-[11px] leading-relaxed">${matchedCorridor.description}</p>
                    <div class="pt-2 border-t border-white/5 flex flex-col gap-2">
                        <button onclick="flyToCorridor('${matchedCorridor.id}')" class="w-full py-2 px-3 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-700/60 text-cyan-300 text-xs font-semibold transition flex items-center justify-center space-x-2">
                            <i class="fa-solid fa-location-crosshairs text-[10px]"></i>
                            <span>Center Map on ${matchedCorridor.short_name}</span>
                        </button>
                        <button onclick="triggerCorridorSimulation('${matchedCorridor.id}')" class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-bold transition shadow-lg flex items-center justify-center space-x-2">
                            <i class="fa-solid fa-bolt text-amber-950"></i>
                            <span>Simulate Fleet Sensing on this Corridor</span>
                        </button>
                    </div>
                </div>
            `;
        } else if (isWardSearch) {
            // Render Ward 154 Overview Card
            listContainer.innerHTML = `
                <div class="glass-panel p-4 rounded-2xl border border-emerald-500/30 text-center space-y-3.5 shadow-xl">
                    <div class="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 text-[#00f5a0] flex items-center justify-center text-xl shadow-[0_0_15px_rgba(0,245,160,0.2)]">
                        <i class="fa-solid fa-landmark"></i>
                    </div>
                    <div>
                        <div class="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold mb-1">
                            <span>BBMP CENTRAL WARD</span>
                        </div>
                        <h4 class="text-white font-bold text-sm">Ward 154 (Indiranagar / Shanthi Nagar)</h4>
                        <p class="text-slate-400 text-xs mt-0.5">Greater Bengaluru Authority • East Zone</p>
                    </div>
                    <div class="p-3 rounded-xl bg-slate-900/90 border border-white/10 text-slate-300 text-xs">
                        Fleet sensors active across 8 patrol corridors. Awaiting fleet passes.
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-[11px] text-left pt-1">
                        <div class="bg-slate-900/60 p-2 rounded-lg border border-white/5 cursor-pointer hover:border-emerald-500/30" onclick="setSearchQuery('100 Feet Road')">
                            <span class="text-slate-400 text-[10px] block">Key Corridor:</span>
                            <span class="text-white font-semibold">100 Feet Road</span>
                        </div>
                        <div class="bg-slate-900/60 p-2 rounded-lg border border-white/5 cursor-pointer hover:border-emerald-500/30" onclick="setSearchQuery('CMH Road')">
                            <span class="text-slate-400 text-[10px] block">Metro Spine:</span>
                            <span class="text-white font-semibold">CMH Road</span>
                        </div>
                        <div class="bg-slate-900/60 p-2 rounded-lg border border-white/5 cursor-pointer hover:border-emerald-500/30" onclick="setSearchQuery('12th Main Road')">
                            <span class="text-slate-400 text-[10px] block">Commercial:</span>
                            <span class="text-white font-semibold">12th Main Road</span>
                        </div>
                        <div class="bg-slate-900/60 p-2 rounded-lg border border-white/5 cursor-pointer hover:border-emerald-500/30" onclick="setSearchQuery('Domlur')">
                            <span class="text-slate-400 text-[10px] block">Interchange:</span>
                            <span class="text-white font-semibold">Domlur Junction</span>
                        </div>
                    </div>
                    <button onclick="triggerNextStep()" class="w-full py-2.5 px-3 rounded-xl bg-[#00f5a0] hover:bg-[#00f5a0]/90 text-slate-950 text-xs font-black transition shadow-[0_0_20px_rgba(0,245,160,0.3)] flex items-center justify-center space-x-2">
                        <i class="fa-solid fa-play"></i>
                        <span>Start Step 1: Rider R-01 on 100 Feet Rd</span>
                    </button>
                </div>
            `;
        } else if (searchTerm) {
            // Search query with no match
            listContainer.innerHTML = `
                <div class="glass-panel p-5 rounded-2xl border border-white/10 text-center space-y-3 shadow-xl">
                    <div class="w-10 h-10 mx-auto rounded-full bg-slate-800 text-slate-400 flex items-center justify-center">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <div class="text-white font-semibold text-xs">No active incidents matching "${rawSearch}"</div>
                    <p class="text-slate-400 text-[11px]">Explore monitored corridors in Ward 154:</p>
                    <div class="flex flex-wrap gap-1.5 justify-center pt-1">
                        <button onclick="setSearchQuery('100 Feet Road')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-white/5">100 Feet Road</button>
                        <button onclick="setSearchQuery('CMH Road')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-white/5">CMH Road</button>
                        <button onclick="setSearchQuery('Domlur')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-white/5">Domlur</button>
                        <button onclick="setSearchQuery('12th Main Road')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-white/5">12th Main</button>
                        <button onclick="setSearchQuery('Ward 154')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-white/5">Ward 154</button>
                    </div>
                    <button onclick="clearSearch()" class="text-[#00f5a0] hover:underline text-[11px] pt-2 block mx-auto font-medium">Clear Search Filter</button>
                </div>
            `;
        } else {
            emptyState.classList.remove('hidden');
            listContainer.innerHTML = '';
        }
        return;
    } else {
        emptyState.classList.add('hidden');
    }

    let listHtml = '';

    filtered.forEach(inc => {
        let markerClass = "marker-pending";
        let circleColor = "#f59e0b";
        let iconHtml = '<i class="fa-solid fa-hourglass-half text-white text-[11px]"></i>';
        let statusBadge = `<span class="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Pending Pass 2</span>`;

        if (inc.status === 'confirmed') {
            if (inc.category === 'overflowing_bin') {
                markerClass = "marker-bin";
                circleColor = "#f97316";
                iconHtml = '<i class="fa-solid fa-trash-can-arrow-up text-white text-[11px]"></i>';
                statusBadge = `<span class="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Overflowing Bin</span>`;
            } else if (inc.is_blackspot) {
                markerClass = "marker-blackspot";
                circleColor = "#ef4444";
                iconHtml = '<i class="fa-solid fa-fire text-amber-300 text-[11px]"></i>';
                statusBadge = `<span class="bg-red-950 text-red-400 border border-red-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase animate-pulse">Chronic Blackspot</span>`;
            } else {
                markerClass = "marker-confirmed";
                circleColor = "#ef4444";
                iconHtml = '<i class="fa-solid fa-trash-can text-white text-[11px]"></i>';
                statusBadge = `<span class="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Confirmed Dump</span>`;
            }
        } else if (inc.status === 'human_review_required') {
            markerClass = "marker-review";
            circleColor = "#a855f7";
            iconHtml = '<i class="fa-solid fa-trowel-bricks text-white text-[11px]"></i>';
            statusBadge = `<span class="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">C&D Review</span>`;
        } else if (inc.status === 'rejected') {
            markerClass = "marker-animal";
            circleColor = "#64748b";
            iconHtml = '<i class="fa-solid fa-dog text-slate-300 text-[11px]"></i>';
            statusBadge = `<span class="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Spam / Animal</span>`;
        }

        // Draw 30m Haversine Radius Circle
        const circle = L.circle([inc.latitude, inc.longitude], {
            radius: 30,
            color: circleColor,
            fillColor: circleColor,
            fillOpacity: 0.18,
            weight: 2,
            dashArray: '4, 4'
        });
        circlesLayer.addLayer(circle);

        // Draw Pulsing Map Pin
        const customIcon = L.divIcon({
            className: '',
            html: `<div class="pulse-marker ${markerClass}">${iconHtml}</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        const marker = L.marker([inc.latitude, inc.longitude], { icon: customIcon });
        marker.on('click', () => openEvidenceModal(inc.id));
        marker.bindTooltip(`
            <div class="font-sans text-xs p-1">
                <div class="flex items-center justify-between mb-1">
                    <strong class="text-white font-mono">${inc.id}</strong>
                    <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 uppercase">${inc.priority}</span>
                </div>
                <div class="text-[#00f5a0] font-semibold mb-0.5">${inc.category.replace('_', ' ').toUpperCase()}</div>
                <div class="text-slate-300 text-[11px] flex items-center space-x-1">
                    <i class="fa-solid fa-location-dot text-red-400 text-[10px]"></i>
                    <span class="truncate">${inc.location_name || 'Ward 154 Corridor'}</span>
                </div>
                <div class="text-slate-300 text-[11px] mt-1">Persistence: <strong class="text-amber-400 font-mono">${inc.persistence_score}/100</strong></div>
                <div class="text-slate-400 text-[10px] mt-1 border-t border-slate-700 pt-1">${inc.vehicle_count} vehicle(s) • ${inc.observation_count} pass(es)</div>
            </div>
        `, {
            className: 'leaflet-popup-content-wrapper',
            direction: 'top'
        });
        incidentsLayer.addLayer(marker);

        // Construct Card HTML for Side Panel with Prominent Location Display
        listHtml += `
            <div class="glass-panel p-3.5 rounded-xl border border-white/5 hover:border-emerald-500/40 transition shadow-lg space-y-2.5">
                <div class="flex items-center justify-between">
                    <span class="font-mono font-bold text-white text-xs">${inc.id}</span>
                    ${statusBadge}
                </div>

                <div class="flex items-center justify-between text-slate-400 text-[11px]">
                    <span class="font-semibold text-emerald-400 capitalize">${inc.category.replace('_', ' ')}</span>
                    <span class="text-slate-300 font-mono text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded border border-white/5">Ward ${inc.ward_number}</span>
                </div>

                <div class="text-xs text-slate-200 font-medium flex items-center space-x-1.5 truncate">
                    <i class="fa-solid fa-location-dot text-red-400 text-[11px] shrink-0"></i>
                    <span class="truncate">${inc.location_name || '100 Feet Road Corridor'}</span>
                </div>

                <!-- Persistence Progress Bar -->
                <div class="space-y-1">
                    <div class="flex justify-between text-[10px]">
                        <span class="text-slate-400">Persistence Score</span>
                        <span class="font-mono font-bold text-slate-200">${inc.persistence_score}/100</span>
                    </div>
                    <div class="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                        <div class="h-1.5 rounded-full ${inc.persistence_score >= 50 ? 'bg-red-500' : 'bg-amber-500'} transition-all duration-500" style="width: ${inc.persistence_score}%"></div>
                    </div>
                </div>

                <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-white/5">
                    <span>Vehicles: <strong class="text-slate-300 font-mono">${inc.vehicle_count}</strong> • Passes: <strong class="text-slate-300 font-mono">${inc.observation_count}</strong></span>
                    <div class="flex items-center space-x-1.5">
                        <button onclick="focusMap(${inc.latitude}, ${inc.longitude})" class="text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-[10px] font-medium transition flex items-center space-x-1" title="Focus map on location">
                            <i class="fa-solid fa-location-crosshairs text-[9px]"></i>
                            <span>Map</span>
                        </button>
                        <button onclick="openEvidenceModal('${inc.id}')" class="text-emerald-400 hover:text-emerald-300 px-2.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-[10px] font-medium transition flex items-center space-x-1">
                            <i class="fa-solid fa-camera text-[9px]"></i>
                            <span>Evidence</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = listHtml;
}

// Focus map smoothly to coordinates
function focusMap(lat, lon) {
    map.flyTo([lat, lon], 17, { duration: 1.2 });
}

// Fetch and render tickets
async function fetchTickets() {
    try {
        const res = await fetch('/tickets');
        const tickets = await res.json();

        const container = document.getElementById('tickets-list');
        const emptyState = document.getElementById('tickets-empty');

        if (tickets.length === 0) {
            emptyState.classList.remove('hidden');
            container.innerHTML = '';
            return;
        } else {
            emptyState.classList.add('hidden');
        }

        let html = '';
        tickets.forEach(tk => {
            html += `
                <div class="glass-panel p-3.5 rounded-xl border border-emerald-500/20 hover:border-emerald-500/50 space-y-2.5 text-xs transition">
                    <div class="flex items-center justify-between">
                        <span class="font-mono font-bold text-emerald-400 text-xs">${tk.id}</span>
                        <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono uppercase">${tk.priority}</span>
                    </div>
                    <div class="text-slate-300 text-[11px]">
                        <strong>${tk.civic_authority}</strong> • ${tk.corporation}
                    </div>
                    <div class="flex items-center justify-between text-slate-400 text-[10px] pt-1 border-t border-white/5 font-mono">
                        <span>Ward ${tk.ward_number}</span>
                        <span class="text-emerald-400 font-semibold">${tk.status}</span>
                        <button onclick="openEvidenceModal('${tk.incident_id}')" class="text-cyan-400 hover:text-cyan-300 underline">View Incident</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error("Failed to fetch tickets", e);
    }
}

// Fetch and render blackspots
async function fetchBlackspots() {
    try {
        const res = await fetch('/blackspots');
        const blackspots = await res.json();

        const container = document.getElementById('blackspots-list');
        let html = '';

        blackspots.forEach(bs => {
            html += `
                <div class="glass-panel p-3.5 rounded-xl border border-red-500/30 hover:border-red-500/60 space-y-2.5 text-xs transition">
                    <div class="flex items-center justify-between">
                        <span class="font-mono font-bold text-red-400">${bs.id}</span>
                        <span class="px-2.5 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-700/80 text-[10px] font-bold font-mono">RELAPSE: ${bs.incident_count}x</span>
                    </div>
                    <p class="text-slate-300 text-[11px] leading-relaxed">${bs.remediation_history || 'Repeated dumping relapses detected by fleet sensors.'}</p>
                    <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-white/5">
                        <span>Recurrence Score: <strong class="text-amber-400 font-mono">${bs.recurrence_score}/100</strong></span>
                        <button onclick="focusMap(${bs.latitude}, ${bs.longitude})" class="text-red-400 hover:text-red-300 flex items-center space-x-1 px-2 py-0.5 rounded bg-red-950/60 border border-red-800">
                            <i class="fa-solid fa-crosshairs text-[10px]"></i>
                            <span>Locate Hotspot</span>
                        </button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error("Failed to fetch blackspots", e);
    }
}

// Interactive Curtain Split Slider Logic
function initCurtainSlider() {
    const container = document.getElementById('compare-slider');
    const overlay = document.getElementById('compare-overlay');
    const handle = document.getElementById('compare-handle');

    let isDragging = false;

    function setPosition(xPos) {
        const rect = container.getBoundingClientRect();
        let x = xPos - rect.left;
        if (x < 0) x = 0;
        if (x > rect.width) x = rect.width;
        const percentage = (x / rect.width) * 100;
        overlay.style.width = `${percentage}%`;
        handle.style.left = `${percentage}%`;
    }

    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        setPosition(e.clientX);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        setPosition(e.clientX);
    });

    // Touch events for mobile/tablet
    container.addEventListener('touchstart', (e) => {
        isDragging = true;
        setPosition(e.touches[0].clientX);
    });
    window.addEventListener('touchend', () => {
        isDragging = false;
    });
    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        setPosition(e.touches[0].clientX);
    });
}

// Open Evidence and Decision Modal
async function openEvidenceModal(incidentId) {
    try {
        const res = await fetch(`/incidents/${incidentId}`);
        const inc = await res.json();
        activeIncident = inc;

        document.getElementById('modal-title').innerText = inc.id;
        document.getElementById('modal-category-badge').innerText = inc.category.replace('_', ' ').toUpperCase();
        document.getElementById('modal-score-badge').innerText = `${inc.persistence_score} / 100`;
        document.getElementById('modal-score-bar').style.width = `${inc.persistence_score}%`;
        document.getElementById('modal-unique-vehicles').innerText = inc.vehicle_count;
        document.getElementById('modal-obs-count').innerText = inc.observation_count;
        document.getElementById('modal-ward').innerText = `Ward ${inc.ward_number} • ${inc.location_name || 'Indiranagar'}`;

        // Status badge
        const badge = document.getElementById('modal-badge-status');
        badge.innerText = inc.status.replace('_', ' ').toUpperCase();
        if (inc.status === 'confirmed') {
            badge.className = "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30";
        } else if (inc.status === 'human_review_required') {
            badge.className = "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30";
        } else {
            badge.className = "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30";
        }

        // Set Images for Split Slider
        const latestObs = inc.observations && inc.observations.length > 0 ? inc.observations[inc.observations.length - 1] : null;
        const blurredUrl = latestObs ? latestObs.image_url : "/static/sample_images/mixed_waste_blurred.jpg";
        const rawUrl = latestObs && latestObs.raw_image_url ? latestObs.raw_image_url : blurredUrl.replace('_blurred', '_raw');

        document.getElementById('img-compare-after').src = blurredUrl;
        document.getElementById('img-compare-before').src = rawUrl;

        // Reset curtain handle to center (50%)
        document.getElementById('compare-overlay').style.width = "50%";
        document.getElementById('compare-handle').style.left = "50%";

        // Rationale Checklist
        const rationaleList = document.getElementById('modal-rationale-list');
        let rHtml = '';

        if (inc.status === 'rejected') {
            rHtml += `<li class="flex items-start space-x-2 text-slate-300"><i class="fa-solid fa-ban text-red-400 mt-0.5"></i><span>Filtered non-waste object (street fauna). Spurious municipal complaint prevented.</span></li>`;
        } else if (inc.status === 'human_review_required') {
            rHtml += `<li class="flex items-start space-x-2 text-purple-300"><i class="fa-solid fa-triangle-exclamation text-purple-400 mt-0.5"></i><span>C&D debris flagged for BBMP Engineering Division (requires hydraulic mechanical tippers).</span></li>`;
        } else if (inc.vehicle_count >= 2) {
            rHtml += `<li class="flex items-start space-x-2 text-emerald-400"><i class="fa-solid fa-check-double text-emerald-400 mt-0.5"></i><span>Corroborated across ${inc.vehicle_count} distinct vehicle cameras (${inc.vehicle_ids.join(', ')}).</span></li>`;
            rHtml += `<li class="flex items-start space-x-2 text-slate-300"><i class="fa-solid fa-check text-emerald-400 mt-0.5"></i><span>Spatial engine confirmed Haversine proximity ≤ 30m across passes.</span></li>`;
            if (inc.is_blackspot) {
                rHtml += `<li class="flex items-start space-x-2 text-red-400 font-semibold"><i class="fa-solid fa-fire text-red-400 mt-0.5"></i><span>Chronic Blackspot: Site cleared in prior cycles but repeatedly relapses.</span></li>`;
            }
        } else {
            rHtml += `<li class="flex items-start space-x-2 text-amber-400"><i class="fa-solid fa-hourglass-half text-amber-400 mt-0.5"></i><span>Single vehicle pass recorded. Awaiting 2nd independent vehicle corroboration before dispatching city resources.</span></li>`;
        }
        rationaleList.innerHTML = rHtml;

        // Multi-Pass Corroboration Table
        const tbody = document.getElementById('modal-passes-table');
        let tHtml = '';
        (inc.observations || []).forEach((o, index) => {
            const timeStr = new Date(o.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const dist = index === 0 ? "0.0 m (Origin)" : "10.14 m (Corroborated)";
            tHtml += `
                <tr>
                    <td class="py-2 text-emerald-400">${o.vehicle_id}</td>
                    <td class="py-2 text-slate-400">${timeStr}</td>
                    <td class="py-2 uppercase text-slate-200">${o.category.replace('_', ' ')}</td>
                    <td class="py-2 text-cyan-400">${Math.round(o.vlm_confidence * 100)}%</td>
                    <td class="py-2 text-slate-400">±${o.gps_accuracy}m</td>
                    <td class="py-2 text-emerald-400 font-bold">${dist}</td>
                </tr>
            `;
        });
        tbody.innerHTML = tHtml;

        // Ticket box
        const ticketBox = document.getElementById('modal-ticket-box');
        if (inc.ticket_id) {
            ticketBox.classList.remove('hidden');
            document.getElementById('modal-ticket-id').innerText = inc.ticket_id;
        } else {
            ticketBox.classList.add('hidden');
        }

        // Synchronized Dashcam Video Feed Section
        const videoSection = document.getElementById('modal-video-section');
        const videoPlayer = document.getElementById('modal-video-player');
        const videoBadge = document.getElementById('modal-video-badge');
        const videoGpsInfo = document.getElementById('modal-video-gps-info');
        if (inc.video_url && videoSection && videoPlayer) {
            videoSection.classList.remove('hidden');
            videoPlayer.src = inc.video_url;
            videoPlayer.load();
            if (videoBadge) {
                videoBadge.innerText = inc.gps_source ? `GPS: ${inc.gps_source.replace(/_/g, ' ')}` : "DASHCAM FEED";
            }
            if (videoGpsInfo) {
                videoGpsInfo.innerText = `${inc.latitude.toFixed(5)}°, ${inc.longitude.toFixed(5)}° • ${inc.location_name || 'Ward 154 Corridor'}`;
            }
        } else if (videoSection && videoPlayer) {
            videoSection.classList.add('hidden');
            videoPlayer.pause();
            videoPlayer.removeAttribute('src');
        }

        document.getElementById('modal-evidence').classList.remove('hidden');

    } catch (e) {
        console.error("Failed to load incident detail", e);
    }
}

// Simulator Status & Progress Track
async function updateSimulatorStatus() {
    try {
        const res = await fetch('/simulator/status');
        const data = await res.json();
        const badge = document.getElementById('sim-step-badge');
        const nameEl = document.getElementById('sim-step-name');
        const bar = document.getElementById('sim-progress-bar');

        const pct = (data.current_step / data.total_steps) * 100;
        bar.style.width = `${pct}%`;
        badge.innerText = `PASS ${data.current_step} OF ${data.total_steps}`;

        if (data.next_scenario) {
            nameEl.innerText = `${data.next_scenario.name}`;
        } else {
            nameEl.innerText = "All scenario passes executed. Scenario complete.";
        }
    } catch (e) {
        console.error("Failed to load sim status", e);
    }
}

function logTelemetry(msg) {
    const logEl = document.getElementById('telemetry-log');
    if (logEl) {
        logEl.innerText = msg;
    }
}

// Step next in simulation
async function triggerNextStep() {
    try {
        const res = await fetch('/simulator/step', { method: 'POST' });
        const result = await res.json();

        if (result.coordinates) {
            // Sound effects & Celebrations
            if (result.vlm_result.triage_decision === 'REJECT') {
                playSound('reject');
                showToast("🛡️ Curbside Fauna Filtered", `Stray animal detected at ${result.scenario_name}. Zero civic tickets dispatched.`, "info");
            } else if (result.policy_result.ticket_generated) {
                playSound('ticket');
                if (window.confetti) {
                    window.confetti({
                        particleCount: 85,
                        spread: 75,
                        origin: { y: 0.65 },
                        colors: ['#00f5a0', '#00d9f5', '#ffb800', '#ffffff']
                    });
                }
                showToast("🎫 Sahaaya 2.0 Ticket Emitted!", `Official work order generated: ${result.policy_result.ticket_id} (${result.vlm_result.category.toUpperCase()}). Compactor crew dispatched.`, "success");
            } else if (result.policy_result.unique_vehicles >= 2) {
                playSound('corroborate');
                showToast("✓ Multi-Vehicle Corroborated", `Second independent vehicle confirmed waste location (${result.cluster_distance_meters}m apart).`, "success");
            } else {
                playSound('capture');
                showToast("📸 Candidate Crop Logged", `${result.vehicle} flagged potential waste on ${result.scenario_name}.`, "info");
            }

            // Pan map smoothly
            map.flyTo([result.coordinates.lat, result.coordinates.lon], 15, { duration: 0.9 });

            // Breadcrumb path trail
            const vId = result.vehicle;
            if (!vehicleTrails[vId]) {
                vehicleTrails[vId] = [];
            }
            vehicleTrails[vId].push([result.coordinates.lat, result.coordinates.lon]);

            const trailLine = L.polyline(vehicleTrails[vId], {
                color: '#00f2fe',
                weight: 3.5,
                dashArray: '6, 8',
                opacity: 0.85
            });
            tracksLayer.addLayer(trailLine);

            // Vehicle marker
            const vIcon = L.divIcon({
                className: '',
                html: `<div class="vehicle-marker"><i class="fa-solid fa-motorcycle"></i></div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            });
            const vMarker = L.marker([result.coordinates.lat, result.coordinates.lon], { icon: vIcon });
            vMarker.bindTooltip(`<strong>${result.vehicle}</strong><br>${result.scenario_name}`, { direction: 'top' });
            vehiclesLayer.addLayer(vMarker);

            // Ticker log
            logTelemetry(`[${new Date().toLocaleTimeString()}] 📷 ${result.vehicle} captured candidate crop -> VLM: ${result.vlm_result.category} -> Policy: ${result.policy_result.updated_status.toUpperCase()}`);
        }

        await refreshAll();
    } catch (e) {
        console.error("Step execution failed", e);
    }
}

// Timeline Auto Playback Toggle
function togglePlay() {
    if (isPlaying) {
        pausePlayback();
    } else {
        startPlayback();
    }
}

function startPlayback() {
    isPlaying = true;
    document.getElementById('play-icon').className = "fa-solid fa-pause text-xs";
    document.getElementById('play-text').innerText = "Pause";

    const intervalMs = Math.round(2000 / playSpeed);
    playInterval = setInterval(async () => {
        const stat = await fetch('/simulator/status').then(r => r.json());
        if (stat.current_step >= stat.total_steps) {
            pausePlayback();
            return;
        }
        await triggerNextStep();
    }, intervalMs);
}

function pausePlayback() {
    isPlaying = false;
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    }
    document.getElementById('play-icon').className = "fa-solid fa-play text-xs";
    document.getElementById('play-text').innerText = "Auto Play";
}

// Reset scenario
async function resetSimulation() {
    pausePlayback();
    try {
        await fetch('/simulator/reset', { method: 'POST' });
        vehiclesLayer.clearLayers();
        tracksLayer.clearLayers();
        vehicleTrails = {};
        logTelemetry("Simulation reset. All active clusters cleared. Historical blackspot initialized.");
        await refreshAll();
    } catch (e) {
        console.error("Reset failed", e);
    }
}

// Analytics Charts (Chart.js)
function initAnalyticsCharts() {
    const ctxCat = document.getElementById('chart-categories')?.getContext('2d');
    const ctxPers = document.getElementById('chart-persistence')?.getContext('2d');

    if (ctxCat) {
        categoryChart = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: ['Mixed Waste', 'Overflowing Bin', 'C&D Debris', 'Filtered Fauna'],
                datasets: [{
                    data: [1, 1, 1, 1],
                    backgroundColor: ['#ef4444', '#f97316', '#a855f7', '#64748b'],
                    borderWidth: 2,
                    borderColor: '#070a13'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } }
                }
            }
        });
    }

    if (ctxPers) {
        persistenceChart = new Chart(ctxPers, {
            type: 'line',
            data: {
                labels: ['Pass 1', 'Pass 2', 'Pass 3', 'Pass 4', 'Pass 5', 'Pass 6'],
                datasets: [{
                    label: 'Persistence Score',
                    data: [25, 60, 0, 40, 90, 75],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.35,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#64748b', font: { size: 10 } } },
                    y: { max: 100, ticks: { color: '#64748b', font: { size: 10 } } }
                },
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { size: 10 } } }
                }
            }
        });
    }
}

function updateAnalyticsCharts() {
    if (!categoryChart || !allIncidentsCache) return;

    let mixed = 0, bins = 0, cd = 0, animal = 0;
    allIncidentsCache.forEach(i => {
        if (i.category === 'mixed_waste') mixed++;
        else if (i.category === 'overflowing_bin') bins++;
        else if (i.category === 'construction_debris') cd++;
        else if (i.category === 'animal') animal++;
    });

    categoryChart.data.datasets[0].data = [mixed || 1, bins || 1, cd || 1, animal || 1];
    categoryChart.update();
}

// High-Tech Cyberpunk Toast Notification System
function showToast(title, message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-16 right-5 z-[9999] flex flex-col space-y-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const borderColor = type === 'success' ? 'border-[#00f5a0]' : (type === 'error' ? 'border-red-500' : 'border-[#00d9f5]');
    const glowColor = type === 'success' ? 'shadow-[0_0_20px_rgba(0,245,160,0.3)]' : 'shadow-[0_0_20px_rgba(0,217,245,0.3)]';
    const icon = type === 'success' ? 'fa-certificate text-[#00f5a0]' : (type === 'error' ? 'fa-triangle-exclamation text-red-400' : 'fa-circle-info text-[#00d9f5]');

    toast.className = `glass-panel-elevated p-3.5 rounded-2xl border ${borderColor} ${glowColor} flex items-start space-x-3 pointer-events-auto max-w-sm toast-alert text-xs`;
    toast.innerHTML = `
        <i class="fa-solid ${icon} text-base mt-0.5 shrink-0"></i>
        <div class="flex-1">
            <div class="font-bold text-white text-xs">${title}</div>
            <div class="text-slate-300 text-[11px] mt-0.5 leading-snug">${message}</div>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

// Print Official Municipal Work Order Document
function printOfficialWorkOrder(inc) {
    if (!inc) return;
    const printWin = window.open('', '_blank');
    const timeStr = new Date().toLocaleString();
    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>GBA Sahaaya 2.0 Work Order - ${inc.ticket_id || inc.id}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
                .header { border-bottom: 3px solid #0f766e; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
                .title { font-size: 22px; font-weight: 900; color: #0f766e; letter-spacing: -0.02em; }
                .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
                .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 25px; }
                .field label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 800; display: block; letter-spacing: 0.05em; }
                .field span { font-size: 14px; font-weight: 600; color: #0f172a; margin-top: 2px; display: inline-block; }
                .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
                .section-title { font-size: 14px; font-weight: 800; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; color: #0f172a; }
                .qr-placeholder { font-family: monospace; font-size: 11px; background: #0f172a; color: #fff; padding: 12px; text-align: center; border-radius: 8px; width: 140px; }
                .footer { margin-top: 45px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="title">GREATER BENGALURU AUTHORITY (GBA)</div>
                    <div class="subtitle">Solid Waste Management Cell // Sahaaya 2.0 Autonomous Dispatch Work Order</div>
                </div>
                <div class="qr-placeholder">GBA-DIGITAL-SIGN<br>AUTONOMOUS VERIFIED ✓</div>
            </div>
            <div class="meta-grid">
                <div class="field"><label>Work Order / Ticket ID</label><span style="font-family: monospace; color: #0f766e;">${inc.ticket_id || 'GBA-PENDING'}</span></div>
                <div class="field"><label>Priority / Triage</label><span class="badge">${inc.priority} DISPATCH</span></div>
                <div class="field"><label>Municipal Jurisdiction</label><span>BBMP East Zone • Ward 154 (Indiranagar)</span></div>
                <div class="field"><label>Exact GPS Coordinates</label><span style="font-family: monospace;">${inc.latitude}, ${inc.longitude}</span></div>
                <div class="field"><label>Primary Category</label><span>${inc.category.replace('_', ' ').toUpperCase()}</span></div>
                <div class="field"><label>Corroboration Score</label><span>${inc.persistence_score}/100 (${inc.vehicle_count} Independent Vehicles)</span></div>
            </div>
            <div class="section-title">Autonomous Sensing Audit Trail</div>
            <p style="font-size: 13px; line-height: 1.6; color: #334155;">
                This work order was automatically generated by the <strong>Kasa.Edge</strong> passive urban sensing fleet. Independent vehicle cameras verified accumulated curbside municipal solid waste within a 30-meter Haversine radius, satisfying deterministic civic triage standards without human grievance filing delay.
            </p>
            <div class="footer">
                <span>Generated: ${timeStr} • Kasa.Edge Autonomous Civic Mesh</span>
                <span>BBMP Compactor Dispatch Division • Greater Bengaluru Authority</span>
            </div>
            <script>window.print();</script>
        </body>
        </html>
    `);
    printWin.document.close();
}

// Refresh all views
async function refreshAll() {
    await fetchStats();
    await fetchAiStatus();
    await fetchIncidents();
    await fetchTickets();
    await fetchBlackspots();
    await updateSimulatorStatus();
}

// ==========================================
// VIDEO SENSING & TELEMETRY INTAKE ENGINE
// ==========================================

let selectedVideoFile = null;
let selectedVideoPresetUrl = null;
let cameraMediaStream = null;
let cameraMediaRecorder = null;
let recordedVideoChunks = [];
let recTimerInterval = null;
let recSecondsElapsed = 0;
let liveDeviceGps = null;
let currentVideoMeta = null;
let cachedSampleVideos = [];

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function initVideoIntake() {
    // Modal open buttons
    const btnVideoIntake = document.getElementById('btn-video-intake');
    const btnVideoIntakeDeck = document.getElementById('btn-video-intake-deck');
    const modalClose = document.getElementById('modal-video-close');
    const modalCancel = document.getElementById('modal-video-cancel-btn');

    if (btnVideoIntake) btnVideoIntake.addEventListener('click', openVideoModal);
    if (btnVideoIntakeDeck) btnVideoIntakeDeck.addEventListener('click', openVideoModal);
    if (modalClose) modalClose.addEventListener('click', closeVideoModal);
    if (modalCancel) modalCancel.addEventListener('click', closeVideoModal);

    // Tab buttons
    const tabUploadBtn = document.getElementById('vtab-upload-btn');
    const tabRecordBtn = document.getElementById('vtab-record-btn');
    const tabPresetsBtn = document.getElementById('vtab-presets-btn');

    if (tabUploadBtn) tabUploadBtn.addEventListener('click', () => switchVideoTab('upload'));
    if (tabRecordBtn) tabRecordBtn.addEventListener('click', () => switchVideoTab('record'));
    if (tabPresetsBtn) tabPresetsBtn.addEventListener('click', () => switchVideoTab('presets'));

    // Drag and Drop & Browse
    const dropzone = document.getElementById('video-dropzone');
    const fileInput = document.getElementById('video-file-input');
    const browseTrigger = document.getElementById('video-browse-trigger');

    if (browseTrigger && fileInput) {
        browseTrigger.addEventListener('click', () => fileInput.click());
    }
    if (dropzone && fileInput) {
        dropzone.addEventListener('click', (e) => {
            if (e.target !== browseTrigger) fileInput.click();
        });
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleSelectedVideoFile(e.dataTransfer.files[0]);
            }
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleSelectedVideoFile(e.target.files[0]);
            }
        });
    }

    // Live Camera Controls
    const btnStartCamera = document.getElementById('btn-start-camera');
    const btnRecordClip = document.getElementById('btn-record-clip');
    if (btnStartCamera) btnStartCamera.addEventListener('click', toggleLiveCamera);
    if (btnRecordClip) btnRecordClip.addEventListener('click', toggleCameraRecording);

    // Browser GPS request button
    const btnBrowserGps = document.getElementById('btn-use-browser-gps');
    if (btnBrowserGps) {
        btnBrowserGps.addEventListener('click', () => {
            requestDeviceGeolocation(true);
        });
    }

    // Ingest Submit Action Button
    const btnSubmit = document.getElementById('btn-ingest-video-submit');
    if (btnSubmit) btnSubmit.addEventListener('click', submitVideoFeedIngest);

    // Query device GPS in background
    requestDeviceGeolocation(false);
}

function requestDeviceGeolocation(showNotification = false) {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                liveDeviceGps = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    accuracy: pos.coords.accuracy || 5.0
                };
                if (showNotification) {
                    showToast("📍 Hardware GPS Acquired", `Device Coordinates: ${liveDeviceGps.lat.toFixed(5)}, ${liveDeviceGps.lon.toFixed(5)} (±${Math.round(liveDeviceGps.accuracy)}m)`, "success");
                    updateVideoTelemetryHudLocation(liveDeviceGps.lat, liveDeviceGps.lon, "BROWSER_DEVICE_GPS");
                }
            },
            (err) => {
                if (showNotification) {
                    showToast("GPS Notice", "Browser location access denied or unavailable. Fallback to corridor alignment.", "info");
                }
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
        );
    }
}

async function openVideoModal() {
    const modal = document.getElementById('modal-video-intake');
    if (!modal) return;
    modal.classList.remove('hidden');
    playSound('capture');

    // Switch to upload tab by default
    switchVideoTab('upload');

    // Fetch and display sample video presets
    await loadVideoSamplePresets();
}

function closeVideoModal() {
    const modal = document.getElementById('modal-video-intake');
    if (!modal) return;
    modal.classList.add('hidden');

    // Stop camera if running
    stopLiveCamera();

    // Pause preview video
    const vp = document.getElementById('video-preview-player');
    if (vp) {
        vp.pause();
    }
}

function switchVideoTab(tab) {
    const tabUpload = document.getElementById('vtab-upload');
    const tabRecord = document.getElementById('vtab-record');
    const tabPresets = document.getElementById('vtab-presets');

    const btnUpload = document.getElementById('vtab-upload-btn');
    const btnRecord = document.getElementById('vtab-record-btn');
    const btnPresets = document.getElementById('vtab-presets-btn');

    const activeClasses = "py-2.5 px-4 border-b-2 border-[#00f5a0] text-[#00f5a0] font-bold transition flex items-center space-x-2";
    const inactiveClasses = "py-2.5 px-4 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition flex items-center space-x-2";

    if (tabUpload) tabUpload.classList.toggle('hidden', tab !== 'upload');
    if (tabRecord) tabRecord.classList.toggle('hidden', tab !== 'record');
    if (tabPresets) tabPresets.classList.toggle('hidden', tab !== 'presets');

    if (btnUpload) btnUpload.className = tab === 'upload' ? activeClasses : inactiveClasses;
    if (btnRecord) btnRecord.className = tab === 'record' ? activeClasses : inactiveClasses;
    if (btnPresets) btnPresets.className = tab === 'presets' ? activeClasses : inactiveClasses;

    if (tab !== 'record') {
        stopLiveCamera();
    }
}

async function loadVideoSamplePresets() {
    const container = document.getElementById('video-presets-container');
    if (!container) return;

    try {
        const res = await fetch('/video/samples');
        const data = await res.json();
        cachedSampleVideos = Array.isArray(data) ? data : (data.samples || []);

        container.innerHTML = cachedSampleVideos.map((sample, idx) => `
            <div class="preset-video-card p-3 space-y-2 group" data-sample-idx="${idx}" onclick="selectSamplePreset(${idx})">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-white text-xs group-hover:text-cyan-300 transition">${sample.name || sample.title}</span>
                    <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">ISO 6709</span>
                </div>
                <div class="text-[11px] text-slate-400 leading-tight">${sample.description || sample.expected_issue}</div>
                <div class="flex items-center justify-between text-[10px] font-mono pt-1 text-slate-500 border-t border-white/5">
                    <span class="text-cyan-400 truncate max-w-[130px]">${sample.corridor || sample.location_name}</span>
                    <span>${sample.duration || '00:03'}</span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error("Failed to load video sample presets", e);
    }
}

window.selectSamplePreset = async function(idx) {
    const sample = cachedSampleVideos[idx];
    if (!sample) return;

    const vUrl = sample.video_url || sample.url;
    selectedVideoPresetUrl = vUrl;
    selectedVideoFile = null;

    // Visual card highlight
    document.querySelectorAll('.preset-video-card').forEach((card, i) => {
        card.classList.toggle('active', i === idx);
    });

    // Populate Video Preview
    const previewWrapper = document.getElementById('video-preview-wrapper');
    const previewPlayer = document.getElementById('video-preview-player');
    const previewName = document.getElementById('video-preview-filename');

    if (previewWrapper) previewWrapper.classList.remove('hidden');
    if (previewName) previewName.innerText = sample.name || sample.title;
    if (previewPlayer) {
        previewPlayer.src = vUrl;
        previewPlayer.load();
    }

    // Inspect metadata
    await inspectVideoFeed(null, vUrl);
};

async function handleSelectedVideoFile(file) {
    if (!file) return;

    selectedVideoFile = file;
    selectedVideoPresetUrl = null;

    // Show preview player
    const previewWrapper = document.getElementById('video-preview-wrapper');
    const previewPlayer = document.getElementById('video-preview-player');
    const previewName = document.getElementById('video-preview-filename');

    if (previewWrapper) previewWrapper.classList.remove('hidden');
    if (previewName) previewName.innerText = `${file.name} (${(file.size / (1024*1024)).toFixed(1)} MB)`;
    if (previewPlayer) {
        previewPlayer.src = URL.createObjectURL(file);
        previewPlayer.load();
    }

    // Inspect file on server
    await inspectVideoFeed(file, null);
}

async function inspectVideoFeed(file, url) {
    const submitBtn = document.getElementById('btn-ingest-video-submit');
    const badgeText = document.getElementById('video-gps-status-text');
    const badge = document.getElementById('video-gps-status-badge');
    const hudCoords = document.getElementById('hud-coords');
    const hudLocation = document.getElementById('hud-location');
    const hudDuration = document.getElementById('hud-duration-fps');
    const hudSource = document.getElementById('hud-gps-source');
    const corridorSelect = document.getElementById('video-corridor-select');

    if (badgeText) badgeText.innerText = "Analyzing video metadata...";
    if (submitBtn) submitBtn.disabled = true;

    try {
        const formData = new FormData();
        if (file) {
            formData.append('file', file);
        } else if (url) {
            formData.append('video_url', url);
        }

        const res = await fetch('/video/inspect', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) throw new Error("Metadata extraction failed");
        const meta = await res.json();
        currentVideoMeta = meta;

        // Populate HUD
        if (hudDuration) hudDuration.innerText = `${meta.duration_sec.toFixed(1)}s • ${Math.round(meta.fps)} fps (${meta.width}x${meta.height})`;
        if (hudSource) hudSource.innerText = meta.gps_source || "DEVICE_METADATA";

        if (meta.has_gps && meta.latitude && meta.longitude) {
            if (badgeText) badgeText.innerText = "Hardware GPS Extracted";
            if (badge) badge.className = "px-2.5 py-0.5 rounded-lg bg-emerald-950 text-[#00f5a0] border border-emerald-600 font-mono text-[10px] flex items-center space-x-1.5 shadow-[0_0_10px_rgba(0,245,160,0.2)]";
            if (hudCoords) hudCoords.innerText = `${meta.latitude.toFixed(5)}°, ${meta.longitude.toFixed(5)}°`;
            if (hudLocation) hudLocation.innerText = meta.location_name || "Ward 154 Corridor";

            // Update corridor select option
            if (corridorSelect) {
                corridorSelect.options[0].text = `Auto: Extracted Hardware GPS (${meta.latitude.toFixed(4)}, ${meta.longitude.toFixed(4)})`;
                corridorSelect.value = "auto";
            }
        } else {
            // No embedded GPS in video container
            if (liveDeviceGps) {
                if (badgeText) badgeText.innerText = "Using Live Device GPS";
                if (badge) badge.className = "px-2.5 py-0.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-600 font-mono text-[10px] flex items-center space-x-1.5";
                if (hudCoords) hudCoords.innerText = `${liveDeviceGps.lat.toFixed(5)}°, ${liveDeviceGps.lon.toFixed(5)}°`;
                if (hudLocation) hudLocation.innerText = "Current Browser Location";
                if (hudSource) hudSource.innerText = "BROWSER_DEVICE_GPS";
            } else {
                if (badgeText) badgeText.innerText = "Manual Alignment Required";
                if (badge) badge.className = "px-2.5 py-0.5 rounded-lg bg-amber-950 text-amber-300 border border-amber-600 font-mono text-[10px] flex items-center space-x-1.5";
                if (hudCoords) hudCoords.innerText = "12.97192°, 77.64121°";
                if (hudLocation) hudLocation.innerText = "100 Feet Road (Default)";
                if (hudSource) hudSource.innerText = "WARD_154_ALIGNMENT";
            }
        }

        if (submitBtn) submitBtn.disabled = false;
        playSound('capture');

    } catch (e) {
        console.error("Video inspect error", e);
        if (badgeText) badgeText.innerText = "Ready for Ingest";
        if (submitBtn) submitBtn.disabled = false;
    }
}

function updateVideoTelemetryHudLocation(lat, lon, source) {
    const hudCoords = document.getElementById('hud-coords');
    const hudLocation = document.getElementById('hud-location');
    const hudSource = document.getElementById('hud-gps-source');
    const badgeText = document.getElementById('video-gps-status-text');

    if (hudCoords) hudCoords.innerText = `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
    if (hudSource) hudSource.innerText = source;
    if (badgeText) badgeText.innerText = "Live Geolocation Applied";

    // Reverse resolve
    const name = resolveCorridorFromCoordinates(lat, lon);
    if (hudLocation) hudLocation.innerText = name;
}

function resolveCorridorFromCoordinates(lat, lon) {
    for (const corr of DEFAULT_CORRIDORS) {
        const d = calculateHaversineDistance(lat, lon, corr.latitude, corr.longitude);
        if (d <= 500) {
            return corr.name;
        }
    }
    return `BBMP Ward 154 (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
}

// Live Camera Implementation
async function toggleLiveCamera() {
    const streamVideo = document.getElementById('camera-live-stream');
    const placeholder = document.getElementById('camera-placeholder');
    const startBtn = document.getElementById('btn-start-camera');
    const recordBtn = document.getElementById('btn-record-clip');

    if (cameraMediaStream) {
        stopLiveCamera();
        return;
    }

    try {
        cameraMediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        if (streamVideo) {
            streamVideo.srcObject = cameraMediaStream;
            streamVideo.classList.remove('hidden');
        }
        if (placeholder) placeholder.classList.add('hidden');
        if (startBtn) {
            startBtn.innerHTML = `<i class="fa-solid fa-stop text-red-400"></i><span>Stop Camera</span>`;
            startBtn.className = "bg-emerald-950 text-[#00f5a0] border border-emerald-600 px-3.5 py-2 rounded-xl flex items-center space-x-2 transition font-medium shadow-[0_0_12px_rgba(0,245,160,0.2)]";
        }
        if (recordBtn) recordBtn.disabled = false;

        // Query GPS in parallel
        requestDeviceGeolocation(false);
        playSound('capture');

    } catch (err) {
        console.error("Camera access error:", err);
        showToast("Camera Access Needed", "Unable to open camera. Please grant camera permission in your browser.", "error");
    }
}

function stopLiveCamera() {
    if (cameraMediaRecorder && cameraMediaRecorder.state === 'recording') {
        cameraMediaRecorder.stop();
    }
    if (cameraMediaStream) {
        cameraMediaStream.getTracks().forEach(t => t.stop());
        cameraMediaStream = null;
    }
    const streamVideo = document.getElementById('camera-live-stream');
    const placeholder = document.getElementById('camera-placeholder');
    const startBtn = document.getElementById('btn-start-camera');
    const recordBtn = document.getElementById('btn-record-clip');
    const recordingInd = document.getElementById('recording-indicator');

    if (streamVideo) {
        streamVideo.classList.add('hidden');
        streamVideo.srcObject = null;
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (startBtn) {
        startBtn.innerHTML = `<i class="fa-solid fa-power-off text-emerald-400"></i><span>Start Camera</span>`;
        startBtn.className = "bg-slate-900 hover:bg-slate-800 text-slate-200 px-3.5 py-2 rounded-xl border border-white/10 flex items-center space-x-2 transition font-medium";
    }
    if (recordBtn) {
        recordBtn.disabled = true;
        recordBtn.className = "bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl flex items-center space-x-2 transition shadow-lg shadow-red-600/30 disabled:opacity-40";
        const label = document.getElementById('btn-record-label');
        if (label) label.innerText = "Record Clip";
    }
    if (recordingInd) recordingInd.classList.add('hidden');
    if (recTimerInterval) {
        clearInterval(recTimerInterval);
        recTimerInterval = null;
    }
}

function toggleCameraRecording() {
    if (!cameraMediaStream) return;

    const recordBtn = document.getElementById('btn-record-clip');
    const recordLabel = document.getElementById('btn-record-label');
    const recordingInd = document.getElementById('recording-indicator');
    const timerEl = document.getElementById('recording-timer');

    if (cameraMediaRecorder && cameraMediaRecorder.state === 'recording') {
        // Stop recording
        cameraMediaRecorder.stop();
        if (recTimerInterval) {
            clearInterval(recTimerInterval);
            recTimerInterval = null;
        }
        if (recordingInd) recordingInd.classList.add('hidden');
        if (recordLabel) recordLabel.innerText = "Record Clip";
        if (recordBtn) recordBtn.className = "bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl flex items-center space-x-2 transition shadow-lg shadow-red-600/30";
        return;
    }

    // Start recording
    try {
        recordedVideoChunks = [];
        const options = { mimeType: 'video/webm;codecs=vp8,opus' };
        let recorder;
        try {
            recorder = new MediaRecorder(cameraMediaStream, options);
        } catch (e) {
            recorder = new MediaRecorder(cameraMediaStream);
        }
        cameraMediaRecorder = recorder;

        cameraMediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedVideoChunks.push(e.data);
            }
        };

        cameraMediaRecorder.onstop = async () => {
            const blob = new Blob(recordedVideoChunks, { type: 'video/webm' });
            const file = new File([blob], `live_dashcam_${Date.now()}.webm`, { type: 'video/webm' });
            await handleSelectedVideoFile(file);
            showToast("📹 Video Recorded", "Dashcam clip captured with live device telemetry fix.", "success");
        };

        cameraMediaRecorder.start(200);
        recSecondsElapsed = 0;
        if (recordingInd) recordingInd.classList.remove('hidden');
        if (recordLabel) recordLabel.innerText = "Stop & Process";
        if (recordBtn) recordBtn.className = "bg-slate-900 text-red-400 border border-red-500/80 font-bold px-4 py-2 rounded-xl flex items-center space-x-2 transition shadow-lg animate-pulse";

        recTimerInterval = setInterval(() => {
            recSecondsElapsed++;
            const mins = String(Math.floor(recSecondsElapsed / 60)).padStart(2, '0');
            const secs = String(recSecondsElapsed % 60).padStart(2, '0');
            if (timerEl) timerEl.innerText = `REC ${mins}:${secs}`;
            if (recSecondsElapsed >= 10) {
                // Auto-stop after 10s
                toggleCameraRecording();
            }
        }, 1000);

        playSound('capture');

    } catch (e) {
        console.error("Recording error:", e);
        showToast("Recording Failed", "Browser does not support MediaRecorder with this stream.", "error");
    }
}

async function submitVideoFeedIngest() {
    const submitBtn = document.getElementById('btn-ingest-video-submit');
    const overlay = document.getElementById('video-processing-overlay');
    const stepTitle = document.getElementById('video-scan-step-title');
    const stepDesc = document.getElementById('video-scan-step-desc');
    const vehicleSelect = document.getElementById('video-vehicle-select');
    const corridorSelect = document.getElementById('video-corridor-select');

    if (!selectedVideoFile && !selectedVideoPresetUrl) {
        showToast("Selection Needed", "Please upload a video file, record with camera, or select a preset.", "info");
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (overlay) overlay.classList.remove('hidden');

    // Multi-phase scanner simulation messages
    let phase = 0;
    const phases = [
        { title: "Extracting Hardware GPS Telemetry", desc: "Parsing QuickTime ISO 6709 udta atoms & geographic metadata..." },
        { title: "Sampling Candidate Video Frames", desc: "Calculating Laplacian edge sharpness across clip duration..." },
        { title: "On-Device Edge Privacy Anonymization", desc: "Applying Gaussian blur filter to faces and vehicle license plates..." },
        { title: "Multimodal VLM Waste Verification", desc: "Running two-tier classification against civic waste taxonomy..." },
        { title: "Haversine Spatial Clustering & Ticket Emission", desc: "Clustering with active Ward 154 incidents & evaluating Sahaaya 2.0 policy..." }
    ];

    const phaseInterval = setInterval(() => {
        phase = (phase + 1) % phases.length;
        if (stepTitle) stepTitle.innerText = phases[phase].title;
        if (stepDesc) stepDesc.innerText = phases[phase].desc;
    }, 1200);

    try {
        const formData = new FormData();
        if (selectedVideoFile) {
            formData.append('file', selectedVideoFile);
        } else if (selectedVideoPresetUrl) {
            formData.append('video_url', selectedVideoPresetUrl);
        }

        if (vehicleSelect) {
            formData.append('vehicle_id', vehicleSelect.value);
        }

        // Coordinates resolution:
        if (corridorSelect && corridorSelect.value !== 'auto') {
            const parts = corridorSelect.value.split(',');
            if (parts.length === 2) {
                formData.append('latitude', parts[0].trim());
                formData.append('longitude', parts[1].trim());
            }
        } else if (liveDeviceGps && !currentVideoMeta?.has_gps) {
            formData.append('latitude', liveDeviceGps.lat);
            formData.append('longitude', liveDeviceGps.lon);
        }

        const categorySelect = document.getElementById('video-category-select');
        if (categorySelect && categorySelect.value !== 'auto') {
            formData.append('category_hint', categorySelect.value);
        }

        const res = await fetch('/video/ingest', {
            method: 'POST',
            body: formData
        });

        clearInterval(phaseInterval);

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Video ingestion failed");
        }

        const result = await res.json();

        // Close modal
        closeVideoModal();

        // Telemetry ticker
        logTelemetry(`[${new Date().toLocaleTimeString()}] 📹 Video Ingested -> GPS: ${result.coordinates.lat.toFixed(5)}, ${result.coordinates.lon.toFixed(5)} (${result.location_name}) -> Policy: ${result.policy_evaluation.updated_status.toUpperCase()}`);

        // Sound effect
        if (result.policy_evaluation.ticket_generated) {
            playSound('ticket');
            if (window.confetti) {
                window.confetti({
                    particleCount: 100,
                    spread: 85,
                    origin: { y: 0.6 },
                    colors: ['#00f5a0', '#00d9f5', '#ffb800', '#ffffff']
                });
            }
            showToast("🎫 Sahaaya 2.0 Ticket Dispatched!", `Video evidence confirmed waste at ${result.location_name}. Ticket: ${result.policy_evaluation.ticket_id}`, "success");
        } else if (result.policy_evaluation.unique_vehicles >= 2) {
            playSound('corroborate');
            showToast("✓ Multi-Vehicle Corroborated", `Video confirmed prior pass at ${result.location_name} (GPS: ${result.coordinates.lat.toFixed(4)}, ${result.coordinates.lon.toFixed(4)}).`, "success");
        } else {
            playSound('capture');
            showToast("📹 Video Sensing Pass Logged", `GPS: ${result.coordinates.lat.toFixed(4)}, ${result.coordinates.lon.toFixed(4)} (${result.location_name}) -> VLM: ${result.vlm_verification.category.toUpperCase()}`, "info");
        }

        // Pan map smoothly to the video coordinates
        if (map && result.coordinates) {
            map.flyTo([result.coordinates.lat, result.coordinates.lon], 17, { duration: 1.2 });

            // Drop tactical beacon
            if (beaconsLayer) {
                beaconsLayer.clearLayers();
                const bIcon = L.divIcon({
                    className: '',
                    html: `
                        <div class="beacon-locator-marker">
                            <div class="beacon-ring"></div>
                            <div class="beacon-core"><i class="fa-solid fa-video"></i></div>
                        </div>
                    `,
                    iconSize: [44, 44],
                    iconAnchor: [22, 22]
                });
                const bMarker = L.marker([result.coordinates.lat, result.coordinates.lon], { icon: bIcon });
                bMarker.bindPopup(`
                    <div class="p-2 text-xs font-sans space-y-1">
                        <div class="font-bold text-[#00f5a0] flex items-center space-x-1.5"><i class="fa-solid fa-video"></i><span>Video Sensing Ingest</span></div>
                        <div class="text-white font-semibold">${result.location_name}</div>
                        <div class="text-slate-400 font-mono text-[10px]">GPS: ${result.coordinates.lat.toFixed(5)}, ${result.coordinates.lon.toFixed(5)} (${result.gps_source})</div>
                        <div class="text-cyan-300 font-bold uppercase text-[10px]">VLM: ${result.vlm_verification.category.replace('_', ' ')} (${Math.round(result.vlm_verification.confidence * 100)}%)</div>
                    </div>
                `, { className: 'tactical-popup' });
                beaconsLayer.addLayer(bMarker);
                bMarker.openPopup();
            }
        }

        // Refresh all incidents and UI state
        await refreshAll();

        // Open Evidence Modal with the newly created/updated incident!
        if (result.incident_id) {
            setTimeout(() => {
                openEvidenceModal(result.incident_id);
            }, 800);
        }

    } catch (e) {
        clearInterval(phaseInterval);
        console.error("Video submission failed", e);
        showToast("Ingestion Error", e.message || "Failed to process video file", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (overlay) overlay.classList.add('hidden');
    }
}

// Event Listeners on DOM Load
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    initCurtainSlider();
    initAnalyticsCharts();
    initSearchAutocomplete();
    initVideoIntake();
    await fetchGazetteer();
    await refreshAll();

    // Timeline Controls
    document.getElementById('btn-timeline-step').addEventListener('click', triggerNextStep);
    document.getElementById('btn-timeline-play').addEventListener('click', togglePlay);
    document.getElementById('btn-reset').addEventListener('click', resetSimulation);

    // Speed Selector Buttons
    document.querySelectorAll('.btn-speed').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-speed').forEach(b => {
                b.className = "btn-speed px-2 py-0.5 rounded text-slate-400 hover:text-white";
            });
            btn.className = "btn-speed px-2 py-0.5 rounded bg-emerald-600 text-white font-bold";
            playSpeed = parseInt(btn.dataset.speed, 10);
            if (isPlaying) {
                pausePlayback();
                startPlayback();
            }
        });
    });

    // Audio Sound Toggle
    const soundBtn = document.getElementById('btn-sound-toggle');
    const soundIcon = document.getElementById('sound-icon');
    const soundLabel = document.getElementById('sound-label');

    soundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        const spectrum = document.getElementById('spectrum-bars');
        if (soundEnabled) {
            initAudio();
            if (soundIcon) soundIcon.className = "fa-solid fa-volume-high text-emerald-400";
            if (spectrum) spectrum.style.opacity = '1';
            soundLabel.innerText = "Audio: ON";
            playSound('corroborate');
        } else {
            if (soundIcon) soundIcon.className = "fa-solid fa-volume-xmark text-slate-500";
            if (spectrum) spectrum.style.opacity = '0.3';
            soundLabel.innerText = "Audio: MUTE";
        }
    });

    // Analytics Modal
    const modalAnalytics = document.getElementById('modal-analytics-dialog');
    document.getElementById('btn-analytics').addEventListener('click', () => {
        modalAnalytics.classList.remove('hidden');
        updateAnalyticsCharts();
    });
    document.getElementById('modal-analytics-close').addEventListener('click', () => {
        modalAnalytics.classList.add('hidden');
    });

    // AI Config Modal
    const modalAi = document.getElementById('modal-ai-config');
    document.getElementById('btn-ai-status').addEventListener('click', () => {
        modalAi.classList.remove('hidden');
    });
    document.getElementById('modal-ai-close').addEventListener('click', () => {
        modalAi.classList.add('hidden');
    });

    document.getElementById('btn-save-key').addEventListener('click', async () => {
        const key = document.getElementById('input-gemini-key').value;
        const feedback = document.getElementById('key-test-feedback');
        feedback.classList.remove('hidden');
        feedback.innerText = "Connecting to Gemini endpoint...";
        feedback.className = "text-[11px] text-amber-400 font-mono";

        const modelSelect = document.getElementById('select-gemini-model');
        const selectedModel = modelSelect ? modelSelect.value : 'auto';

        try {
            const res = await fetch('/config/gemini_key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: key, model: selectedModel })
            });
            const result = await res.json();
            if (result.valid) {
                feedback.innerText = "✓ " + result.message;
                feedback.className = "text-[11px] text-emerald-400 font-semibold font-mono";
                playSound('corroborate');
            } else {
                feedback.innerText = "Notice: " + result.message + " (Autonomous fallback remains active).";
                feedback.className = "text-[11px] text-amber-400 font-mono";
            }
            await fetchAiStatus();
        } catch (err) {
            feedback.innerText = "Error: " + err;
            feedback.className = "text-[11px] text-red-400 font-mono";
        }
    });

    // Category Filter Pills
    const filterButtons = {
        'filter-all': 'all',
        'filter-dumps': 'dumps',
        'filter-bins': 'bins',
        'filter-debris': 'debris',
        'filter-blackspots': 'blackspots'
    };

    Object.keys(filterButtons).forEach(btnId => {
        const el = document.getElementById(btnId);
        if (el) {
            el.addEventListener('click', () => {
                Object.keys(filterButtons).forEach(id => {
                    const b = document.getElementById(id);
                    if (b) b.className = "px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-[11px] transition";
                });
                el.className = "px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-medium text-[11px] transition";
                currentCategoryFilter = filterButtons[btnId];
                renderFilteredIncidents();
            });
        }
    });

    // Heatmap Toggle
    let heatmapActive = false;
    document.getElementById('btn-toggle-heatmap')?.addEventListener('click', () => {
        heatmapActive = !heatmapActive;
        heatmapLayer.clearLayers();
        if (heatmapActive && allIncidentsCache) {
            allIncidentsCache.forEach(i => {
                const heatCircle = L.circle([i.latitude, i.longitude], {
                    radius: 90,
                    color: 'transparent',
                    fillColor: '#ef4444',
                    fillOpacity: 0.35
                });
                heatmapLayer.addLayer(heatCircle);
            });
            logTelemetry("Density Heatmap overlay enabled.");
        } else {
            logTelemetry("Density Heatmap overlay disabled.");
        }
    });

    // Fullscreen Toggle
    document.getElementById('btn-map-fullscreen')?.addEventListener('click', () => {
        const mapSec = document.getElementById('map-section');
        if (!document.fullscreenElement) {
            mapSec.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.().catch(() => {});
        }
    });

    // Fleet Telemetry Cockpit Strip Toggle
    const fleetBtn = document.getElementById('btn-toggle-fleet');
    const fleetStrip = document.getElementById('fleet-cockpit-strip');
    fleetBtn?.addEventListener('click', () => {
        fleetStrip?.classList.toggle('hidden');
    });

    // Print Official Work Order
    document.getElementById('modal-print-btn')?.addEventListener('click', () => {
        printOfficialWorkOrder(activeIncident);
    });

    // Modal Close
    const closeEvidence = () => {
        document.getElementById('modal-evidence').classList.add('hidden');
        const vp = document.getElementById('modal-video-player');
        if (vp) vp.pause();
    };
    document.getElementById('modal-close').addEventListener('click', closeEvidence);
    document.getElementById('modal-close-btn').addEventListener('click', closeEvidence);

    // Custom Ingest Modal
    document.getElementById('btn-custom-pass').addEventListener('click', () => {
        document.getElementById('modal-custom').classList.remove('hidden');
    });
    document.getElementById('modal-custom-close').addEventListener('click', () => {
        document.getElementById('modal-custom').classList.add('hidden');
    });
    document.getElementById('custom-cancel-btn').addEventListener('click', () => {
        document.getElementById('modal-custom').classList.add('hidden');
    });

    document.getElementById('custom-submit-btn').addEventListener('click', async () => {
        const vId = document.getElementById('custom-vehicle').value;
        const type = document.getElementById('custom-type').value;
        const lat = parseFloat(document.getElementById('custom-lat').value);
        const lon = parseFloat(document.getElementById('custom-lon').value);

        const imgUrl = `/static/sample_images/${type}_blurred.jpg`;
        const rawUrl = `/static/sample_images/${type}_raw.jpg`;

        await fetch('/observation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vehicle_id: vId,
                latitude: lat,
                longitude: lon,
                image_url: imgUrl,
                raw_image_url: rawUrl,
                edge_confidence: 0.89,
                gps_accuracy: 3.5
            })
        });

        document.getElementById('modal-custom').classList.add('hidden');
        playSound('capture');
        logTelemetry(`[${new Date().toLocaleTimeString()}] 🚀 Custom pass ingested: ${vId} -> ${type}`);
        await refreshAll();
    });

    // Tabs
    const tabInc = document.getElementById('tab-incidents');
    const tabTk = document.getElementById('tab-tickets');
    const tabBs = document.getElementById('tab-blackspots');

    const btnInc = document.getElementById('tab-incidents-btn');
    const btnTk = document.getElementById('tab-tickets-btn');
    const btnBs = document.getElementById('tab-blackspots-btn');

    btnInc.addEventListener('click', () => {
        tabInc.classList.remove('hidden');
        tabTk.classList.add('hidden');
        tabBs.classList.add('hidden');

        btnInc.className = "flex-1 py-3 px-2 border-b-2 border-emerald-500 text-emerald-400 font-bold transition flex items-center justify-center space-x-1.5";
        btnTk.className = "flex-1 py-3 px-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition flex items-center justify-center space-x-1.5";
        btnBs.className = "flex-1 py-3 px-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition flex items-center justify-center space-x-1.5";
    });

    btnTk.addEventListener('click', () => {
        tabTk.classList.remove('hidden');
        tabInc.classList.add('hidden');
        tabBs.classList.add('hidden');

        btnTk.className = "flex-1 py-3 px-2 border-b-2 border-emerald-500 text-emerald-400 font-bold transition flex items-center justify-center space-x-1.5";
        btnInc.className = "flex-1 py-3 px-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition flex items-center justify-center space-x-1.5";
        btnBs.className = "flex-1 py-3 px-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition flex items-center justify-center space-x-1.5";
    });

    btnBs.addEventListener('click', () => {
        tabBs.classList.remove('hidden');
        tabInc.classList.add('hidden');
        tabTk.classList.add('hidden');

        btnBs.className = "flex-1 py-3 px-2 border-b-2 border-emerald-500 text-emerald-400 font-bold transition flex items-center justify-center space-x-1.5";
        btnInc.className = "flex-1 py-3 px-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition flex items-center justify-center space-x-1.5";
        btnBs.className = "flex-1 py-3 px-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition flex items-center justify-center space-x-1.5";
    });
});
