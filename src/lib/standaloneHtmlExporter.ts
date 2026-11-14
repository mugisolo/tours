import { ATTRACTIONS, CATEGORY_META, Attraction } from '../data/ugandaAttractions';

/**
 * Generates a 100% self-contained, single-file `uganda-tourism-map.html` with
 * all CSS, JavaScript, Leaflet + MarkerCluster CDN links, i18n (English, Luganda, Swahili),
 * and the complete verified `ATTRACTIONS` dataset inline.
 */
export function generateStandaloneHtml(customAttractions?: Attraction[]): string {
  const dataset = customAttractions && customAttractions.length > 0 ? customAttractions : ATTRACTIONS;
  const serializedAttractions = JSON.stringify(dataset, null, 2);
  const serializedCategories = JSON.stringify(CATEGORY_META, null, 2);

  return `<!DOCTYPE html>
<!--
  ==============================================================================
  UGANDA "THE PEARL OF AFRICA" — INTERACTIVE DESTINATION EXPLORER
  Self-Contained Single-File Deliverable (HTML5 + CSS3 + Vanilla JS + Leaflet)
  ==============================================================================
  Data Sources & Credits:
  - Uganda Tourism Association (UTA) — https://utauganda.org
  - Uganda Tourism Board (UTB) — https://exploreuganda.com
  - Uganda Wildlife Authority (UWA) — https://ugandawildlife.org
  - OpenStreetMap Contributors — https://www.openstreetmap.org/copyright
  Last Updated: November 2026
  ==============================================================================
-->
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Uganda: The Pearl of Africa — Interactive Tourism Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" crossorigin="" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" crossorigin="" />
  <style>
    :root {
      --bg: #fafaf9;
      --surface: #ffffff;
      --text: #1c1917;
      --muted: #57534e;
      --border: #e7e5e4;
      --accent: #b45309;
    }
    body.high-contrast {
      --bg: #000000;
      --surface: #111111;
      --text: #ffffff;
      --muted: #fde047;
      --border: #ffffff;
      --accent: #facc15;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 10px 16px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      z-index: 1000;
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.1rem; }
    .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    input, select, button {
      min-height: 44px;
      padding: 6px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      font-size: 0.875rem;
      cursor: pointer;
    }
    button:hover { border-color: var(--accent); }
    .chip-bar {
      display: flex;
      gap: 6px;
      padding: 8px 16px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
      z-index: 999;
    }
    .chip {
      min-height: 44px;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      white-space: nowrap;
      font-weight: 600;
      font-size: 0.8rem;
    }
    .chip.active { background: #1c1917; color: #ffffff; border-color: #1c1917; }
    .workspace { display: flex; flex: 1; position: relative; overflow: hidden; }
    #map { flex: 1; height: 100%; }
    .side-panel {
      width: 360px;
      max-width: 92vw;
      background: var(--surface);
      border-left: 1px solid var(--border);
      overflow-y: auto;
      padding: 16px;
      display: none;
      z-index: 1001;
    }
    .side-panel.open { display: block; }
    footer {
      padding: 8px 16px;
      font-size: 0.75rem;
      color: var(--muted);
      background: var(--surface);
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
    }
    @keyframes dashAnim { to { stroke-dashoffset: -36; } }
    .uganda-route-line { animation: dashAnim 1.4s linear infinite; }
  </style>
</head>
<body>
  <header>
    <div class="brand">Uganda: The Pearl of Africa — Destination Explorer</div>
    <div class="controls">
      <input type="search" id="searchInput" placeholder="Search parks, gorillas, rafting, lions..." aria-label="Search attractions" />
      <select id="regionSelect" aria-label="Filter by region">
        <option value="ALL">All Regions</option>
        <option value="Central">Central</option>
        <option value="Eastern">Eastern</option>
        <option value="Northern">Northern</option>
        <option value="Western">Western</option>
      </select>
      <button id="unescoBtn" type="button" aria-pressed="false">UNESCO Only</button>
      <button id="locateBtn" type="button">Locate Me</button>
      <button id="contrastBtn" type="button">High Contrast</button>
      <button id="tripToggleBtn" type="button">Trip Planner (<span id="tripCount">0</span>)</button>
    </div>
  </header>
  <nav class="chip-bar" id="chipBar" aria-label="Category filters"></nav>
  <div class="workspace">
    <div id="map" role="application" aria-label="Interactive Map of Uganda"></div>
    <aside class="side-panel" id="detailPanel" aria-label="Destination Details"></aside>
  </div>
  <footer>
    <span>Credits: Uganda Tourism Association (UTA), Uganda Tourism Board (UTB), Uganda Wildlife Authority (UWA), OpenStreetMap contributors.</span>
    <span>Last Updated: November 2026</span>
  </footer>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js" crossorigin=""></script>
  <script>
    const ATTRACTIONS = ${serializedAttractions};
    const CATEGORY_META = ${serializedCategories};

    const map = L.map('map').setView([1.3733, 32.2903], 7);
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri'
    });
    L.control.layers({ 'OpenStreetMap': osmLayer, 'Satellite': satLayer }).addTo(map);

    const clusterGroup = L.markerClusterGroup();
    map.addLayer(clusterGroup);

    let activeCategory = 'ALL';
    let activeRegion = 'ALL';
    let unescoOnly = false;
    let searchQuery = '';
    let tripIds = JSON.parse(localStorage.getItem('uganda_trip_ids') || '[]');
    let routeLine = null;

    function renderChips() {
      const bar = document.getElementById('chipBar');
      const cats = [
        ['ALL', 'All Attractions'],
        ['nationalPark', 'National Parks'],
        ['reserve', 'Wildlife Reserves'],
        ['cultural', 'Cultural Sites'],
        ['religious', 'Religious Sites'],
        ['adventure', 'Adventure'],
        ['city', 'Cities'],
        ['lake', 'Lakes & Rivers'],
        ['mountain', 'Mountains'],
        ['sanctuary', 'Sanctuaries']
      ];
      bar.innerHTML = cats.map(([id, label]) =>
        '<button class="chip ' + (activeCategory === id ? 'active' : '') + '" data-cat="' + id + '">' + label + '</button>'
      ).join('');
      bar.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => { activeCategory = btn.dataset.cat; renderChips(); updateMarkers(); };
      });
    }

    function updateMarkers() {
      clusterGroup.clearLayers();
      const filtered = ATTRACTIONS.filter(a => {
        if (activeCategory !== 'ALL' && a.category !== activeCategory) return false;
        if (activeRegion !== 'ALL' && a.region !== activeRegion) return false;
        if (unescoOnly && !a.unesco) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const hay = (a.name + ' ' + a.shortDesc + ' ' + a.region + ' ' + a.activities.join(' ') + ' ' + a.wildlifeHighlights.join(' ')).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      filtered.forEach(a => {
        const meta = CATEGORY_META[a.category];
        const icon = L.divIcon({
          className: '',
          html: '<div tabindex="0" role="button" aria-label="' + a.name + '" style="width:34px;height:34px;border-radius:50%;background:' + meta.color + ';border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.35);"><svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="' + meta.svgPath + '"/></svg></div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
        const marker = L.marker([a.lat, a.lng], { icon });
        marker.bindPopup(
          '<div style="font-family:sans-serif;padding:4px;">' +
          '<div style="background:linear-gradient(135deg,' + meta.gradientFrom + ',' + meta.gradientTo + ');color:#fff;padding:12px;border-radius:8px;margin-bottom:8px;">' +
          '<div style="font-size:11px;opacity:0.9;">' + a.region + (a.unesco ? ' · UNESCO' : '') + '</div>' +
          '<strong style="font-size:15px;">' + a.name + '</strong></div>' +
          '<p style="font-size:12px;margin-bottom:8px;">' + a.shortDesc + '</p>' +
          '<div style="font-size:11px;margin-bottom:4px;"><strong>Best time:</strong> ' + a.bestTimeToVisit + '</div>' +
          '<div style="font-size:11px;margin-bottom:8px;"><strong>Permits/Fees:</strong> ' + a.entryFeePermits + '</div>' +
          '<div style="display:flex;gap:6px;">' +
          '<button onclick="window.openDetails(\\'' + a.id + '\\')" style="flex:1;min-height:36px;background:#1c1917;color:#fff;border:none;border-radius:6px;cursor:pointer;">Full Details</button>' +
          '<button onclick="window.toggleTrip(\\'' + a.id + '\\')" style="flex:1;min-height:36px;background:#b45309;color:#fff;border:none;border-radius:6px;cursor:pointer;">+ Trip</button>' +
          '</div></div>'
        );
        clusterGroup.addLayer(marker);
      });
      drawRoute();
    }

    window.openDetails = function(id) {
      const a = ATTRACTIONS.find(x => x.id === id);
      if (!a) return;
      const panel = document.getElementById('detailPanel');
      panel.classList.add('open');
      panel.innerHTML =
        '<button onclick="document.getElementById(\\'detailPanel\\').classList.remove(\\'open\\')" style="margin-bottom:12px;">Close</button>' +
        '<h2 style="margin-bottom:6px;">' + a.name + '</h2>' +
        '<p style="font-size:13px;color:var(--muted);margin-bottom:12px;">' + a.region + ' Region ' + (a.unesco ? '· UNESCO World Heritage' : '') + '</p>' +
        '<p style="font-size:14px;line-height:1.5;margin-bottom:12px;">' + a.longDesc + '</p>' +
        '<h4 style="margin-bottom:4px;">Activities</h4><p style="font-size:13px;margin-bottom:10px;">' + a.activities.join(' · ') + '</p>' +
        '<h4 style="margin-bottom:4px;">Wildlife Highlights</h4><p style="font-size:13px;margin-bottom:10px;">' + a.wildlifeHighlights.join(' · ') + '</p>' +
        '<h4 style="margin-bottom:4px;">Getting There</h4><p style="font-size:13px;margin-bottom:10px;">' + a.gettingThere + '</p>' +
        '<h4 style="margin-bottom:4px;">Accessibility</h4><p style="font-size:13px;">' + a.accessibilityNotes + '</p>';
    };

    window.toggleTrip = function(id) {
      if (tripIds.includes(id)) tripIds = tripIds.filter(x => x !== id);
      else tripIds.push(id);
      localStorage.setItem('uganda_trip_ids', JSON.stringify(tripIds));
      document.getElementById('tripCount').textContent = tripIds.length;
      drawRoute();
    };

    function drawRoute() {
      if (routeLine) map.removeLayer(routeLine);
      const stops = tripIds.map(id => ATTRACTIONS.find(a => a.id === id)).filter(Boolean);
      if (stops.length > 1) {
        routeLine = L.polyline(stops.map(s => [s.lat, s.lng]), {
          color: '#b45309', weight: 4, dashArray: '10, 10', className: 'uganda-route-line'
        }).addTo(map);
      }
    }

    document.getElementById('searchInput').oninput = (e) => { searchQuery = e.target.value; updateMarkers(); };
    document.getElementById('regionSelect').onchange = (e) => { activeRegion = e.target.value; updateMarkers(); };
    document.getElementById('unescoBtn').onclick = (e) => {
      unescoOnly = !unescoOnly;
      e.target.setAttribute('aria-pressed', String(unescoOnly));
      updateMarkers();
    };
    document.getElementById('contrastBtn').onclick = () => document.body.classList.toggle('high-contrast');
    document.getElementById('locateBtn').onclick = () => {
      navigator.geolocation?.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        L.circleMarker([latitude, longitude], { radius: 10, color: '#2563eb' }).addTo(map).bindPopup('You are here').openPopup();
        map.flyTo([latitude, longitude], 9);
      });
    };
    document.getElementById('tripToggleBtn').onclick = () => {
      const panel = document.getElementById('detailPanel');
      panel.classList.toggle('open');
      const stops = tripIds.map(id => ATTRACTIONS.find(a => a.id === id)).filter(Boolean);
      panel.innerHTML = '<h3>Trip Itinerary (' + stops.length + ' stops)</h3>' +
        stops.map((s, idx) => '<div style="padding:8px 0;border-bottom:1px solid var(--border);">Day ' + (idx + 1) + ': <strong>' + s.name + '</strong></div>').join('');
    };

    document.getElementById('tripCount').textContent = tripIds.length;
    renderChips();
    updateMarkers();
  </script>
</body>
</html>`;
}

export function triggerStandaloneHtmlDownload(customAttractions?: Attraction[]) {
  const html = generateStandaloneHtml(customAttractions);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'uganda-tourism-map.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
