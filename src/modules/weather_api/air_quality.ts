import client from "../redis";
import {
  DOE_AIR_QUALITY_URL,
  REDIS_KEYS,
  SOURCES,
} from "./constants";
import {
  resolveStateCode,
  getStateName,
  findDistrictByCoordinates,
} from "../geolocation";
import type {
  RawDoeStation,
  AirQualityStation,
  AirQualityLocationResult,
  AirQualityStateResult,
} from "./types";
import { haversineDistanceKm } from "../geolocation/geo";

// eng to bahasa melayu
const CLASS_BM_MAP: Record<string, string> = {
  good: "Baik",
  moderate: "Sederhana",
  unhealthy: "Tidak Sihat",
  "very unhealthy": "Sangat Tidak Sihat",
  hazardous: "Berbahaya",
};

// DOE to canonical state code
const DOE_STATE_ID_MAP: Record<number, string> = {
  1: "JHR",
  2: "KDH",
  3: "KTN",
  4: "MLK",
  5: "NSN",
  6: "PHG",
  7: "PNG",
  8: "PRK",
  9: "PLS",
  10: "SGR",
  11: "TRG",
  12: "SBH",
  13: "SWK",
  14: "KUL",
  15: "LBN",
  16: "PJY",
};

/**
 * normalize data into standardized format
 */
function normalizeStation(raw: RawDoeStation): AirQualityStation {
  // resolve canonical state code via state_ID or state_name
  const stateCode =
    DOE_STATE_ID_MAP[raw.STATE_ID] ||
    resolveStateCode(raw.STATE_NAME) ||
    "UNKNOWN";
  const stateName = getStateName(stateCode);

  // clean location name (e.g. "Kangar, PERLIS" -> "Kangar")
  const fullLoc = (raw.STATION_LOCATION || "").trim();
  const cleanName = fullLoc.split(/,/)[0].trim();

  const classKey = (raw.CLASS || "Moderate").toLowerCase().trim();
  const classBm = CLASS_BM_MAP[classKey] || raw.CLASS || "Sederhana";

  return {
    id: raw.STATION_ID,
    location_name: cleanName,
    full_location: fullLoc,
    coordinates: {
      lat: raw.LATITUDE,
      lng: raw.LONGITUDE,
    },
    state: {
      id: raw.STATE_ID,
      code: stateCode,
      name: stateName,
    },
    api: typeof raw.API === "number" ? raw.API : 0,
    class: raw.CLASS || "Moderate",
    class_bm: classBm,
    primary_pollutant: raw.PARAM_SYMBOL || "**",
    recorded_at: raw.RECORD_DT,
  };
}

/**
 * fetches latest air quality data from DOE and syncs to redis.
 * uses bun.hash to skip re-parsing and re-writing when upstream data is unchanged. (saves mem, cpu, and others >.<)
 */
export async function syncAirQuality(options?: { force?: boolean }): Promise<{
  updated: boolean;
  count: number;
  hash: string;
  reason?: string;
  error?: string;
}> {
  try {
    const response = await fetch(DOE_AIR_QUALITY_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        updated: false,
        count: 0,
        hash: "",
        error: `HTTP error ${response.status}: ${response.statusText}`,
      };
    }

    const rawText = await response.text();
    const currentHash = Bun.hash(rawText).toString();

    // check if body changed
    if (!options?.force) {
      const storedHash = await client.get(REDIS_KEYS.DOE_AIR_QUALITY_BODY_HASH);
      if (storedHash && storedHash === currentHash) {
        await client.set(REDIS_KEYS.DOE_AIR_QUALITY_LAST_UPDATE, new Date().toISOString());
        return {
          updated: false,
          count: 0,
          hash: currentHash,
          reason: "cache_hit_unchanged",
        };
      }
    }

    const json = JSON.parse(rawText);
    const rawStations: RawDoeStation[] = Array.isArray(json?.data) ? json.data : [];

    const stations: AirQualityStation[] = rawStations.map(normalizeStation);

    // group by state code
    const stationsByState: Record<string, AirQualityStation[]> = {};
    for (const st of stations) {
      if (!stationsByState[st.state.code]) {
        stationsByState[st.state.code] = [];
      }
      stationsByState[st.state.code].push(st);
    }

    const multi = client.multi();

    // store all stations in a single key (68 stations is ~15KB)
    multi.set(REDIS_KEYS.AIR_QUALITY_ALL_STATIONS, JSON.stringify(stations));

    // store stations grouped by state
    for (const [code, list] of Object.entries(stationsByState)) {
      multi.set(`${REDIS_KEYS.AIR_QUALITY_STATE_PREFIX}${code}`, JSON.stringify(list));
    }

    multi.set(REDIS_KEYS.DOE_AIR_QUALITY_BODY_HASH, currentHash);
    multi.set(REDIS_KEYS.DOE_AIR_QUALITY_LAST_UPDATE, new Date().toISOString());

    await multi.exec();

    return {
      updated: true,
      count: stations.length,
      hash: currentHash,
    };
  } catch (err: any) {
    console.error("Error syncing DOE air quality:", err);
    return {
      updated: false,
      count: 0,
      hash: "",
      error: err?.message || String(err),
    };
  }
}

