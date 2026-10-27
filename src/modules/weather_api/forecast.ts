import client from "../redis";
import {
  MET_WEATHER_FORECAST_URL,
  REDIS_KEYS,
  SOURCES,
} from "./constants";
import {
  findDistrictByCoordinates,
  normalizeDistrictName,
  resolveStateCode,
  getStateName,
} from "../geolocation";
import type {
  RawForecastRecord,
  DailyForecast,
  DistrictForecast,
  DistrictMatchResult,
  TranslatedText,
} from "./types";

// translations
export const FORECAST_TRANSLATIONS: Record<string, string> = {
  berjerebu: "Hazy",
  "tiada hujan": "No rain",
  cerah: "Clear",
  mendung: "Overcast",
  hujan: "Rain",
  "hujan di beberapa tempat": "Scattered rain",
  "hujan di satu dua tempat": "Isolated rain",
  "hujan di kebanyakan tempat": "Widespread rain",
  "hujan di satu dua tempat di kawasan pantai": "Isolated rain over coastal areas",
  "hujan di satu dua tempat di kawasan pedalaman": "Isolated rain over inland areas",
  "hujan di kebanyakan tempat di kawasan pantai": "Widespread rain over coastal areas",
  "hujan di kebanyakan tempat di kawasan pedalaman": "Widespread rain over inland areas",
  "ribut petir": "Thunderstorms",
  "ribut petir di beberapa tempat": "Scattered thunderstorms",
  "ribut petir di satu dua tempat": "Isolated thunderstorms",
  "ribut petir di kebanyakan tempat": "Widespread thunderstorms",
  "ribut petir di beberapa tempat di kawasan pedalaman": "Scattered thunderstorms over inland areas",
  "ribut petir di satu dua tempat di kawasan pantai": "Isolated thunderstorms over coastal areas",
  "ribut petir di satu dua tempat di kawasan pedalaman": "Isolated thunderstorms over inland areas",
  "ribut petir di kebanyakan tempat di kawasan pantai": "Widespread thunderstorms over coastal areas",
  "ribut petir di kebanyakan tempat di kawasan pedalaman": "Widespread thunderstorms over inland areas",

  // summary_when
  pagi: "Morning",
  "tengah hari": "Noon",
  petang: "Afternoon",
  malam: "Night",
  "pagi dan petang": "Morning and afternoon",
  "pagi dan malam": "Morning and night",
  "petang dan malam": "Afternoon and night",
  "sepanjang hari": "All day",
  tiada: "None",
};

// day names in BM and EN
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_BM = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

// location id prefix map
const LOCATION_CATEGORY_MAP: Record<string, string> = {
  St: "State",
  Rc: "Recreation Centre",
  Ds: "District",
  Tn: "Town",
  Dv: "Division",
};

// extra mapping
const EXTRA_LOCATION_STATE_MAP: Record<string, string> = {
  "tanah tinggi cameron": "PHG",
  cameron: "PHG",
  "cameron highlands": "PHG",
  meradong: "SWK",
  membakut: "SBH",
  "labuk & sugut": "SBH",
  sook: "SBH",
  pantu: "SWK",
  lingga: "SWK",
  bario: "SWK",
  "taman negara pulau pinang": "PNG",
  "batu feringgi": "PNG",
  "bukit bendera": "PNG",
  "teluk bahang": "PNG",
  kundasang: "SBH",
  "taman nasional kinabalu": "SBH",
  "pulau sipadan": "SBH",
  "genting highlands": "PHG",
  "tanah tinggi genting": "PHG",
  "bukit tinggi": "PHG",
  "fraser hill": "PHG",
  "bukit fraser": "PHG",
  tioman: "PHG",
  "pulau tioman": "PHG",
  cherating: "PHG",
  "taman negara": "PHG",
  "pulau redang": "TRG",
  "pulau perhentian": "TRG",
  "pulau kapas": "TRG",
  "tanjung jara": "TRG",
  kijal: "TRG",
  "taman negara terengganu": "TRG",
  "pulau pangkor": "PRK",
  pangkor: "PRK",
  lumut: "PRK",
  "taman negara kelantan": "KTN",
  "paya indah wetlands": "SGR",
  desaru: "JHR",
  labuan: "LBN",
  putrajaya: "PJY",
  "kuala lumpur": "KUL",
};

