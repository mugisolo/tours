import React, { useState, useMemo, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  ATTRACTIONS,
  Attraction,
  AttractionCategory,
  UgandaRegion,
  CATEGORY_META,
  calculateRoadDistanceKm,
  optimizeItineraryStops,
} from './data/ugandaAttractions';
import { I18N, LanguageCode } from './data/i18n';
import { LeafletMapView } from './components/LeafletMapView';
import { GoogleMapsView } from './components/GoogleMapsView';
import { Uganda3DScene } from './components/Uganda3DScene';
import { CloudDriveModal } from './components/CloudDriveModal';
import { triggerStandaloneHtmlDownload } from './lib/standaloneHtmlExporter';
import {
  initAuth,
  SavedTripItinerary,
  SavedBookmark,
  subscribeUserItineraries,
  subscribeUserBookmarks,
  toggleAttractionBookmark,
} from './lib/firebase';
import {
  Search,
  MapPin,
  Compass,
  Route,
  Sparkles,
  Globe,
  Contrast,
  Download,
  Cloud,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Check,
  Trash2,
  Bookmark,
  ExternalLink,
  Navigation,
  Layers,
  Filter,
  RotateCcw,
  Award,
  Calendar,
  Ticket,
  Car,
  Accessibility,
  Box,
} from 'lucide-react';

const LOCAL_STORAGE_TRIP_KEY = 'uganda_pearl_trip_stops_v1';

interface GroundedSource {
  title: string;
  uri: string;
}

interface MapsGroundingPlace {
  title: string;
  uri: string;
  placeId: string;
  reviewSnippets: string[];
}