/**
 * returns all active air quality stations across Malaysia
 */
export async function getAllAirQualityStations(): Promise<AirQualityStation[]> {
  const cached = await client.get(REDIS_KEYS.AIR_QUALITY_ALL_STATIONS);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // fall through to resync!!!
    }
  }

  await syncAirQuality({ force: true });
  const fresh = await client.get(REDIS_KEYS.AIR_QUALITY_ALL_STATIONS);
  return fresh ? JSON.parse(fresh) : [];
}

/**
 * finds nearest air quality station from coord
 */
export async function getAirQualityForCoordinates(
  lat: number,
  lng: number
): Promise<AirQualityLocationResult> {
  const loc = findDistrictByCoordinates(lat, lng);
  const stations = await getAllAirQualityStations();

  if (stations.length === 0) {
    return {
      location: loc,
      nearest_station: null,
      state_stations: [],
      source: SOURCES.DOE,
    };
  }

  // calc distance to all stations and sort ascending
  const stationsWithDistance = stations.map((st) => {
    const dist = haversineDistanceKm(lat, lng, st.coordinates.lat, st.coordinates.lng);
    return {
      ...st,
      distance_km: Math.round(dist * 10) / 10,
    };
  });

  stationsWithDistance.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
  const candidateNearest = stationsWithDistance[0] || null;
  // if coord is outside malaysia boundary or further than 100km, return null for nearest station
  const nearest = candidateNearest && (candidateNearest.distance_km ?? 0) <= 100 ? candidateNearest : null;

  // find stations within the user's identified state (if any)
  let stateStations: AirQualityStation[] = [];
  if (loc.found && loc.state_code) {
    stateStations = stationsWithDistance.filter((st) => st.state.code === loc.state_code);
  } else if (nearest) {
    stateStations = stationsWithDistance.filter((st) => st.state.code === nearest.state.code);
  }

  return {
    location: loc,
    nearest_station: nearest,
    state_stations: stateStations,
    source: SOURCES.DOE,
  };
}

/**
 * return air quality stations for a state
 */
export async function getAirQualityByState(stateCodeOrName: string): Promise<AirQualityStateResult> {
  const code = resolveStateCode(stateCodeOrName);
  if (!code) {
    return {
      state: { code: stateCodeOrName, name: stateCodeOrName },
      average_api: 0,
      highest_station: null,
      stations: [],
      source: SOURCES.DOE,
    };
  }

  const stateName = getStateName(code);
  const cached = await client.get(`${REDIS_KEYS.AIR_QUALITY_STATE_PREFIX}${code}`);

  let stations: AirQualityStation[] = [];
  if (cached) {
    try {
      stations = JSON.parse(cached);
    } catch {
      stations = [];
    }
  }

  if (stations.length === 0) {
    const all = await getAllAirQualityStations();
    stations = all.filter((s) => s.state.code === code);
  }

  let avgApi = 0;
  let highest: AirQualityStation | null = null;

  if (stations.length > 0) {
    const total = stations.reduce((sum, s) => sum + s.api, 0);
    avgApi = Math.round(total / stations.length);
    highest = [...stations].sort((a, b) => b.api - a.api)[0] || null;
  }

  return {
    state: {
      code,
      name: stateName,
    },
    average_api: avgApi,
    highest_station: highest,
    stations,
    source: SOURCES.DOE,
  };
}
