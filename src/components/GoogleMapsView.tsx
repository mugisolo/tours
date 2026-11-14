import React, { useState, useCallback } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  MapCameraChangedEvent,
  MapCameraProps,
} from '@vis.gl/react-google-maps';
import {
  Attraction,
  CATEGORY_META,
} from '../data/ugandaAttractions';
import { TranslationStrings } from '../data/i18n';
import { Layers, Compass, Plus, Check, ExternalLink } from 'lucide-react';

interface GoogleMapsViewProps {
  attractions: Attraction[];
  selectedAttraction: Attraction | null;
  onSelectAttraction: (attraction: Attraction) => void;
  tripIds: string[];
  onToggleTripStop: (id: string) => void;
  t: TranslationStrings;
  onSwitchToLeaflet: () => void;
}

const UGANDA_INITIAL_CAMERA: MapCameraProps = {
  center: { lat: 1.3733, lng: 32.2903 },
  zoom: 7,
};

export const GoogleMapsView: React.FC<GoogleMapsViewProps> = ({
  attractions,
  selectedAttraction,
  onSelectAttraction,
  tripIds,
  onToggleTripStop,
  t,
  onSwitchToLeaflet,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [cameraProps, setCameraProps] = useState<MapCameraProps>(
    selectedAttraction
      ? {
          center: { lat: selectedAttraction.lat, lng: selectedAttraction.lng },
          zoom: 10,
        }
      : UGANDA_INITIAL_CAMERA
  );
  const [activePopupAttr, setActivePopupAttr] = useState<Attraction | null>(
    selectedAttraction
  );
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'terrain' | 'hybrid'>(
    'terrain'
  );

  const handleCameraChange = useCallback((ev: MapCameraChangedEvent) => {
    setCameraProps(ev.detail);
  }, []);

  if (!apiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-stone-100 dark:bg-stone-900 p-6">
        <div className="max-w-md w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-6 space-y-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center mx-auto">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            Google Maps Platform View
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            To use the live `@vis.gl/react-google-maps` Advanced Marker view,
            enable a Google Maps API key in the AI Studio Google Maps Settings
            Panel. You can also explore all 61 Uganda destinations right now on
            the keyless Leaflet OpenStreetMap or 3D Terrain views.
          </p>
          <button
            type="button"
            onClick={onSwitchToLeaflet}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Return to Leaflet OpenStreetMap Explorer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" style={{ height: '100%' }}>
      <APIProvider apiKey={apiKey} language="en" region="UG">
        <GoogleMap
          {...cameraProps}
          mapId="DEMO_MAP_ID"
          mapTypeId={mapTypeId}
          onCameraChanged={handleCameraChange}
          gestureHandling="greedy"
          disableDefaultUI={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {attractions.map((attr) => {
            const meta = CATEGORY_META[attr.category];
            const isSelected = selectedAttraction?.id === attr.id;
            const inTrip = tripIds.includes(attr.id);

            return (
              <AdvancedMarker
                key={attr.id}
                position={{ lat: attr.lat, lng: attr.lng }}
                title={attr.name}
                onClick={() => {
                  setActivePopupAttr(attr);
                  onSelectAttraction(attr);
                }}
              >
                <div
                  style={{
                    width: isSelected ? 40 : 32,
                    height: isSelected ? 40 : 32,
                    background: meta.color,
                    border: isSelected ? '3px solid #facc15' : '2px solid #fff',
                    borderRadius:
                      attr.category === 'city'
                        ? '6px'
                        : attr.category === 'nationalPark'
                        ? '8px 8px 16px 16px'
                        : '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={isSelected ? 20 : 16}
                    height={isSelected ? 20 : 16}
                    fill="#ffffff"
                  >
                    <path d={meta.svgPath} />
                  </svg>
                  {inTrip && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -5,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#b45309',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1.5px solid #fff',
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              </AdvancedMarker>
            );
          })}

          {activePopupAttr && (
            <InfoWindow
              position={{
                lat: activePopupAttr.lat,
                lng: activePopupAttr.lng,
              }}
              maxWidth={300}
              onCloseClick={() => setActivePopupAttr(null)}
            >
              <div className="p-1 text-stone-900 space-y-2 font-sans">
                <div className="text-[11px] font-medium text-stone-500">
                  {t.categories[activePopupAttr.category]} ·{' '}
                  {activePopupAttr.region}
                  {activePopupAttr.unesco ? ' · UNESCO' : ''}
                </div>
                <h4 className="text-sm font-bold text-stone-900">
                  {activePopupAttr.name}
                </h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {activePopupAttr.shortDesc}
                </p>
                <div className="text-[11px] text-stone-700">
                  <strong>{t.popup.bestTime}:</strong>{' '}
                  {activePopupAttr.bestTimeToVisit}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onSelectAttraction(activePopupAttr)}
                    className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded bg-stone-900 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t.popup.fullDetails}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleTripStop(activePopupAttr.id)}
                    className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded bg-amber-700 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {tripIds.includes(activePopupAttr.id) ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        {t.popup.inTrip}
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        {t.popup.addToTrip}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </APIProvider>

      {/* Map Type Switcher Overlay */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/95 dark:bg-stone-900/95 border border-stone-200 dark:border-stone-700 rounded-lg p-1 shadow-sm">
        <Layers className="w-4 h-4 text-stone-500 ml-1.5 mr-1" />
        {(['terrain', 'roadmap', 'hybrid'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMapTypeId(mode)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
              mapTypeId === mode
                ? 'bg-stone-900 text-white dark:bg-amber-600'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
};