/**
 * translate forecast into both bm and en
 */
export function translateForecastText(rawText?: string | null): TranslatedText {
  if (!rawText) return { bm: "", en: "" };
  const clean = rawText.trim();
  const lower = clean.toLowerCase();
  const en = FORECAST_TRANSLATIONS[lower] || clean;
  return { bm: clean, en };
}

/**
 * resolve location category from location_id
 */
function getLocationCategory(locationId?: string | null): string {
  if (!locationId || locationId.length < 2) return "District";
  const prefix = locationId.slice(0, 2);
  return LOCATION_CATEGORY_MAP[prefix] || "District";
}

/**
 * get canonical state code for forecast location name
 */
function resolveForecastState(locationName: string): string {
  const lower = locationName.toLowerCase().trim();

  // extra mapping (resorts, islands, parks)
  if (EXTRA_LOCATION_STATE_MAP[lower]) {
    return EXTRA_LOCATION_STATE_MAP[lower];
  }

  // direct state resolution (if location is a state name)
  const directState = resolveStateCode(lower);
  if (directState) return directState;

  // district name normalization
  const canonicalDistrict = normalizeDistrictName(locationName);
  const stateFromNorm = resolveStateCode(canonicalDistrict);
  if (stateFromNorm) return stateFromNorm;

  // default fallback
  return "UNKNOWN";
}

/**
 * fetch latest 7-day weather forecast from MET and sync to Redis
 */
export async function syncWeatherForecast(options?: { force?: boolean }): Promise<{
  updated: boolean;
  count: number;
  hash: string;
  reason?: string;
  error?: string;
}> {
  try {
    const url = MET_WEATHER_FORECAST_URL;

    const response = await fetch(url, {
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

    // check if hash changed
    if (!options?.force) {
      const storedHash = await client.get(REDIS_KEYS.WEATHER_FORECAST_BODY_HASH);
      if (storedHash && storedHash === currentHash) {
        await client.set(REDIS_KEYS.WEATHER_FORECAST_LAST_UPDATE, new Date().toISOString());
        return {
          updated: false,
          count: 0,
          hash: currentHash,
          reason: "cache_hit_unchanged",
        };
      }
    }

    const rawRecords: RawForecastRecord[] = JSON.parse(rawText);

    // group records based on the loc name
    const groupedByLocation = new Map<string, { id: string; records: RawForecastRecord[] }>();
    for (const rec of rawRecords) {
      const locName = rec.location?.location_name?.trim();
      const locId = rec.location?.location_id || "";
      if (!locName) continue;

      if (!groupedByLocation.has(locName)) {
        groupedByLocation.set(locName, { id: locId, records: [] });
      }
      groupedByLocation.get(locName)!.records.push(rec);
    }

    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date());

    const forecastsList: DistrictForecast[] = [];
    const forecastsByState: Record<string, DistrictForecast[]> = {};

    for (const [locName, { id: locId, records }] of groupedByLocation.entries()) {
      // ascending by date
      records.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

      // filter 7 days, starting today
      const validRecords = records.filter((r) => r.date && r.date >= todayStr);
      const targetRecords = validRecords.length > 0 ? validRecords.slice(0, 7) : records.slice(0, 7);

      const dailyForecasts: DailyForecast[] = targetRecords.map((r) => {
        const dateStr = r.date || "";
        const d = new Date(dateStr);
        const dayIdx = isNaN(d.getTime()) ? 0 : d.getDay();

        return {
          date: dateStr,
          day_en: DAYS_EN[dayIdx],
          day_bm: DAYS_BM[dayIdx],
          is_today: dateStr === todayStr,
          morning_forecast: translateForecastText(r.morning_forecast),
          afternoon_forecast: translateForecastText(r.afternoon_forecast),
          night_forecast: translateForecastText(r.night_forecast),
          summary_forecast: translateForecastText(r.summary_forecast),
          summary_when: translateForecastText(r.summary_when),
          temperature: {
            min: typeof r.min_temp === "number" ? r.min_temp : 24,
            max: typeof r.max_temp === "number" ? r.max_temp : 33,
            unit: "Celsius",
          },
        };
      });

      const stateCode = resolveForecastState(locName);
      const stateName = getStateName(stateCode);
      const slug = locName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      const category = getLocationCategory(locId);

      const districtForecast: DistrictForecast = {
        location_id: locId,
        location_name: locName,
        location_slug: slug,
        location_category: category,
        state: {
          code: stateCode,
          name: stateName,
        },
        forecasts: dailyForecasts,
        source: SOURCES.MET,
      };

      forecastsList.push(districtForecast);

      if (!forecastsByState[stateCode]) {
        forecastsByState[stateCode] = [];
      }
      forecastsByState[stateCode].push(districtForecast);
    }

    const multi = client.multi();

    // store in redis
    multi.set(REDIS_KEYS.WEATHER_FORECAST_ALL, JSON.stringify(forecastsList));

    // store each district forecast by slug for single key retrievall
    for (const fc of forecastsList) {
      multi.set(
        `${REDIS_KEYS.WEATHER_FORECAST_DISTRICT_PREFIX}${fc.location_slug}`,
        JSON.stringify(fc)
      );
    }

    // store forecast by state >.<
    for (const [code, list] of Object.entries(forecastsByState)) {
      multi.set(
        `${REDIS_KEYS.WEATHER_FORECAST_STATE_PREFIX}${code}`,
        JSON.stringify(list)
      );
    }

    multi.set(REDIS_KEYS.WEATHER_FORECAST_BODY_HASH, currentHash);
    multi.set(REDIS_KEYS.WEATHER_FORECAST_LAST_UPDATE, new Date().toISOString());

    await multi.exec();

    return {
      updated: true,
      count: forecastsList.length,
      hash: currentHash,
    };
  } catch (err: any) {
    console.error("Error syncing MetMalaysia weather forecast:", err);
    return {
      updated: false,
      count: 0,
      hash: "",
      error: err?.message || String(err),
    };
  }
}

/**
 * returns all 7 days forecast
 */
export async function getAllForecasts(): Promise<DistrictForecast[]> {
  const cached = await client.get(REDIS_KEYS.WEATHER_FORECAST_ALL);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // sync again can't parse
    }
  }

  await syncWeatherForecast({ force: true });
  const fresh = await client.get(REDIS_KEYS.WEATHER_FORECAST_ALL);
  return fresh ? JSON.parse(fresh) : [];
}

