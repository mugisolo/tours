import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import {
  Attraction,
  CATEGORY_META,
  AttractionCategory,
} from '../data/ugandaAttractions';
import { TranslationStrings } from '../data/i18n';

interface LeafletMapViewProps {
  attractions: Attraction[];
  selectedAttraction: Attraction | null;
  onSelectAttraction: (attraction: Attraction) => void;
  tripIds: string[];
  orderedTripStops: Attraction[];
  onToggleTripStop: (id: string) => void;
  userLocation: { lat: number; lng: number } | null;
  activeTileLayer: 'standard' | 'terrain' | 'satellite';
  t: TranslationStrings;
}

/**
 * Generates a colorblind-safe SVG marker with distinct geometric outer shapes
 * AND category icons so markers are distinguishable without relying on color alone.
 */
function buildCategoryMarkerHtml(
  category: AttractionCategory,
  isSelected: boolean,
  inTrip: boolean,
  tripIndex: number,
  name: string
): string {
  const meta = CATEGORY_META[category];
  const size = isSelected ? 44 : 36;
  const ringStyle = isSelected
    ? 'box-shadow: 0 0 0 4px #facc15, 0 8px 18px rgba(0,0,0,0.45); transform: scale(1.1);'
    : 'box-shadow: 0 3px 10px rgba(0,0,0,0.32);';

  // Distinct border-radius / clip geometry per category for colorblind shape distinction
  let shapeCss = 'border-radius: 50%;';
  if (category === 'nationalPark') {
    shapeCss = 'border-radius: 8px 8px 18px 18px;'; // Shield silhouette
  } else if (category === 'reserve') {
    shapeCss = 'border-radius: 10px; transform: rotate(0deg);'; // Rounded square
  } else if (category === 'cultural' || category === 'mountain') {
    shapeCss = 'border-radius: 6px;'; // Crisp badge
  } else if (category === 'adventure') {
    shapeCss = 'border-radius: 18px 18px 6px 6px;'; // Dome/arch
  } else if (category === 'city') {
    shapeCss = 'border-radius: 4px;'; // Square block
  }

  const tripBadge = inTrip
    ? `<span style="position:absolute;top:-6px;right:-6px;background:#b45309;color:#fff;border:2px solid #fff;border-radius:999px;width:20px;height:20px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:monospace;">${
        tripIndex + 1
      }</span>`
    : '';

  return `
    <div
      tabindex="0"
      role="button"
      aria-label="${name.replace(/"/g, '&quot;')} (${meta.shapeLabel})"
      style="position:relative;width:${size}px;height:${size}px;background:${meta.color};border:2.5px solid #ffffff;${shapeCss}${ringStyle}display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.15s ease;"
    >
      <svg viewBox="0 0 24 24" width="${isSelected ? 22 : 18}" height="${
    isSelected ? 22 : 18
  }" fill="#ffffff" aria-hidden="true">
        <path d="${meta.svgPath}" />
      </svg>
      ${tripBadge}
    </div>
  `;
}

