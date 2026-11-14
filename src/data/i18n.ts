export type LanguageCode = 'en' | 'lg' | 'sw';

export interface TranslationStrings {
  appTitle: string;
  appSubtitle: string;
  searchPlaceholder: string;
  allAttractions: string;
  categories: {
    nationalPark: string;
    reserve: string;
    cultural: string;
    religious: string;
    adventure: string;
    city: string;
    lake: string;
    mountain: string;
    sanctuary: string;
  };
  regions: {
    all: string;
    Central: string;
    Eastern: string;
    Northern: string;
    Western: string;
  };
  filters: {
    title: string;
    regionsLabel: string;
    unescoOnly: string;
    activityLabel: string;
    seasonLabel: string;
    allActivities: string;
    allSeasons: string;
    drySeason: string;
    greenSeason: string;
    resetFilters: string;
  };
  activities: {
    trekking: string;
    safari: string;
    waterSports: string;
    birding: string;
    culture: string;
  };
  mapControls: {
    locateMe: string;
    locating: string;
    nearestTitle: string;
    layerStandard: string;
    layerTerrain: string;
    layerSatellite: string;
    highContrast: string;
    legendTitle: string;
    visibleCounter: string;
    keyboardHint: string;
  };
  popup: {
    bestTime: string;
    permitsFees: string;
    topActivities: string;
    fullDetails: string;
    addToTrip: string;
    inTrip: string;
    unescoBadge: string;
  };
  detailPanel: {
    overview: string;
    allActivities: string;
    wildlifeHighlights: string;
    gettingThere: string;
    accessibilityNotes: string;
    nearbyAttractions: string;
    liveIntelligence: string;
    searchGroundingBtn: string;
    mapsGroundingBtn: string;
    bookmarkBtn: string;
    bookmarked: string;
    flyTo3D: string;
    close: string;
  };
  itinerary: {
    title: string;
    emptyState: string;
    optimizeRoute: string;
    totalDistance: string;
    estDays: string;
    dayPrefix: string;
    exportText: string;
    saveToCloud: string;
    saveToDrive: string;
    clearTrip: string;
    removeStop: string;
    standaloneHtmlBtn: string;
  };
  modes: {
    leafletMap: string;
    threeDTerrain: string;
    googleMaps: string;
    driveCloud: string;
  };
  footer: {
    credits: string;
    lastUpdated: string;
  };
}

