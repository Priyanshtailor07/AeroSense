import { formatNumber } from '../../utils/formatNumber';
import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Globe,
  MapPin,
  Wind,
  Droplets,
  Thermometer,
  Sun,
  AlertTriangle,
  Activity,
  Search,
  Compass,
  Layers,
  CheckCircle2,
  Briefcase,
  HardHat,
  Building2,
  Flame,
  RefreshCw,
  Navigation,
  Sparkles,
  TrendingUp,
  Volume2,
  VolumeX,
  RotateCcw,
  Zap,
  ShieldAlert,
  LocateFixed,
  CloudSun,
  Eye,
  Gauge
} from 'lucide-react';
import { soundEffects } from '../../utils/soundEffects';
import { GLOBAL_STATIONS } from './stationsData';
import { fetchLiveWeatherData, searchLocationCoordinates } from '../../utils/weatherApi';

// High-Reliability Map Tile Providers (No API Keys needed)
const TILE_PROVIDERS = {
  satellite: {
    name: 'Esri Satellite Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Earthstar Geographics',
    maxZoom: 19
  },
  streets: {
    name: 'OpenStreetMap Streets',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }
};

export default function GlobalAqiMap({ 
  onSyncTelemetry, 
  isAlarmMuted: externalMuted, 
  setIsAlarmMuted: setExternalMuted,
  isAlarmActive = true,
  onStopAlarm,
  onReenableAlarm
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());
  const circlesRef = useRef(new Map());
  const activeUserMarkerRef = useRef(null);
  const tileLayerRef = useRef(null);

  const [selectedStation, setSelectedStation] = useState(GLOBAL_STATIONS[0]);
  const [activeTileType, setActiveTileType] = useState('satellite');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [localAlarmMuted, setLocalAlarmMuted] = useState(false);
  const [syncedSuccess, setSyncedSuccess] = useState(false);
  const [tempUnit, setTempUnit] = useState('C'); // 'C' | 'F'
  const [isLocatingUser, setIsLocatingUser] = useState(false);

  const isAlarmMuted = externalMuted !== undefined ? externalMuted : localAlarmMuted;

  const handleToggleAlarm = () => {
    if (isAlarmActive && !isAlarmMuted) {
      if (onStopAlarm) onStopAlarm();
      else {
        soundEffects.stopHazardAlarm();
        setLocalAlarmMuted(true);
      }
    } else {
      if (onReenableAlarm) onReenableAlarm();
      else {
        soundEffects.enableAlarm();
        soundEffects.playHazardAlarm();
        setLocalAlarmMuted(false);
      }
    }
  };

  const getAqiColor = (aqi) => {
    if (aqi <= 50) return { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500', hex: '#10b981', label: 'Good' };
    if (aqi <= 100) return { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500', hex: '#f59e0b', label: 'Moderate' };
    if (aqi <= 150) return { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500', hex: '#f97316', label: 'Sensitive' };
    if (aqi <= 200) return { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500', hex: '#ef4444', label: 'Unhealthy' };
    return { bg: 'bg-purple-600', text: 'text-purple-400', border: 'border-purple-600', hex: '#9333ea', label: 'Hazardous' };
  };

  const formatTemp = (celsius) => {
    if (tempUnit === 'F') {
      return `${Math.round((celsius * 9) / 5 + 32)}°F`;
    }
    return `${celsius}°C`;
  };

  const filteredStations = GLOBAL_STATIONS.filter((st) => {
    const matchesSearch = st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.stationCode.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'hazard') return st.aqi > 150;
    if (activeFilter === 'clean') return st.aqi <= 50;
    if (activeFilter === 'humid') return st.humidity >= 70;
    return true;
  });

  // 1. Initialize Real Leaflet Map with robust container cleanup
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Destroy existing Leaflet instance if attached
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    if (container._leaflet_id) {
      container._leaflet_id = null;
    }

    try {
      const map = L.map(container, {
        center: [selectedStation.lat, selectedStation.lng],
        zoom: 4,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
        worldCopyJump: true,
      });

      // Add initial tile provider
      const initialTile = TILE_PROVIDERS[activeTileType];
      tileLayerRef.current = L.tileLayer(initialTile.url, {
        attribution: initialTile.attribution,
        subdomains: initialTile.subdomains || 'abc',
        maxZoom: initialTile.maxZoom,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Force recalculate bounding dimensions to prevent blank grey tiles
      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 400);

      const handleWindowResize = () => map.invalidateSize();
      window.addEventListener('resize', handleWindowResize);

      // Interactive Click Anywhere on Earth -> Live Weather & AQI API Fetch
      map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        setIsLoadingApi(true);
        soundEffects.playPop(520);

        // Fetch real-time Open-Meteo data for this point
        const liveData = await fetchLiveWeatherData(lat, lng, `Geo Point [${formatNumber(lat, { digits: 2 })}°, ${formatNumber(lng, { digits: 2 })}°]`);
        setIsLoadingApi(false);

        if (liveData) {
          setSelectedStation(liveData);
          soundEffects.playPop(680);
        }
      });

      mapInstanceRef.current = map;

      return () => {
        window.removeEventListener('resize', handleWindowResize);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
        if (container) {
          container._leaflet_id = null;
        }
      };
    } catch (err) {
      console.error('Leaflet initialization error:', err);
    }
  }, []);

  // 2. Switch Tile Provider (Streets / Satellite / Dark)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileInfo = TILE_PROVIDERS[activeTileType];
    tileLayerRef.current = L.tileLayer(tileInfo.url, {
      attribution: tileInfo.attribution,
      subdomains: tileInfo.subdomains || 'abc',
      maxZoom: tileInfo.maxZoom,
    }).addTo(map);

    setTimeout(() => map.invalidateSize(), 80);
  }, [activeTileType]);

  // 3. Render Station Markers & Atmospheric Heat Halos
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current.clear();
    circlesRef.current.forEach((c) => map.removeLayer(c));
    circlesRef.current.clear();

    if (activeUserMarkerRef.current) {
      map.removeLayer(activeUserMarkerRef.current);
      activeUserMarkerRef.current = null;
    }

    // Render static hub stations
    GLOBAL_STATIONS.forEach((station) => {
      const isSelected = selectedStation.id === station.id;
      const color = getAqiColor(station.aqi);

      const customIcon = L.divIcon({
        className: 'custom-station-pin',
        html: `
          <div style="position:relative; display:flex; flex-direction:column; align-items:center; cursor:pointer; transform:translate(-50%, -50%);">
            <div style="position:relative; display:flex; align-items:center; justify-content:center;">
              ${isSelected ? `<span style="position:absolute; width:34px; height:34px; border-radius:9999px; background-color:${color.hex}; opacity:0.75; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>` : ''}
              <div style="width:22px; height:22px; border-radius:9999px; border:2.5px solid white; background-color:${color.hex}; box-shadow:0 0 16px ${color.hex}; display:flex; align-items:center; justify-content:center;">
                <div style="width:6px; height:6px; border-radius:9999px; background-color:white;"></div>
              </div>
            </div>
            <div style="margin-top:4px; padding:2px 8px; border-radius:9999px; font-size:10px; font-weight:800; white-space:nowrap; box-shadow:0 4px 14px rgba(0,0,0,0.4); ${isSelected
            ? 'background-color:#0f172a; color:#38bdf8; border:2px solid #38bdf8; transform:scale(1.1);'
            : 'background-color:rgba(15,23,42,0.92); color:#f8fafc; border:1px solid rgba(255,255,255,0.2);'
          }">
              <span>${station.name}</span>
              <span style="margin-left:4px; font-family:monospace; padding:1px 4px; border-radius:4px; background-color:${color.hex}30; color:${color.hex};">${station.aqi}</span>
            </div>
          </div>
        `,
        iconSize: [90, 45],
        iconAnchor: [45, 22],
      });

      const marker = L.marker([station.lat, station.lng], { icon: customIcon }).addTo(map);
      marker.on('click', async () => {
        handleSelectStation(station);
      });
      markersRef.current.set(station.id, marker);

      // Atmospheric dispersion circle
      const circle = L.circle([station.lat, station.lng], {
        radius: 120000 + station.aqi * 350,
        color: color.hex,
        fillColor: color.hex,
        fillOpacity: isSelected ? 0.25 : 0.1,
        weight: isSelected ? 2 : 1,
        dashArray: isSelected ? '4, 6' : null,
      }).addTo(map);
      circlesRef.current.set(station.id, circle);
    });

    // If currently selected point is a custom/live coordinate not in standard list, draw custom pin
    const isCustom = !GLOBAL_STATIONS.some(s => s.id === selectedStation.id);
    if (isCustom) {
      const col = getAqiColor(selectedStation.aqi);
      const customPin = L.divIcon({
        className: 'custom-live-pin',
        html: `
          <div style="position:relative; display:flex; flex-direction:column; align-items:center; cursor:pointer; transform:translate(-50%, -50%);">
            <div style="position:relative; display:flex; align-items:center; justify-content:center;">
              <span style="position:absolute; width:38px; height:38px; border-radius:9999px; background-color:#38bdf8; opacity:0.8; animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite;"></span>
              <div style="width:24px; height:24px; border-radius:9999px; border:2.5px solid white; background-color:#0284c7; box-shadow:0 0 20px #38bdf8; display:flex; align-items:center; justify-content:center;">
                <div style="width:8px; height:8px; border-radius:9999px; background-color:white;"></div>
              </div>
            </div>
            <div style="margin-top:4px; padding:3px 10px; border-radius:9999px; font-size:10px; font-weight:900; background-color:#0f172a; color:#38bdf8; border:2px solid #38bdf8; box-shadow:0 4px 16px rgba(0,0,0,0.5);">
              <span>🎯 ${selectedStation.name}</span>
              <span style="margin-left:4px; font-family:monospace; color:#10b981;">${selectedStation.aqi} AQI</span>
            </div>
          </div>
        `,
        iconSize: [110, 50],
        iconAnchor: [55, 25],
      });

      activeUserMarkerRef.current = L.marker([selectedStation.lat, selectedStation.lng], { icon: customPin }).addTo(map);
    }
  }, [selectedStation]);

  // 4. Select Station & Fetch Live Weather Data from Open-Meteo
  const handleSelectStation = async (station) => {
    setSelectedStation(station);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([station.lat, station.lng], 7, { duration: 1.2 });
    }
    soundEffects.playPop(580);

    // Fetch live update for this station from Open-Meteo in background
    setIsLoadingApi(true);
    const liveUpdate = await fetchLiveWeatherData(station.lat, station.lng, station.name, station.country);
    setIsLoadingApi(false);
    if (liveUpdate) {
      setSelectedStation(liveUpdate);
    }
  };

  // 5. Locate Current User via Browser Geolocation
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocatingUser(true);
    soundEffects.playPop(480);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setIsLocatingUser(false);

        const map = mapInstanceRef.current;
        if (map) {
          map.flyTo([lat, lng], 10, { duration: 1.5 });
        }

        setIsLoadingApi(true);
        const liveData = await fetchLiveWeatherData(lat, lng, 'My GPS Location', 'Local Area');
        setIsLoadingApi(false);

        if (liveData) {
          setSelectedStation(liveData);
          soundEffects.playPop(720);
        }
      },
      (err) => {
        setIsLocatingUser(false);
        console.warn('Geolocation error:', err);
        alert('Could not access GPS location. Please check browser permissions or search manually.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // 6. Search City Geocoding
  const handleSearchInputChange = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim().length >= 2) {
      setIsSearching(true);
      const results = await searchLocationCoordinates(val);
      setSearchResults(results);
      setIsSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectSearchResult = async (result) => {
    setSearchQuery(`${result.name}, ${result.country}`);
    setSearchResults([]);
    setIsLoadingApi(true);

    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([result.lat, result.lng], 9, { duration: 1.4 });
    }

    const liveData = await fetchLiveWeatherData(result.lat, result.lng, result.name, result.country);
    setIsLoadingApi(false);

    if (liveData) {
      setSelectedStation(liveData);
      soundEffects.playPop(650);
    }
  };

  // 7. Reset Map to Planetary World View
  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([22, 20], 3, { duration: 1.2 });
    }
    soundEffects.playPop(440);
  };

  // 8. Sync Station Telemetry to Main AeroSense Dashboard
  const handleSyncToMain = () => {
    if (onSyncTelemetry) {
      onSyncTelemetry({
        aqi: selectedStation.aqi,
        temp: selectedStation.temp,
        humidity: selectedStation.humidity,
        pm25: Math.round(selectedStation.pm25),
        co2: Math.round(selectedStation.co * 360 + 380),
      });
      setSyncedSuccess(true);
      setTimeout(() => setSyncedSuccess(false), 2500);
      soundEffects.playPop(780);
    }
  };

  // Alarm sound effect if selected is hazard
  useEffect(() => {
    if (selectedStation.isHazard && !isAlarmMuted) {
      soundEffects.playHazardAlarm();
    }
  }, [selectedStation, isAlarmMuted]);

  const aqiColor = getAqiColor(selectedStation.aqi);

  return (
    <div className="space-y-5">
      {/* 1. Flashing Emergency Hazard Alert Banner (when AQI > 150) */}
      {selectedStation.isHazard && (
        <div className="alert-flash-banner rounded-2xl p-4 text-white shadow-2xl border-2 border-rose-400 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-white text-rose-600 animate-bounce shrink-0 shadow-lg">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-xs uppercase tracking-wider bg-black/40 px-2.5 py-0.5 rounded-full border border-white/40">
                  🚨 CRITICAL AIR POLLUTION HAZARD DETECTED
                </span>
                <span className="text-xs font-mono font-bold bg-white text-rose-700 px-2 py-0.5 rounded-full shadow-sm">
                  {selectedStation.name}: {selectedStation.aqi} AQI
                </span>
              </div>
              <p className="text-xs text-rose-100 font-medium mt-1">
                Fine particulate concentration ({selectedStation.pm25} µg/m³) exceeds safe biological limits. HEPA H13 filtration mandatory.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {isAlarmActive && !isAlarmMuted ? (
              <button
                onClick={handleToggleAlarm}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-white text-rose-950 hover:bg-rose-100 shadow-xl border-2 border-rose-400 active:scale-95 transition animate-pulse"
                title="Stop alarm, silence audio, and remove red screen strobe"
              >
                <VolumeX className="w-4 h-4 text-rose-600" />
                <span>🛑 STOP ALARM</span>
              </button>
            ) : (
              <button
                onClick={handleToggleAlarm}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 active:scale-95 transition"
                title="Turn alarm back on"
              >
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>🔊 Re-enable Alarm</span>
              </button>
            )}

            <button
              onClick={handleSyncToMain}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black bg-white text-rose-900 hover:bg-rose-50 shadow-lg active:scale-95 transition"
            >
              <Zap className="w-4 h-4 text-rose-600" />
              <span>Engage Emergency HEPA</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Tactical Command Header & Live Radar Controls */}
      <div className="glass-panel-dark rounded-2xl p-5 text-white border border-slate-700/80 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                Live Satellite & Streets Meteorological GIS
              </span>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Open-Meteo Global API Connected
              </span>
              {isLoadingApi && (
                <span className="text-[11px] font-mono text-sky-300 bg-sky-950/80 px-2.5 py-0.5 rounded-full border border-sky-500/40 flex items-center gap-1.5 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
                  Fetching Live Atmospheric Stream...
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Planetary Earth AQI, Live Weather & GIS Radar
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Explore authentic high-resolution satellite world imagery and street maps with real-time temperature, humidity, wind, and ISO 14001 occupational safety advisories.
            </p>
          </div>

          {/* Map Layer Selector & GPS Locate Button */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Locate Me GPS Button */}
            <button
              onClick={handleLocateMe}
              disabled={isLocatingUser}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg active:scale-95 transition"
              title="Detect my location and fetch real-time local weather & air quality"
            >
              <LocateFixed className={`w-4 h-4 ${isLocatingUser ? 'animate-spin' : ''}`} />
              <span>{isLocatingUser ? 'Locating...' : '🎯 Locate Me (GPS)'}</span>
            </button>

            {/* Map Engine Toggle: Satellite & Streets (No Tactical Dark) */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {[
                { id: 'satellite', label: '🛰️ Satellite' },
                { id: 'streets', label: '🗺️ Streets' },
              ].map((tile) => {
                const isActive = activeTileType === tile.id;
                return (
                  <button
                    key={tile.id}
                    onClick={() => setActiveTileType(tile.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      isActive
                        ? 'bg-sky-500 text-slate-950 shadow-md scale-100'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {tile.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Interface Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Real Interactive Leaflet Map */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel-dark rounded-2xl p-4 border border-slate-700 bg-slate-950 text-white shadow-2xl flex flex-col justify-between">
            {/* Search & Quick Filter Bar with Geocoding Autocomplete */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3 relative z-30">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  placeholder="Search any global city or address..."
                  className="w-full bg-slate-900/90 text-xs font-semibold text-white pl-9 pr-4 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-sky-400 transition"
                />

                {/* Autocomplete Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                    {searchResults.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSearchResult(item)}
                        className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-800 transition flex items-center justify-between border-b border-slate-800/60 last:border-none"
                      >
                        <div>
                          <strong className="text-white">{item.name}</strong>
                          <span className="text-slate-400 ml-1.5">
                            {item.admin1 ? `${item.admin1}, ` : ''}{item.country}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded">
                          {formatNumber(item.lat, { digits: 1 })}°, {formatNumber(item.lng, { digits: 1 })}°
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'hazard', label: '🚨 Hazard' },
                  { id: 'clean', label: '🌿 Clean' },
                  { id: 'humid', label: '💧 Humid' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeFilter === f.id
                        ? 'bg-sky-500 text-slate-950 shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}

                <button
                  onClick={handleResetView}
                  className="p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition"
                  title="Reset to Planetary World View"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Real High-Resolution Leaflet Map Viewport (Responsive height) */}
            <div className="relative w-full h-[340px] sm:h-[440px] lg:h-[500px] rounded-xl overflow-hidden border border-slate-800 shadow-inner bg-slate-900">
              <div
                ref={mapContainerRef}
                style={{ width: '100%', height: '100%', minHeight: '340px' }}
                className="w-full h-full z-10"
              />

              {/* Map Floating HUD Overlay */}
              <div className="absolute top-2.5 left-2.5 z-[400] bg-slate-950/90 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-800 text-[11px] sm:text-xs text-white shadow-xl flex items-center gap-2 pointer-events-none max-w-[90%]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                <span className="font-mono font-bold tracking-wide truncate">
                  GPS: {formatNumber(selectedStation.lat, { digits: 3 })}°N, {formatNumber(selectedStation.lng, { digits: 3 })}°E
                </span>
                <span className="text-slate-500 hidden sm:inline">•</span>
                <span className="text-slate-400 text-[10px] sm:text-[11px] hidden sm:inline">Click map to inspect</span>
              </div>

              {/* Bottom AQI Severity Legend */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto z-[400] bg-slate-950/95 backdrop-blur-md px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-800 text-[9px] sm:text-[10px] text-slate-300 flex items-center justify-between sm:justify-start gap-2 shadow-xl pointer-events-none overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><strong className="text-white">Good</strong></div>
                <div className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-amber-500"></span><strong className="text-white">Moderate</strong></div>
                <div className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-orange-500"></span><strong className="text-white">Sensitive</strong></div>
                <div className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-rose-500"></span><strong className="text-white">Hazard</strong></div>
              </div>
            </div>

            {/* Quick Horizontal City Hubs Scroll Bar */}
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {filteredStations.map((st) => {
                const isSelected = selectedStation.id === st.id;
                const col = getAqiColor(st.aqi);
                return (
                  <button
                    key={st.id}
                    onClick={() => handleSelectStation(st)}
                    className={`shrink-0 flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all text-xs font-bold text-left ${isSelected
                        ? 'bg-slate-800 text-white border-sky-400 shadow-lg ring-2 ring-sky-400 scale-102'
                        : 'bg-slate-900/80 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
                      }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${col.bg}`}></span>
                    <span className="text-slate-200">{st.name}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-700">
                      {st.aqi} AQI
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Deep Regional Telemetry & ISO Work Safety Inspector */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border-2 border-white/90 shadow-xl text-slate-900 space-y-5">
            {/* Station Header & Telemetry Sync */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-sky-700 bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-300">
                    {selectedStation.region}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    Code: {selectedStation.stationCode}
                  </span>
                  {selectedStation.isLiveApi && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      ✓ Live API Synced
                    </span>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 mt-1.5">
                  {selectedStation.name}
                </h2>
                <p className="text-xs font-medium text-slate-600 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-sky-600" />
                  <span>{selectedStation.country} • Lat {formatNumber(selectedStation.lat, { digits: 2 })}°, Lng {formatNumber(selectedStation.lng, { digits: 2 })}°</span>
                </p>
              </div>

              {/* Sync to Ambient Dashboard Button */}
              <button
                onClick={handleSyncToMain}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md shrink-0 active:scale-95 ${syncedSuccess
                    ? 'bg-emerald-600 text-white shadow-emerald-500/40 ring-2 ring-emerald-300'
                    : 'bg-slate-900 hover:bg-slate-800 text-white hover:shadow-lg'
                  }`}
                title="Apply this region's live telemetry to the main AeroSense dashboard and 3D chambers"
              >
                {syncedSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <RefreshCw className="w-4 h-4 text-sky-400" />}
                <span>{syncedSuccess ? 'Synced to UI!' : 'Sync Dashboard'}</span>
              </button>
            </div>

            {/* Primary AQI & Weather Duo Metric Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* AQI Metric Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="uppercase font-bold tracking-wider">Air Quality Index</span>
                  <Wind className="w-4 h-4 text-sky-400" />
                </div>
                <div className="my-2">
                  <div className="text-4xl font-black font-mono tracking-tight text-white flex items-baseline gap-1">
                    {selectedStation.aqi}
                    <span className="text-xs font-sans text-slate-400 font-bold">AQI</span>
                  </div>
                  <div className={`text-xs font-black mt-1 px-2.5 py-0.5 rounded-full inline-block ${aqiColor.bg} text-white shadow-md`}>
                    {selectedStation.status}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  PM2.5: <strong className="text-white font-mono">{selectedStation.pm25} µg/m³</strong>
                </div>
              </div>

              {/* Weather Ambient Card */}
              <div className="p-4 rounded-2xl bg-white border-2 border-slate-200 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
                  <span className="uppercase tracking-wider">Ambient Climate</span>
                  <button
                    onClick={() => setTempUnit(tempUnit === 'C' ? 'F' : 'C')}
                    className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 transition"
                  >
                    °{tempUnit} Toggle
                  </button>
                </div>
                <div className="my-2">
                  <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-950">
                    {formatTemp(selectedStation.temp)}
                  </div>
                  <div className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{selectedStation.condition}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 flex items-center justify-between font-semibold">
                  <span>Feels: <strong>{formatTemp(selectedStation.feelsLike)}</strong></span>
                  <span>RH: <strong>{selectedStation.humidity}%</strong></span>
                </div>
              </div>
            </div>

            {/* Chemical Pollutant & Atmospheric Spectrometry Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-900">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-600" />
                  Atmospheric & Gas Spectrometry Matrix
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Live Sensirion/NDIR</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">PM2.5 Fine</div>
                  <div className="text-sm font-black font-mono text-slate-900">{selectedStation.pm25} <span className="text-[9px] font-sans">µg/m³</span></div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">PM10 Coarse</div>
                  <div className="text-sm font-black font-mono text-slate-900">{selectedStation.pm10} <span className="text-[9px] font-sans">µg/m³</span></div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Humidity</div>
                  <div className="text-sm font-black font-mono text-slate-900">{selectedStation.humidity}% <span className="text-[9px] font-sans">RH</span></div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Pressure</div>
                  <div className="text-sm font-black font-mono text-slate-900">{selectedStation.pressure} <span className="text-[9px] font-sans">hPa</span></div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Wind Vector</div>
                  <div className="text-sm font-black font-mono text-slate-900">{selectedStation.windSpeed} <span className="text-[9px] font-sans">km/h {selectedStation.windDirection}</span></div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">UV Solar Index</div>
                  <div className="text-sm font-black font-mono text-slate-900">{selectedStation.uvIndex} <span className="text-[9px] font-sans">UV</span></div>
                </div>
              </div>
            </div>

            {/* Work Type & Activity Safety Advisory (ISO 14001) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-950 flex items-center gap-1.5">
                  <HardHat className="w-4 h-4 text-amber-600" />
                  Work Type & Activity Safety Advisory
                </h3>
                <span className="text-[10px] font-mono font-bold text-slate-500">ISO 14001 Compliance</span>
              </div>

              <div className="space-y-2">
                {/* 1. Heavy Outdoor Work */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-slate-700" />
                      Heavy Outdoor Work & Construction
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${selectedStation.workSafety.heavyOutdoor.color}`}>
                      {selectedStation.workSafety.heavyOutdoor.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium leading-normal">
                    {selectedStation.workSafety.heavyOutdoor.text}
                  </p>
                </div>

                {/* 2. Indoor Office & Corporate */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-700" />
                      Indoor Office, Corporate & Telework
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${selectedStation.workSafety.indoorOffice.color}`}>
                      {selectedStation.workSafety.indoorOffice.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium leading-normal">
                    {selectedStation.workSafety.indoorOffice.text}
                  </p>
                </div>

                {/* 3. Outdoor Sports & Cardio */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-slate-700" />
                      Athletic Exertion & Outdoor Cardio
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${selectedStation.workSafety.exercise.color}`}>
                      {selectedStation.workSafety.exercise.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium leading-normal">
                    {selectedStation.workSafety.exercise.text}
                  </p>
                </div>
              </div>
            </div>

            {/* 24-Hour Diurnal ML Forecast Bar Chart */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs font-black text-slate-950">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-sky-600" />
                  24-Hour Diurnal AQI & Temperature Forecast
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Hourly Progression</span>
              </div>

              <div className="flex items-end justify-between gap-1.5 h-20 pt-4 px-2.5 bg-slate-50 rounded-xl border border-slate-200">
                {selectedStation.forecast.map((f, idx) => {
                  const barHeight = Math.max(18, Math.min(100, (f.aqi / 300) * 100));
                  const col = getAqiColor(f.aqi);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                      <div className="absolute -top-7 whitespace-nowrap bg-slate-950 text-white text-[9px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none z-30 font-mono shadow-md">
                        {f.aqi} AQI • {formatTemp(f.temp)}
                      </div>
                      <div
                        style={{ height: `${barHeight}%` }}
                        className={`w-full rounded-t-md transition-all duration-500 ${col.bg} group-hover:brightness-110 shadow-sm`}
                      />
                      <span className="text-[9px] font-mono font-bold text-slate-600">{f.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