export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  attractions,
  selectedAttraction,
  onSelectAttraction,
  tripIds,
  orderedTripStops,
  onToggleTripStop,
  userLocation,
  activeTileLayer,
  t,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<any>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.LayerGroup | null>(null);
  const tileLayersRef = useRef<Record<string, L.TileLayer>>({});
  const markersByIdRef = useRef<Record<string, L.Marker>>({});

  // Store latest callbacks in refs so popup DOM buttons always invoke fresh handlers
  const onSelectRef = useRef(onSelectAttraction);
  const onToggleTripRef = useRef(onToggleTripStop);
  useEffect(() => {
    onSelectRef.current = onSelectAttraction;
    onToggleTripRef.current = onToggleTripStop;
  }, [onSelectAttraction, onToggleTripStop]);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [1.3733, 32.2903], // Centered on Uganda
      zoom: 7,
      minZoom: 5,
      maxZoom: 18,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

    const standard = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }
    );

    const terrain = L.tileLayer(
      'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team',
        maxZoom: 19,
      }
    );

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 18,
      }
    );

    tileLayersRef.current = { standard, terrain, satellite };
    standard.addTo(map);

    // Initialize MarkerClusterGroup for smooth 60fps performance
    const clusterGroup = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 42,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="width:40px;height:40px;border-radius:50%;background:#1c1917;color:#ffffff;border:3px solid #f59e0b;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;font-family:monospace;box-shadow:0 4px 12px rgba(0,0,0,0.35);">${count}</div>`,
          className: '',
          iconSize: L.point(40, 40),
        });
      },
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch active tile layer when prop changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.entries(tileLayersRef.current).forEach(([key, layer]) => {
      if (key === activeTileLayer) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    });
  }, [activeTileLayer]);

  // Render markers and lazy popups when visible attractions or trip stops change
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) return;

    clusterGroup.clearLayers();
    markersByIdRef.current = {};

    attractions.forEach((attr) => {
      const isSelected = selectedAttraction?.id === attr.id;
      const tripIndex = orderedTripStops.findIndex((s) => s.id === attr.id);
      const inTrip = tripIndex !== -1 || tripIds.includes(attr.id);
      const meta = CATEGORY_META[attr.category];

      const icon = L.divIcon({
        className: '',
        html: buildCategoryMarkerHtml(
          attr.category,
          isSelected,
          inTrip,
          tripIndex >= 0 ? tripIndex : tripIds.indexOf(attr.id),
          attr.name
        ),
        iconSize: isSelected ? [44, 44] : [36, 36],
        iconAnchor: isSelected ? [22, 22] : [18, 18],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([attr.lat, attr.lng], {
        icon,
        title: attr.name,
        alt: `${attr.name} (${t.categories[attr.category]})`,
      });

      // Lazy-render rich card popup on open
      marker.bindPopup(
        () => {
          const container = document.createElement('div');
          container.className = 'bg-white text-stone-900 font-sans';
          const isCurrentlyInTrip = tripIds.includes(attr.id);
          const top3Activities = attr.activities.slice(0, 3).join(' · ');

          container.innerHTML = `
            <div style="background: linear-gradient(135deg, ${meta.gradientFrom}, ${meta.gradientTo});" class="p-4 text-white relative">
              <div class="flex items-center justify-between text-[11px] font-medium opacity-90 mb-1">
                <span>${t.categories[attr.category]} · ${attr.region}</span>
                ${
                  attr.unesco
                    ? `<span class="underline font-semibold">${t.popup.unescoBadge}</span>`
                    : ''
                }
              </div>
              <h3 class="text-base font-bold leading-snug mb-1">${attr.name}</h3>
              <div class="text-[11px] opacity-80">${attr.imageKeyword}</div>
            </div>
            <div class="p-3.5 space-y-2.5 text-xs">
              <p class="text-stone-700 leading-relaxed">${attr.shortDesc}</p>
              <div class="pt-1 border-t border-stone-200 space-y-1 text-[11px]">
                <div><strong class="text-stone-900">${t.popup.topActivities}:</strong> <span class="text-stone-600">${top3Activities}</span></div>
                <div><strong class="text-stone-900">${t.popup.bestTime}:</strong> <span class="text-stone-600">${attr.bestTimeToVisit}</span></div>
                <div><strong class="text-stone-900">${t.popup.permitsFees}:</strong> <span class="text-stone-600">${attr.entryFeePermits}</span></div>
              </div>
              <div class="flex items-center gap-2 pt-2">
                <button type="button" data-action="details" class="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap">
                  ${t.popup.fullDetails}
                </button>
                <button type="button" data-action="trip" class="flex-1 min-h-[40px] px-3 py-2 rounded-lg ${
                  isCurrentlyInTrip
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : 'bg-amber-700 hover:bg-amber-800 text-white'
                } font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap">
                  ${isCurrentlyInTrip ? t.popup.inTrip : t.popup.addToTrip}
                </button>
              </div>
            </div>
          `;

          const detailsBtn = container.querySelector('[data-action="details"]');
          const tripBtn = container.querySelector('[data-action="trip"]');

          detailsBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectRef.current(attr);
          });

          tripBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            onToggleTripRef.current(attr.id);
            marker.closePopup();
          });

          return container;
        },
        {
          className: 'uganda-custom-popup',
          maxWidth: 320,
          minWidth: 300,
        }
      );

      // Keyboard accessibility on marker element
      marker.on('add', () => {
        const el = marker.getElement();
        if (el) {
          el.addEventListener('keydown', (ev: KeyboardEvent) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              marker.openPopup();
              onSelectRef.current(attr);
            }
          });
        }
      });

      markersByIdRef.current[attr.id] = marker;
      clusterGroup.addLayer(marker);
    });
  }, [attractions, selectedAttraction, tripIds, orderedTripStops, t]);

  // Fly map smoothly when selectedAttraction changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedAttraction) return;

    map.flyTo([selectedAttraction.lat, selectedAttraction.lng], Math.max(map.getZoom(), 9), {
      duration: 1.1,
    });

    const marker = markersByIdRef.current[selectedAttraction.id];
    if (marker && clusterGroupRef.current) {
      clusterGroupRef.current.zoomToShowLayer(marker, () => {
        marker.openPopup();
      });
    }
  }, [selectedAttraction]);

  // Render animated dashed polyline connecting ordered itinerary stops
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (orderedTripStops.length >= 2) {
      const latLngs: L.LatLngExpression[] = orderedTripStops.map((s) => [
        s.lat,
        s.lng,
      ]);
      const polyline = L.polyline(latLngs, {
        color: '#b45309',
        weight: 4,
        opacity: 0.9,
        dashArray: '10, 8',
        className: 'uganda-route-line',
      }).addTo(map);
      routePolylineRef.current = polyline;
    }
  }, [orderedTripStops]);

  // Render user geolocation marker and fly to location
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const group = L.layerGroup();
      const outerCircle = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 16,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.25,
        weight: 2,
      });
      const innerDot = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 7,
        color: '#ffffff',
        fillColor: '#1d4ed8',
        fillOpacity: 1,
        weight: 2.5,
      }).bindPopup('<strong>Your Current Location</strong>');

      group.addLayer(outerCircle);
      group.addLayer(innerDot);
      group.addTo(map);
      userMarkerRef.current = group;

      map.flyTo([userLocation.lat, userLocation.lng], 8, { duration: 1.2 });
    }
  }, [userLocation]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        role="application"
        aria-label="Uganda Interactive Destination Map"
      />
    </div>
  );
};