export const I18N: Record<LanguageCode, TranslationStrings> = {
  en: {
    appTitle: 'Pearl of Africa',
    appSubtitle: 'Uganda Interactive Tourism & Heritage Explorer',
    searchPlaceholder: 'Search parks, gorillas, rafting, lions, or regions...',
    allAttractions: 'All Attractions',
    categories: {
      nationalPark: 'National Parks',
      reserve: 'Wildlife Reserves',
      cultural: 'Cultural & Heritage',
      religious: 'Religious Sites',
      adventure: 'Adventure Hubs',
      city: 'Cities & Gateways',
      lake: 'Lakes & Rivers',
      mountain: 'Mountains & Peaks',
      sanctuary: 'Sanctuaries & Eco',
    },
    regions: {
      all: 'All Regions',
      Central: 'Central',
      Eastern: 'Eastern',
      Northern: 'Northern',
      Western: 'Western',
    },
    filters: {
      title: 'Smart Explorer Filters',
      regionsLabel: 'Regions (Multi-select)',
      unescoOnly: 'UNESCO World Heritage Only',
      activityLabel: 'Activity Focus',
      seasonLabel: 'Best Time / Season',
      allActivities: 'All Activities',
      allSeasons: 'All Year / Any Season',
      drySeason: 'Dry Season (Jun–Aug / Dec–Feb)',
      greenSeason: 'Green Season (Mar–May / Sep–Nov)',
      resetFilters: 'Reset All Filters',
    },
    activities: {
      trekking: 'Primate & Mountain Trekking',
      safari: 'Savanna Game Safari',
      waterSports: 'Nile & Lake Water Sports',
      birding: 'Birdwatching',
      culture: 'Royal & Cultural Heritage',
    },
    mapControls: {
      locateMe: 'Locate Me',
      locating: 'Locating...',
      nearestTitle: '5 Nearest Attractions to You',
      layerStandard: 'OSM Standard',
      layerTerrain: 'Topo / Humanitarian',
      layerSatellite: 'Satellite Imagery',
      highContrast: 'High Contrast',
      legendTitle: 'Map Legend & Live Counts',
      visibleCounter: 'Visible Destinations',
      keyboardHint: 'Use Tab / Arrow keys to cycle visible markers',
    },
    popup: {
      bestTime: 'Best Time',
      permitsFees: 'Permits & Entry',
      topActivities: 'Top Experiences',
      fullDetails: 'Full Details',
      addToTrip: '＋ Add to Trip',
      inTrip: '✓ In Trip',
      unescoBadge: 'UNESCO Heritage',
    },
    detailPanel: {
      overview: 'Destination Overview',
      allActivities: 'Signature Activities',
      wildlifeHighlights: 'Key Wildlife & Ecology',
      gettingThere: 'Getting There & Gateway Hub',
      accessibilityNotes: 'Accessibility & Trail Notes',
      nearbyAttractions: 'Nearby Destinations (Click to Fly)',
      liveIntelligence: 'Live Grounded Travel Intelligence',
      searchGroundingBtn: 'Live Advisory & Permit Check (Google Search)',
      mapsGroundingBtn: 'Find Nearby Lodges & Places (Google Maps)',
      bookmarkBtn: 'Bookmark Site',
      bookmarked: 'Bookmarked',
      flyTo3D: 'Inspect in 3D Terrain',
      close: 'Close Panel',
    },
    itinerary: {
      title: 'Trip Itinerary Builder',
      emptyState: 'Click "＋ Add to Trip" on any destination marker to build an optimized Uganda circuit with road distances.',
      optimizeRoute: 'Optimize Nearest-Neighbor Route',
      totalDistance: 'Est. Road Distance',
      estDays: 'Suggested Duration',
      dayPrefix: 'Day',
      exportText: 'Export Text',
      saveToCloud: 'Save to Account',
      saveToDrive: 'Export to Google Drive',
      clearTrip: 'Clear Trip',
      removeStop: 'Remove stop',
      standaloneHtmlBtn: 'Download Standalone HTML Map',
    },
    modes: {
      leafletMap: 'Leaflet OSM Map',
      threeDTerrain: '3D Uganda Relief',
      googleMaps: 'Google Maps View',
      driveCloud: 'Drive & Saved Trips',
    },
    footer: {
      credits: 'Data sources: Uganda Tourism Association (UTA), Uganda Tourism Board (UTB), Uganda Wildlife Authority (UWA), and OpenStreetMap contributors.',
      lastUpdated: 'Dataset Verified & Updated: November 2026',
    },
  },
  lg: {
    appTitle: 'Ekkula lya Afirika',
    appSubtitle: 'Mappa y’Obulambuzi n’Obuwangwa mu Uganda',
    searchPlaceholder: 'Noonya amakuumiro, amazike, emigga, empologoma, oba ebitundu...',
    allAttractions: 'Ebifo Byonna',
    categories: {
      nationalPark: 'Amakuumiro g’Ensolo',
      reserve: 'Ebifo Ebikuumibwa',
      cultural: 'Obuwangwa n’Ebyafaayo',
      religious: 'Ebifo by’Eddiini',
      adventure: 'Eby’emizannyo n’Okulambula',
      city: 'Ebibuga n’Emiryango',
      lake: 'Ennyanja n’Emigga',
      mountain: 'Ensozi',
      sanctuary: 'Amakuumiro g’Ebisolo',
    },
    regions: {
      all: 'Ebitundu Byonna',
      Central: 'Buganda / wakati',
      Eastern: 'Buvanjuba',
      Northern: 'Bukiikakkono',
      Western: 'Bugwanjuba',
    },
    filters: {
      title: 'okusunsula Ebifo',
      regionsLabel: 'Ebitundu bya Uganda',
      unescoOnly: 'Ebifo bya UNESCO Byokka',
      activityLabel: 'Emirimu gy’Obulambuzi',
      seasonLabel: 'Ekiseera ky’Omwaka',
      allActivities: 'Emirimu Gyonna',
      allSeasons: 'Omwaka Gwonna',
      drySeason: 'Ekyeya (Juuni–Agusto / Desemba–Febwali)',
      greenSeason: 'Enkuba n’Obulungi (Maaci–Meyi / Sebutemba–Novemba)',
      resetFilters: 'Ddamu Okusunsula',
    },
    activities: {
      trekking: 'Okulambula Amazike n’Ensozi',
      safari: 'Okulambula Ensolo mu Ddungu',
      waterSports: 'Emizannyo gy’oku Mazzi',
      birding: 'Okulambula Ebinyonyi',
      culture: 'Obwakabaka n’Obuwangwa',
    },
    mapControls: {
      locateMe: 'Nzuula We Ndi',
      locating: 'Kunoonya...',
      nearestTitle: 'Ebifo 5 Ebikuli okumpi',
      layerStandard: 'Mappa Eya Bulijjo',
      layerTerrain: 'Ensozi n’Ebiwonvu',
      layerSatellite: 'Ebifaananyi by’omu Bwengula',
      highContrast: 'Langi Enkakkafu',
      legendTitle: 'Ebikwata ku Bubonero',
      visibleCounter: 'Ebifo Ebirabika',
      keyboardHint: 'Kozesa Tab okulambula obubonero ku mappa',
    },
    popup: {
      bestTime: 'Ekiseera Ekisinga',
      permitsFees: 'Ebisale ne Paamiti',
      topActivities: 'Ebikolebwa',
      fullDetails: 'Ebisingawo',
      addToTrip: '＋ Gattako ku Lugendo',
      inTrip: '✓ Kiri mu Lugendo',
      unescoBadge: 'Ekifo kya UNESCO',
    },
    detailPanel: {
      overview: 'Ebikwata ku Kifo',
      allActivities: 'Eby’Okulambula Byonna',
      wildlifeHighlights: 'Ebisolo n’Ebiramu',
      gettingThere: 'Engeri y’Okutuukayo',
      accessibilityNotes: 'Engeri y’Okuyingira n’Obuyambi',
      nearbyAttractions: 'Ebifo Ebiriraanyewo',
      liveIntelligence: 'Amawulire ag’Obulambuzi Ag’akabiite',
      searchGroundingBtn: 'Kebera Ebisale n’Amawulire (Google Search)',
      mapsGroundingBtn: 'Noonya ebisulo ebiriraanyewo (Google Maps)',
      bookmarkBtn: 'itereke Ekifo',
      bookmarked: 'Kiterekeddwa',
      flyTo3D: 'Laba mu 3D Ensozi',
      close: 'Ggalawo',
    },
    itinerary: {
      title: 'Enteekateeka y’Olugendo',
      emptyState: 'Nyiga "＋ Gattako ku Lugendo" ku kifo kyonna okutegeka olugendo lwo mu Uganda.',
      optimizeRoute: 'Tegeka Enguudo Ennyangu',
      totalDistance: 'Obuwanvu bw’Olugendo',
      estDays: 'Ennaku Ezisuubirwa',
      dayPrefix: 'Olunaku',
      exportText: 'Fulya Ebiwandiiko',
      saveToCloud: 'Tereka ku Akawunti',
      saveToDrive: 'Tereka mu Google Drive',
      clearTrip: 'Sazaamu Olugendo',
      removeStop: 'Ggyako ekifo',
      standaloneHtmlBtn: 'Wanula Mappa ya HTML',
    },
    modes: {
      leafletMap: 'Mappa ya Leaflet',
      threeDTerrain: '3D Ensozi za Uganda',
      googleMaps: 'Google Maps',
      driveCloud: 'Google Drive n’Engendo',
    },
    footer: {
      credits: 'Ensibuko y’ebiwandiiko: Uganda Tourism Association (UTA), Uganda Tourism Board (UTB), Uganda Wildlife Authority (UWA), ne OpenStreetMap.',
      lastUpdated: ' Ebiwandiiko byakakasibwa: Novemba 2026',
    },
  },
  sw: {
    appTitle: 'Lulu ya Afrika',
    appSubtitle: 'Ramani Rasmi ya Utalii na Urithi wa Uganda',
    searchPlaceholder: 'Tafuta mbuga, sokwe, mto Nile, simba, au mikoa...',
    allAttractions: 'Vivutio Vyote',
    categories: {
      nationalPark: 'Mbuga za Kitaifa',
      reserve: 'Hifadhi za Wanyama',
      cultural: 'Utamaduni na Urithi',
      religious: 'Maeneo ya Kidini',
      adventure: 'Burudani na Michezo',
      city: 'Miji na Malango',
      lake: 'Maziwa na Mito',
      mountain: 'Milima na Vilele',
      sanctuary: 'Hifadhi Maalum na Ikolojia',
    },
    regions: {
      all: 'Mikoa Yote',
      Central: 'Kati',
      Eastern: 'Mashariki',
      Northern: 'Kaskazini',
      Western: 'Magharibi',
    },
    filters: {
      title: 'Vichujio vya Vivutio',
      regionsLabel: 'Mikoa ya Uganda',
      unescoOnly: 'Urithi wa UNESCO Pekee',
      activityLabel: 'Aina ya Shughuli',
      seasonLabel: 'Msimu Bora wa Kutembelea',
      allActivities: 'Shughuli Zote',
      allSeasons: 'Mwaka Mzima',
      drySeason: 'Msimu wa Kiangazi (Jun–Ago / Des–Feb)',
      greenSeason: 'Msimu wa Kijani (Mac–Mei / Sep–Nov)',
      resetFilters: 'Safisha Vichujio',
    },
    activities: {
      trekking: 'Kupanda Milima na Sokwe',
      safari: 'Safari za Mbugani',
      waterSports: 'Michezo ya Majini Mto Nile',
      birding: 'Kutazama Ndege',
      culture: 'Falme na Utamaduni',
    },
    mapControls: {
      locateMe: 'Nionyeshe Nilipo',
      locating: 'Inatafuta...',
      nearestTitle: 'Vivutio 5 Vilivyo Karibu Nawe',
      layerStandard: 'Ramani ya Kawaida',
      layerTerrain: 'Mandhari na Milima',
      layerSatellite: 'Picha za Satelaiti',
      highContrast: 'Utofautishaji wa Juu',
      legendTitle: 'Alama za Ramani na Idadi',
      visibleCounter: 'Vivutio Vinavyoonekana',
      keyboardHint: 'Tumia Tab kuruka kati ya alama za vivutio',
    },
    popup: {
      bestTime: 'Muda Bora',
      permitsFees: 'Vibali na Ada',
      topActivities: 'Shughuli Kuu',
      fullDetails: 'Maelezo Kamili',
      addToTrip: '＋ Ongeza Safarini',
      inTrip: '✓ Ipo Safarini',
      unescoBadge: 'Urithi wa UNESCO',
    },
    detailPanel: {
      overview: 'Maelezo ya Kivutio',
      allActivities: 'Shughuli Zote za Utalii',
      wildlifeHighlights: 'Wanyamapori na Mazingira',
      gettingThere: 'Jinsi ya Kufika',
      accessibilityNotes: 'Ufikivu na Njia',
      nearbyAttractions: 'Vivutio vya Karibu',
      liveIntelligence: 'Taarifa za Moja kwa Moja',
      searchGroundingBtn: 'Taarifa za Vibali na Hali ya Hewa (Google Search)',
      mapsGroundingBtn: 'Tafuta Hoteli za Karibu (Google Maps)',
      bookmarkBtn: 'Hifadhi Kivutio',
      bookmarked: 'Imehifadhiwa',
      flyTo3D: 'Tazama katika 3D',
      close: 'Funga',
    },
    itinerary: {
      title: 'Mpangilio wa Safari',
      emptyState: 'Bofya "＋ Ongeza Safarini" kwenye kivutio chochote ili kupanga ratiba na umbali wa barabara.',
      optimizeRoute: 'Panga Njia Fupi Zaidi',
      totalDistance: 'Makadirio ya Umbali',
      estDays: 'Muda Unaopendekezwa',
      dayPrefix: 'Siku ya',
      exportText: 'Pakua Ratiba (Matini)',
      saveToCloud: 'Hifadhi kwenye Akaunti',
      saveToDrive: 'Hifadhi Google Drive',
      clearTrip: 'Futa Ratiba',
      removeStop: 'Ondoa kituo',
      standaloneHtmlBtn: 'Pakua Ramani ya HTML',
    },
    modes: {
      leafletMap: 'Ramani ya Leaflet',
      threeDTerrain: 'Mandhari ya 3D',
      googleMaps: 'Google Maps',
      driveCloud: 'Google Drive na Safari',
    },
    footer: {
      credits: 'Vyanzo vya data: Uganda Tourism Association (UTA), Uganda Tourism Board (UTB), Uganda Wildlife Authority (UWA), na OpenStreetMap.',
      lastUpdated: 'Data Imehakikiwa: Novemba 2026',
    },
  },
};
