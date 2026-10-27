export const MET_BASE_URL = "https://api.data.gov.my/weather";
export const MET_WEATHER_WARNING_URL = "https://api.data.gov.my/weather/warning";
export const MET_WEATHER_FORECAST_URL = "https://api.data.gov.my/weather/forecast";
export const DOE_AIR_QUALITY_URL = "https://eqms.doe.gov.my/api3/publicportalapims/mapcaqm";

export const REDIS_KEYS = {
  // last update timestamp
  WEATHER_ADVISORY_LAST_UPDATE: "weather_advisory_last_successful_update",
  WEATHER_FORECAST_LAST_UPDATE: "weather_forecast_last_successful_update",
  DOE_AIR_QUALITY_LAST_UPDATE: "doe_air_quality_last_successful_update",

  // hashes
  WEATHER_ADVISORY_BODY_HASH: "weather:advisory:body_hash",
  WEATHER_ADVISORY_CACHE_HEADERS: "weather:advisory:cache_headers",
  WEATHER_FORECAST_BODY_HASH: "weather:forecast:body_hash",
  DOE_AIR_QUALITY_BODY_HASH: "doe:air_quality:body_hash",

  // weather advisory
  ACTIVE_ADVISORIES_SET: "weather:advisories:active",
  ADVISORY_PREFIX: "weather:advisory:",
  STATE_SET_PREFIX: "weather:advisories:state:",
  DISTRICT_SET_PREFIX: "weather:advisories:district:",
  MARINE_SET_PREFIX: "weather:advisories:marine:",
  ALL_INDEXED_KEYS_SET: "weather:advisories:all_index_keys",

  // air quality
  AIR_QUALITY_ALL_STATIONS: "air_quality:stations:all",
  AIR_QUALITY_STATE_PREFIX: "air_quality:state:",

  // weather forecast
  WEATHER_FORECAST_ALL: "weather:forecast:all",
  WEATHER_FORECAST_DISTRICT_PREFIX: "weather:forecast:district:",
  WEATHER_FORECAST_STATE_PREFIX: "weather:forecast:state:",
} as const;

export interface SourceAttribution {
  name: string;
  name_bm?: string;
  govt_logo: string;
  url: string;
}

export const SOURCES = {
  MET: {
    name: "Malaysian Meteorological Department (MetMalaysia)",
    name_bm: "Jabatan Meteorologi Malaysia",
    govt_logo: "https://api.met.gov.my/static/public/images/logomet.png",
    url: "https://www.met.gov.my/",
  },
  DOE: {
    name: "Department of Environment (DOE)",
    name_bm: "Jabatan Alam Sekitar (JAS)",
    govt_logo: "https://www.doe.gov.my/wp-content/uploads/2021/12/jas-smoll.png",
    url: "https://apims.doe.gov.my/",
  },
} as const;