export default function App() {
  // Dataset state (defaults to verified 61 ATTRACTIONS, expandable via Google Drive / JSON import)
  const [attractionsData, setAttractionsData] =
    useState<Attraction[]>(ATTRACTIONS);

  // Language & Accessibility Theme
  const [lang, setLang] = useState<LanguageCode>('en');
  const t = I18N[lang];
  const [highContrastDark, setHighContrastDark] = useState<boolean>(false);

  // Active Viewport Mode
  const [viewMode, setViewMode] = useState<'leaflet' | 'threeD' | 'googleMaps'>(
    'leaflet'
  );
  const [activeTileLayer, setActiveTileLayer] = useState<
    'standard' | 'terrain' | 'satellite'
  >('standard');

  // Filter & Search States
  const [selectedCategory, setSelectedCategory] = useState<
    AttractionCategory | 'all'
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegions, setSelectedRegions] = useState<UgandaRegion[]>([]);
  const [unescoOnly, setUnescoOnly] = useState<boolean>(false);
  const [selectedActivityFilter, setSelectedActivityFilter] =
    useState<string>('all');
  const [selectedSeasonFilter, setSelectedSeasonFilter] =
    useState<string>('all');
  const [showSmartFiltersBar, setShowSmartFiltersBar] =
    useState<boolean>(false);

  // Selected Attraction (opens Detail Side Panel)
  const [selectedAttraction, setSelectedAttraction] =
    useState<Attraction | null>(null);

  // Trip Itinerary Builder State (persisted in localStorage)
  const [tripIds, setTripIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_TRIP_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return ['murchison-falls-np', 'kibale-np', 'queen-elizabeth-np', 'bwindi-np'];
  });
  const [showItineraryPanel, setShowItineraryPanel] = useState<boolean>(false);

  // Legend & Stats Bar Collapsible State
  const [legendExpanded, setLegendExpanded] = useState<boolean>(true);

  // User Geolocation & 5 Nearest Attractions
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [showNearestPopover, setShowNearestPopover] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Firebase Auth, Saved Itineraries, Bookmarks & Google Drive Modal
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [savedItineraries, setSavedItineraries] = useState<
    SavedTripItinerary[]
  >([]);
  const [bookmarksMap, setBookmarksMap] = useState<
    Record<string, SavedBookmark>
  >({});
  const [showCloudDriveModal, setShowCloudDriveModal] =
    useState<boolean>(false);

  // Live Gemini Grounding State inside Detail Side Panel
  const [groundingLoading, setGroundingLoading] = useState<
    'search' | 'maps' | null
  >(null);
  const [searchGroundingResult, setSearchGroundingResult] = useState<{
    attractionId: string;
    text: string;
    sources: GroundedSource[];
  } | null>(null);
  const [mapsGroundingResult, setMapsGroundingResult] = useState<{
    attractionId: string;
    text: string;
    places: MapsGroundingPlace[];
  } | null>(null);
  const [groundingError, setGroundingError] = useState<string | null>(null);

  // Sync High-Contrast / Dark Class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (highContrastDark) {
      root.classList.add('dark', 'high-contrast-mode');
    } else {
      root.classList.remove('dark', 'high-contrast-mode');
    }
  }, [highContrastDark]);

  // Persist tripIds to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_TRIP_KEY, JSON.stringify(tripIds));
    } catch {
      // ignore
    }
  }, [tripIds]);

  // Initialize Firebase Auth & Real-Time Firestore Subscriptions
  useEffect(() => {
    const unsubAuth = initAuth((u, token) => {
      setUser(u);
      if (token) setAccessToken(token);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedItineraries([]);
      setBookmarksMap({});
      return;
    }
    const unsubTrips = subscribeUserItineraries(user.uid, setSavedItineraries);
    const unsubBookmarks = subscribeUserBookmarks(user.uid, setBookmarksMap);
    return () => {
      unsubTrips();
      unsubBookmarks();
    };
  }, [user]);

  // Clear grounding results when switching selected attraction
  useEffect(() => {
    setGroundingError(null);
  }, [selectedAttraction?.id]);

  // Filter attractions based on search, category, multi-region, UNESCO, activity, and season
  const filteredAttractions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return attractionsData.filter((attr) => {
      if (selectedCategory !== 'all' && attr.category !== selectedCategory) {
        return false;
      }
      if (
        selectedRegions.length > 0 &&
        !selectedRegions.includes(attr.region)
      ) {
        return false;
      }
      if (unescoOnly && !attr.unesco) {
        return false;
      }
      if (
        selectedActivityFilter !== 'all' &&
        !attr.tags.includes(selectedActivityFilter as any)
      ) {
        return false;
      }
      if (
        selectedSeasonFilter === 'dry' &&
        attr.seasonType !== 'dry' &&
        attr.seasonType !== 'allYear'
      ) {
        return false;
      }
      if (
        selectedSeasonFilter === 'green' &&
        attr.seasonType !== 'green' &&
        attr.seasonType !== 'allYear'
      ) {
        return false;
      }

      if (q.length > 0) {
        const haystack = [
          attr.name,
          attr.shortDesc,
          attr.longDesc,
          attr.region,
          attr.category,
          ...attr.activities,
          ...attr.wildlifeHighlights,
          ...attr.tags,
        ]
          .join(' ')
          .toLowerCase();

        // Fuzzy token match (all query words must appear in haystack)
        const tokens = q.split(/\s+/).filter(Boolean);
        const matchesAll = tokens.every((tok) => haystack.includes(tok));
        if (!matchesAll) return false;
      }

      return true;
    });
  }, [
    attractionsData,
    selectedCategory,
    selectedRegions,
    unescoOnly,
    selectedActivityFilter,
    selectedSeasonFilter,
    searchQuery,
  ]);

  // Live visible counts per category (for filter bar & legend)
  const categoryCounts = useMemo(() => {
    const counts: Record<AttractionCategory, number> = {
      nationalPark: 0,
      reserve: 0,
      cultural: 0,
      religious: 0,
      adventure: 0,
      city: 0,
      lake: 0,
      mountain: 0,
      sanctuary: 0,
    };
    filteredAttractions.forEach((a) => {
      if (counts[a.category] !== undefined) {
        counts[a.category] += 1;
      }
    });
    return counts;
  }, [filteredAttractions]);

  // Compute nearest-neighbor ordered itinerary stops & leg-by-leg road distances
  const orderedTripStops = useMemo(() => {
    const rawStops = tripIds
      .map((id) => attractionsData.find((a) => a.id === id))
      .filter((a): a is Attraction => Boolean(a));
    return optimizeItineraryStops(rawStops).ordered;
  }, [tripIds, attractionsData]);

  const tripRouteMetrics = useMemo(() => {
    let totalKm = 0;
    const legs: { stop: Attraction; distanceFromPrevKm: number }[] = [];

    orderedTripStops.forEach((stop, index) => {
      if (index === 0) {
        legs.push({ stop, distanceFromPrevKm: 0 });
      } else {
        const prev = orderedTripStops[index - 1];
        const dist = calculateRoadDistanceKm(
          prev.lat,
          prev.lng,
          stop.lat,
          stop.lng
        );
        totalKm += dist;
        legs.push({ stop, distanceFromPrevKm: dist });
      }
    });

    return { totalKm, legs };
  }, [orderedTripStops]);

  // Compute 5 nearest attractions when userLocation is available
  const nearestFiveAttractions = useMemo(() => {
    if (!userLocation) return [];
    return [...attractionsData]
      .map((attr) => ({
        attraction: attr,
        distanceKm: calculateRoadDistanceKm(
          userLocation.lat,
          userLocation.lng,
          attr.lat,
          attr.lng
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);
  }, [userLocation, attractionsData]);

  const handleToggleTripStop = (id: string) => {
    setTripIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleRegion = (region: UgandaRegion) => {
    setSelectedRegions((prev) =>
      prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region]
    );
  };

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setSelectedRegions([]);
    setUnescoOnly(false);
    setSelectedActivityFilter('all');
    setSelectedSeasonFilter('all');
  };

  const handleLocateUser = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setShowNearestPopover(true);
      },
      () => {
        setIsLocating(false);
        // Fallback to Kampala / Entebbe gateway if user blocks geolocation in iframe
        setUserLocation({ lat: 0.3476, lng: 32.5825 });
        setShowNearestPopover(true);
        setGeoError(
          'Browser location permission declined — showing distances from Kampala Gateway.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleExportTripAsText = () => {
    if (orderedTripStops.length === 0) return;
    const lines: string[] = [
      '============================================================',
      'PEARL OF AFRICA — UGANDA SUGGESTED SAFARI & HERITAGE ROUTE',
      `Generated: ${new Date().toLocaleDateString()}`,
      `Total Stops: ${orderedTripStops.length} | Est. Road Distance: ${tripRouteMetrics.totalKm.toLocaleString()} km`,
      '============================================================',
      '',
    ];

    tripRouteMetrics.legs.forEach((leg, idx) => {
      const s = leg.stop;
      lines.push(
        `DAY ${idx + 1}: ${s.name.toUpperCase()} (${
          t.categories[s.category]
        } — ${s.region} Region)`
      );
      if (idx > 0) {
        lines.push(`  • Drive from previous stop: ~${leg.distanceFromPrevKm} km`);
      } else {
        lines.push(`  • Starting Gateway / Hub: ${s.gettingThere}`);
      }
      lines.push(`  • Highlights: ${s.shortDesc}`);
      lines.push(`  • Top Activities: ${s.activities.slice(0, 4).join(', ')}`);
      lines.push(`  • Permits / Entry: ${s.entryFeePermits}`);
      lines.push(`  • Best Time: ${s.bestTimeToVisit}`);
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uganda-pearl-of-africa-itinerary.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Run Live Google Search Grounding for Selected Attraction
  const runSearchGrounding = async (attr: Attraction) => {
    setGroundingLoading('search');
    setGroundingError(null);
    try {
      const response = await fetch('/api/ai/search-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attractionName: attr.name,
          region: attr.region,
          category: t.categories[attr.category],
        }),
      });
      if (!response.ok) {
        throw new Error(`Search grounding failed (${response.status})`);
      }
      const data = await response.json();
      setSearchGroundingResult({
        attractionId: attr.id,
        text: data.text,
        sources: data.sources || [],
      });
    } catch (err) {
      setGroundingError(
        err instanceof Error
          ? err.message
          : 'Could not retrieve live search grounding.'
      );
    } finally {
      setGroundingLoading(null);
    }
  };

  // Run Live Google Maps Grounding for Selected Attraction
  const runMapsGrounding = async (attr: Attraction) => {
    setGroundingLoading('maps');
    setGroundingError(null);
    try {
      const response = await fetch('/api/ai/maps-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attractionName: attr.name,
          lat: attr.lat,
          lng: attr.lng,
        }),
      });
      if (!response.ok) {
        throw new Error(`Maps grounding failed (${response.status})`);
      }
      const data = await response.json();
      setMapsGroundingResult({
        attractionId: attr.id,
        text: data.text,
        places: data.places || [],
      });
    } catch (err) {
      setGroundingError(
        err instanceof Error
          ? err.message
          : 'Could not retrieve Google Maps grounding.'
      );
    } finally {
      setGroundingLoading(null);
    }
  };

  const allCategoryKeys: AttractionCategory[] = [
    'nationalPark',
    'reserve',
    'cultural',
    'religious',
    'adventure',
    'city',
    'lake',
    'mountain',
    'sanctuary',
  ];

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 select-none">
      {/* 1. TOP APPLICATION HEADER BAR */}
      <header className="z-30 bg-stone-900 text-stone-100 border-b border-stone-800 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        {/* Brand Identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-700 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-base sm:text-lg font-bold tracking-tight text-white leading-none">
                {t.appTitle}
              </h1>
              <span className="hidden md:inline-block text-[11px] font-mono uppercase tracking-wider text-amber-400">
                UTA · 61 Verified Sites
              </span>
            </div>
            <p className="text-[11px] text-stone-300 hidden sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* Center View Mode Switcher */}
        <nav
          aria-label="Explorer View Modes"
          className="flex items-center bg-stone-800/90 p-1 rounded-xl border border-stone-700"
        >
          <button
            type="button"
            onClick={() => setViewMode('leaflet')}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'leaflet'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{t.modes.leafletMap}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('threeD')}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'threeD'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>{t.modes.threeDTerrain}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('googleMaps')}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'googleMaps'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t.modes.googleMaps}</span>
            <span className="md:hidden">GMaps</span>
          </button>
        </nav>

        {/* Right Action Controls: Trip Drawer, Drive/Cloud, Standalone HTML Export, Language, High-Contrast */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Itinerary Builder Toggle */}
          <button
            type="button"
            onClick={() => setShowItineraryPanel((prev) => !prev)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
              showItineraryPanel
                ? 'bg-amber-500 text-stone-950 border-amber-400'
                : 'bg-stone-800 hover:bg-stone-700 text-white border-stone-700'
            }`}
            aria-expanded={showItineraryPanel}
          >
            <Route className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Trip</span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-stone-950/60 text-amber-300">
              {orderedTripStops.length} · {tripRouteMetrics.totalKm}km
            </span>
          </button>

          {/* Google Drive & Saved Trips Modal Button */}
          <button
            type="button"
            onClick={() => setShowCloudDriveModal(true)}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-semibold text-stone-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title={t.modes.driveCloud}
          >
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">{t.modes.driveCloud}</span>
          </button>

          {/* Download Single-File Standalone HTML Map */}
          <button
            type="button"
            onClick={() => triggerStandaloneHtmlDownload(attractionsData)}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 border border-emerald-600/50 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title={t.itinerary.standaloneHtmlBtn}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Standalone HTML</span>
          </button>

          {/* Language Selector (EN / LG / SW) */}
          <select
            aria-label="Select Language"
            value={lang}
            onChange={(e) => setLang(e.target.value as LanguageCode)}
            className="min-h-[38px] px-2 py-1 rounded-xl bg-stone-800 border border-stone-700 text-xs font-semibold text-stone-200 cursor-pointer"
          >
            <option value="en">EN · English</option>
            <option value="lg">LG · Luganda</option>
            <option value="sw">SW · Kiswahili</option>
          </select>

          {/* High-Contrast / Dark Mode Toggle */}
          <button
            type="button"
            onClick={() => setHighContrastDark((prev) => !prev)}
            aria-pressed={highContrastDark}
            aria-label={t.mapControls.highContrast}
            title={t.mapControls.highContrast}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer ${
              highContrastDark
                ? 'bg-yellow-400 text-black border-yellow-300'
                : 'bg-stone-800 text-stone-300 border-stone-700 hover:text-white'
            }`}
          >
            <Contrast className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. UTA-STYLE CATEGORY FILTER BAR + SEARCH & SMART FILTER TOOLBAR */}
      <section
        aria-label="Category and Search Filters"
        className="z-20 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-3 sm:px-5 py-2 space-y-2 shrink-0 shadow-xs"
      >
        {/* Top Row: Live Fuzzy Search + Smart Filter Toggle + Geolocation + Tile Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Fuzzy Search Input */}
          <div className="relative flex-1 min-w-[210px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              className="w-full min-h-[38px] pl-9 pr-8 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Smart Filters Toggle Button */}
          <button
            type="button"
            onClick={() => setShowSmartFiltersBar((prev) => !prev)}
            aria-expanded={showSmartFiltersBar}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              showSmartFiltersBar ||
              selectedRegions.length > 0 ||
              unescoOnly ||
              selectedActivityFilter !== 'all' ||
              selectedSeasonFilter !== 'all'
                ? 'bg-amber-700 text-white border-amber-700'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-300 dark:border-stone-700 hover:bg-stone-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{t.filters.title}</span>
            {(selectedRegions.length > 0 ||
              unescoOnly ||
              selectedActivityFilter !== 'all' ||
              selectedSeasonFilter !== 'all') && (
              <span className="w-2 h-2 rounded-full bg-yellow-300" />
            )}
          </button>

          {/* UNESCO Quick Toggle */}
          <button
            type="button"
            onClick={() => setUnescoOnly((prev) => !prev)}
            aria-pressed={unescoOnly}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              unescoOnly
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-300 dark:border-stone-700 hover:bg-stone-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">UNESCO</span>
          </button>

          {/* Locate Me Button */}
          <div className="relative">
            <button
              type="button"
              onClick={handleLocateUser}
              disabled={isLocating}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-800 hover:bg-stone-800 text-white border border-stone-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Navigation className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isLocating ? t.mapControls.locating : t.mapControls.locateMe}
              </span>
            </button>

            {/* 5 Nearest Attractions Popover */}
            {showNearestPopover && nearestFiveAttractions.length > 0 && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-2xl p-3.5 z-40 space-y-2.5">
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    {t.mapControls.nearestTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNearestPopover(false)}
                    className="text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {geoError && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-2 rounded">
                    {geoError}
                  </p>
                )}
                <div className="space-y-1.5">
                  {nearestFiveAttractions.map(({ attraction, distanceKm }) => (
                    <button
                      key={attraction.id}
                      type="button"
                      onClick={() => {
                        setSelectedAttraction(attraction);
                        setShowNearestPopover(false);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {attraction.name}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {t.categories[attraction.category]} ·{' '}
                          {attraction.region}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400 shrink-0">
                        ~{distanceKm} km
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tile Layer Selector (when in Leaflet mode) */}
          {viewMode === 'leaflet' && (
            <div className="hidden md:flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-300 dark:border-stone-700">
              <Layers className="w-3.5 h-3.5 text-stone-500 ml-1.5 mr-1" />
              {(
                [
                  ['standard', t.mapControls.layerStandard],
                  ['terrain', t.mapControls.layerTerrain],
                  ['satellite', t.mapControls.layerSatellite],
                ] as const
              ).map(([layerId, label]) => (
                <button
                  key={layerId}
                  type="button"
                  onClick={() => setActiveTileLayer(layerId)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeTileLayer === layerId
                      ? 'bg-stone-900 text-white dark:bg-amber-600'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expandable Smart Filters Drawer (Multi-select Region, Activity Focus, Season) */}
        {showSmartFiltersBar && (
          <div className="pt-2 pb-1 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Multi-select Region Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-stone-600 dark:text-stone-400">
                {t.filters.regionsLabel}:
              </span>
              {(['Central', 'Eastern', 'Northern', 'Western'] as UgandaRegion[]).map(
                (reg) => {
                  const active = selectedRegions.includes(reg);
                  return (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => handleToggleRegion(reg)}
                      aria-pressed={active}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-stone-900 text-white border-stone-900 dark:bg-amber-600 dark:border-amber-500'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                      }`}
                    >
                      {t.regions[reg]}
                    </button>
                  );
                }
              )}
            </div>

            {/* Activity Filter */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="activityFilterSelect"
                className="font-semibold text-stone-600 dark:text-stone-400"
              >
                {t.filters.activityLabel}:
              </label>
              <select
                id="activityFilterSelect"
                value={selectedActivityFilter}
                onChange={(e) => setSelectedActivityFilter(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-900 dark:text-stone-100 cursor-pointer"
              >
                <option value="all">{t.filters.allActivities}</option>
                <option value="trekking">{t.activities.trekking}</option>
                <option value="safari">{t.activities.safari}</option>
                <option value="waterSports">{t.activities.waterSports}</option>
                <option value="birding">{t.activities.birding}</option>
                <option value="culture">{t.activities.culture}</option>
              </select>
            </div>

            {/* Best Time / Season Filter */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="seasonFilterSelect"
                className="font-semibold text-stone-600 dark:text-stone-400"
              >
                {t.filters.seasonLabel}:
              </label>
              <select
                id="seasonFilterSelect"
                value={selectedSeasonFilter}
                onChange={(e) => setSelectedSeasonFilter(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-900 dark:text-stone-100 cursor-pointer"
              >
                <option value="all">{t.filters.allSeasons}</option>
                <option value="dry">{t.filters.drySeason}</option>
                <option value="green">{t.filters.greenSeason}</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t.filters.resetFilters}
            </button>
          </div>
        )}

        {/* Category Filter Bar (All Attractions + 9 Categories with Distinct Color Swatches & Live Counts) */}
        <div
          role="tablist"
          aria-label="Destination Categories"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
              selectedCategory === 'all'
                ? 'bg-stone-900 text-white border-stone-900 dark:bg-amber-600 dark:border-amber-500'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200'
            }`}
          >
            <span>{t.allAttractions}</span>
            <span className="font-mono text-[11px] opacity-80">
              ({filteredAttractions.length})
            </span>
          </button>

          {allCategoryKeys.map((cat) => {
            const meta = CATEGORY_META[cat];
            const isSelected = selectedCategory === cat;
            const count =
              selectedCategory === 'all'
                ? categoryCounts[cat]
                : attractionsData.filter((a) => a.category === cat).length;

            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() =>
                  setSelectedCategory((prev) => (prev === cat ? 'all' : cat))
                }
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                  isSelected
                    ? 'bg-stone-900 text-white border-stone-900 dark:bg-amber-600 dark:border-amber-500'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200'
                }`}
              >
                <span
                  style={{ backgroundColor: meta.color }}
                  className="w-3.5 h-3.5 rounded-sm flex items-center justify-center shrink-0"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="10"
                    height="10"
                    fill="#ffffff"
                    aria-hidden="true"
                  >
                    <path d={meta.svgPath} />
                  </svg>
                </span>
                <span>{t.categories[cat]}</span>
                <span className="font-mono text-[11px] opacity-75">
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. MAIN INTERACTIVE VIEWPORT STAGE (MAP / 3D / GOOGLE MAPS + SLIDE-IN PANELS) */}
      <main className="relative flex-1 w-full overflow-hidden">
        {viewMode === 'leaflet' && (
          <LeafletMapView
            attractions={filteredAttractions}
            selectedAttraction={selectedAttraction}
            onSelectAttraction={(attr) => setSelectedAttraction(attr)}
            tripIds={tripIds}
            orderedTripStops={orderedTripStops}
            onToggleTripStop={handleToggleTripStop}
            userLocation={userLocation}
            activeTileLayer={activeTileLayer}
            t={t}
          />
        )}

        {viewMode === 'threeD' && (
          <Uganda3DScene
            attractions={filteredAttractions}
            selectedAttraction={selectedAttraction}
            onSelectAttraction={(attr) => setSelectedAttraction(attr)}
          />
        )}

        {viewMode === 'googleMaps' && (
          <GoogleMapsView
            attractions={filteredAttractions}
            selectedAttraction={selectedAttraction}
            onSelectAttraction={(attr) => setSelectedAttraction(attr)}
            tripIds={tripIds}
            onToggleTripStop={handleToggleTripStop}
            t={t}
            onSwitchToLeaflet={() => setViewMode('leaflet')}
          />
        )}

        {/* COLLAPSIBLE MAP LEGEND & LIVE CATEGORY COUNTER OVERLAY (Bottom-Left on Map Views) */}
        {viewMode !== 'threeD' && (
          <aside
            aria-label={t.mapControls.legendTitle}
            className="absolute bottom-8 left-3 z-20 w-64 bg-white/95 dark:bg-stone-900/95 border border-stone-300 dark:border-stone-700 rounded-xl shadow-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setLegendExpanded((prev) => !prev)}
              className="w-full px-3.5 py-2.5 bg-stone-900 text-white text-xs font-bold flex items-center justify-between cursor-pointer"
            >
              <span>
                {t.mapControls.legendTitle} ({filteredAttractions.length})
              </span>
              {legendExpanded ? (
                <ChevronDown className="w-4 h-4 text-amber-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-amber-400" />
              )}
            </button>

            {legendExpanded && (
              <div className="p-3 space-y-1.5 text-xs max-h-64 overflow-y-auto">
                {allCategoryKeys.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const count = categoryCounts[cat];
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setSelectedCategory((prev) =>
                          prev === cat ? 'all' : cat
                        )
                      }
                      className={`w-full flex items-center justify-between px-2 py-1 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-amber-50 dark:bg-amber-950/40 font-bold'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          style={{ backgroundColor: meta.color }}
                          className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="11"
                            height="11"
                            fill="#ffffff"
                            aria-hidden="true"
                          >
                            <path d={meta.svgPath} />
                          </svg>
                        </span>
                        <span className="truncate text-stone-800 dark:text-stone-200">
                          {t.categories[cat]}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                        {count}
                      </span>
                    </button>
                  );
                })}
                <div className="pt-1.5 border-t border-stone-200 dark:border-stone-800 text-[10px] text-stone-500 dark:text-stone-400">
                  {t.mapControls.keyboardHint}
                </div>
              </div>
            )}
          </aside>
        )}

        {/* 4. SLIDE-IN DESTINATION DETAIL SIDE PANEL */}
        {selectedAttraction && (
          <aside
            aria-label={`${selectedAttraction.name} Details`}
            className="absolute top-0 right-0 bottom-0 z-30 w-full sm:w-[430px] bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Rich Gradient Header Banner (Zero External Broken Images) */}
            <div
              style={{
                background: `linear-gradient(135deg, ${
                  CATEGORY_META[selectedAttraction.category].gradientFrom
                }, ${CATEGORY_META[selectedAttraction.category].gradientTo})`,
              }}
              className="p-5 text-white relative shrink-0"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="text-xs font-semibold uppercase tracking-wider opacity-90">
                  {t.categories[selectedAttraction.category]} ·{' '}
                  {selectedAttraction.region} Region
                  {selectedAttraction.unesco
                    ? ` · ${t.popup.unescoBadge}`
                    : ''}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAttraction(null)}
                  className="p-1.5 rounded-lg bg-black/25 hover:bg-black/40 text-white transition-colors cursor-pointer"
                  aria-label={t.detailPanel.close}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h2 className="font-serif text-xl font-bold leading-snug mb-1">
                {selectedAttraction.name}
              </h2>
              <div className="text-xs opacity-85 font-mono">
                {selectedAttraction.imageKeyword} ·{' '}
                {selectedAttraction.lat.toFixed(3)}°N,{' '}
                {selectedAttraction.lng.toFixed(3)}°E
              </div>

              {/* Action Buttons Bar inside Header */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => handleToggleTripStop(selectedAttraction.id)}
                  className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    tripIds.includes(selectedAttraction.id)
                      ? 'bg-emerald-900/90 text-white border border-emerald-400/50'
                      : 'bg-white text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  {tripIds.includes(selectedAttraction.id) ? (
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

                {viewMode !== 'threeD' && (
                  <button
                    type="button"
                    onClick={() => setViewMode('threeD')}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-black/30 hover:bg-black/45 text-white border border-white/25 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Box className="w-3.5 h-3.5" />
                    {t.detailPanel.flyTo3D}
                  </button>
                )}

                {user && (
                  <button
                    type="button"
                    onClick={() =>
                      toggleAttractionBookmark({
                        attractionId: selectedAttraction.id,
                        existingBookmark: bookmarksMap[selectedAttraction.id],
                      })
                    }
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                      bookmarksMap[selectedAttraction.id]
                        ? 'bg-amber-400 text-stone-950 border-amber-300'
                        : 'bg-black/30 text-white border-white/25 hover:bg-black/45'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>
                      {bookmarksMap[selectedAttraction.id]
                        ? t.detailPanel.bookmarked
                        : t.detailPanel.bookmarkBtn}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Detail Content */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs leading-relaxed">
              {/* Full Description */}
              <section className="space-y-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  {t.detailPanel.overview}
                </h3>
                <p className="text-sm text-stone-800 dark:text-stone-200 leading-relaxed">
                  {selectedAttraction.longDesc}
                </p>
              </section>

              {/* Key Logistics Grid: Best Time, Permits/Fees, Getting There, Accessibility */}
              <section className="grid grid-cols-1 gap-2.5 bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-xl border border-stone-200 dark:border-stone-700">
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-stone-900 dark:text-stone-100">
                      {t.popup.bestTime}
                    </div>
                    <div className="text-stone-600 dark:text-stone-300">
                      {selectedAttraction.bestTimeToVisit}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Ticket className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-stone-900 dark:text-stone-100">
                      {t.popup.permitsFees}
                    </div>
                    <div className="text-stone-600 dark:text-stone-300">
                      {selectedAttraction.entryFeePermits}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Car className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-stone-900 dark:text-stone-100">
                      {t.detailPanel.gettingThere}
                    </div>
                    <div className="text-stone-600 dark:text-stone-300">
                      {selectedAttraction.gettingThere}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Accessibility className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-stone-900 dark:text-stone-100">
                      {t.detailPanel.accessibilityNotes}
                    </div>
                    <div className="text-stone-600 dark:text-stone-300">
                      {selectedAttraction.accessibilityNotes}
                    </div>
                  </div>
                </div>
              </section>

              {/* All Activities */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  {t.detailPanel.allActivities}
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {selectedAttraction.activities.map((act) => (
                    <li
                      key={act}
                      className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Wildlife & Ecological Highlights */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  {t.detailPanel.wildlifeHighlights}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAttraction.wildlifeHighlights.map((w) => (
                    <span
                      key={w}
                      className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-medium"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </section>

              {/* Nearby Attractions (Clickable — Flies the Map There) */}
              {selectedAttraction.nearbyAttractions.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    {t.detailPanel.nearbyAttractions}
                  </h3>
                  <div className="space-y-1.5">
                    {selectedAttraction.nearbyAttractions.map((nearId) => {
                      const nearAttr = attractionsData.find(
                        (a) => a.id === nearId
                      );
                      if (!nearAttr) return null;
                      const distKm = calculateRoadDistanceKm(
                        selectedAttraction.lat,
                        selectedAttraction.lng,
                        nearAttr.lat,
                        nearAttr.lng
                      );
                      return (
                        <button
                          key={nearAttr.id}
                          type="button"
                          onClick={() => setSelectedAttraction(nearAttr)}
                          className="w-full p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-stone-900 dark:text-stone-100">
                              {nearAttr.name}
                            </div>
                            <div className="text-[11px] text-stone-500">
                              {t.categories[nearAttr.category]} · ~{distKm} km
                              road
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Live Grounded Travel Intelligence (Google Search & Google Maps Grounding) */}
              <section className="p-3.5 rounded-xl border border-amber-300/70 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
                <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>{t.detailPanel.liveIntelligence}</span>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={groundingLoading !== null}
                    onClick={() => runSearchGrounding(selectedAttraction)}
                    className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {groundingLoading === 'search'
                        ? 'Checking Live Web Sources...'
                        : t.detailPanel.searchGroundingBtn}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={groundingLoading !== null}
                    onClick={() => runMapsGrounding(selectedAttraction)}
                    className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>
                      {groundingLoading === 'maps'
                        ? 'Querying Google Maps Places...'
                        : t.detailPanel.mapsGroundingBtn}
                    </span>
                  </button>
                </div>

                {groundingError && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {groundingError}
                  </p>
                )}

                {searchGroundingResult &&
                  searchGroundingResult.attractionId ===
                    selectedAttraction.id && (
                    <div className="p-3 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 space-y-2">
                      <div className="text-xs text-stone-800 dark:text-stone-200 whitespace-pre-line">
                        {searchGroundingResult.text}
                      </div>
                      {searchGroundingResult.sources.length > 0 && (
                        <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-1">
                          <div className="text-[10px] font-bold uppercase text-stone-500">
                            Verified Web Citations
                          </div>
                          {searchGroundingResult.sources.map((src, i) => (
                            <a
                              key={i}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 hover:underline truncate"
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate">{src.title}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                {mapsGroundingResult &&
                  mapsGroundingResult.attractionId ===
                    selectedAttraction.id && (
                    <div className="p-3 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 space-y-2">
                      <div className="text-xs text-stone-800 dark:text-stone-200 whitespace-pre-line">
                        {mapsGroundingResult.text}
                      </div>
                      {mapsGroundingResult.places.length > 0 && (
                        <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase text-stone-500">
                            Google Maps Grounded Places
                          </div>
                          {mapsGroundingResult.places.map((pl, i) => (
                            <div key={i} className="space-y-0.5">
                              <a
                                href={pl.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                              >
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span>{pl.title}</span>
                              </a>
                              {pl.reviewSnippets.map((snip, j) => (
                                <p
                                  key={j}
                                  className="text-[11px] italic text-stone-500 pl-4"
                                >
                                  &ldquo;{snip}&rdquo;
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              </section>
            </div>
          </aside>
        )}

        {/* 5. SLIDE-IN TRIP ITINERARY BUILDER PANEL */}
        {showItineraryPanel && (
          <aside
            aria-label={t.itinerary.title}
            className="absolute top-0 left-0 bottom-0 z-30 w-full sm:w-[390px] bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Route className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-sm font-bold">{t.itinerary.title}</h2>
                  <p className="text-[11px] text-stone-400">
                    Nearest-Neighbor Haversine Route Optimizer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowItineraryPanel(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
                aria-label="Close itinerary panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Route Summary Metrics */}
            <div className="grid grid-cols-2 gap-2 p-3.5 bg-stone-100 dark:bg-stone-800/70 border-b border-stone-200 dark:border-stone-800">
              <div className="p-2.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700">
                <div className="text-[10px] uppercase font-semibold text-stone-500">
                  {t.itinerary.totalDistance}
                </div>
                <div className="font-mono text-base font-bold text-amber-700 dark:text-amber-400">
                  ~{tripRouteMetrics.totalKm.toLocaleString()} km
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700">
                <div className="text-[10px] uppercase font-semibold text-stone-500">
                  {t.itinerary.estDays}
                </div>
                <div className="font-mono text-base font-bold text-stone-900 dark:text-stone-100">
                  {orderedTripStops.length}{' '}
                  {orderedTripStops.length === 1 ? 'Day' : 'Days'}
                </div>
              </div>
            </div>

            {/* Day-by-Day Ordered Stops List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
              {orderedTripStops.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  {t.itinerary.emptyState}
                </div>
              ) : (
                tripRouteMetrics.legs.map(({ stop, distanceFromPrevKm }, idx) => (
                  <div
                    key={stop.id}
                    className="p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-800/40 space-y-1.5"
                  >
                    {idx > 0 && (
                      <div className="text-[11px] font-mono text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <span>↓ +{distanceFromPrevKm} km road</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAttraction(stop)}
                        className="text-left group cursor-pointer"
                      >
                        <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                          {t.itinerary.dayPrefix} {idx + 1} · {stop.region}
                        </div>
                        <div className="text-xs font-bold text-stone-900 dark:text-stone-100 group-hover:underline">
                          {stop.name}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {t.categories[stop.category]}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleTripStop(stop.id)}
                        className="p-1.5 rounded text-stone-400 hover:text-red-600 cursor-pointer"
                        aria-label={`${t.itinerary.removeStop} ${stop.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Itinerary Footer Actions */}
            {orderedTripStops.length > 0 && (
              <div className="p-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportTripAsText}
                    className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t.itinerary.exportText}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCloudDriveModal(true)}
                    className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    {t.itinerary.saveToDrive}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setTripIds([])}
                  className="w-full py-1.5 text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                >
                  {t.itinerary.clearTrip}
                </button>
              </div>
            )}
          </aside>
        )}
      </main>

      {/* 6. PERSISTENT ABOUT / SOURCES FOOTER */}
      <footer className="z-20 bg-stone-900 text-stone-400 border-t border-stone-800 px-4 py-1.5 text-[11px] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div>{t.footer.credits}</div>
        <div className="font-mono text-stone-300">{t.footer.lastUpdated}</div>
      </footer>

      {/* 7. GOOGLE DRIVE & CLOUD SYNC MODAL */}
      {showCloudDriveModal && (
        <CloudDriveModal
          user={user}
          accessToken={accessToken}
          onAuthUpdated={(u, tok) => {
            setUser(u);
            setAccessToken(tok);
          }}
          savedItineraries={savedItineraries}
          currentTripStops={orderedTripStops}
          totalTripDistanceKm={tripRouteMetrics.totalKm}
          onLoadItineraryStops={(ids) => {
            setTripIds(ids);
            setShowItineraryPanel(true);
          }}
          onImportCustomAttractions={(imported) => {
            setAttractionsData(imported);
          }}
          onClose={() => setShowCloudDriveModal(false)}
        />
      )}
    </div>
  );
}