/**
 * returns 7 days forecast for specific district
 */
export async function getForecastForDistrict(
  districtName: string,
  stateCode?: string
): Promise<DistrictForecast | null> {
  const slug = districtName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const cached = await client.get(`${REDIS_KEYS.WEATHER_FORECAST_DISTRICT_PREFIX}${slug}`);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // fail :c
    }
  }

  // scan all forecast
  const all = await getAllForecasts();
  const norm = districtName.toLowerCase().trim();

  const found =
    all.find((f) => f.location_name.toLowerCase() === norm) ||
    all.find((f) => f.location_name.toLowerCase().includes(norm) || norm.includes(f.location_name.toLowerCase()));

  if (found) return found;

  // fallback to state capital / primary city in state
  if (stateCode) {
    const stateForecasts = all.filter((f) => f.state.code === stateCode.toUpperCase());
    if (stateForecasts.length > 0) {
      return stateForecasts[0];
    }
  }

  return null;
}

/**
 * returns 7 days forecast for given coordinates
 */
export async function getForecastForCoordinates(
  lat: number,
  lng: number
): Promise<{
  location: DistrictMatchResult;
  forecast: DistrictForecast | null;
}> {
  const loc = findDistrictByCoordinates(lat, lng);

  if (!loc.found || !loc.district_name) {
    return {
      location: loc,
      forecast: null,
    };
  }

  const forecast = await getForecastForDistrict(loc.district_name, loc.state_code);
  return {
    location: loc,
    forecast,
  };
}

/**
 * returns all district forecast for state
 */
export async function getForecastsByState(stateCodeOrName: string): Promise<DistrictForecast[]> {
  const code = resolveStateCode(stateCodeOrName);
  if (!code) return [];

  const cached = await client.get(`${REDIS_KEYS.WEATHER_FORECAST_STATE_PREFIX}${code}`);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // fail so gotta get all :c
    }
  }

  const all = await getAllForecasts();
  return all.filter((f) => f.state.code === code);
}
