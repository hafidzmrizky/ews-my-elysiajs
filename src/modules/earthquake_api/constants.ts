export const MET_EARTHQUAKE_URL = "https://api.data.gov.my/weather/warning/earthquake?sort=-localdatetime&limit=15";
export const USGS_4_5_DAY_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";

export const REDIS_EARTHQUAKE_KEYS = {
  LAST_UPDATE: "earthquake_last_successful_update",
  BODY_HASH_METMY: "earthquake:hash:metmy",
  BODY_HASH_USGS: "earthquake:hash:usgs",
  EVENTS_ALL: "earthquake:events:all",
  EVENTS_MALAYSIA: "earthquake:events:malaysia",
  EVENTS_REGIONAL: "earthquake:events:regional",
  EVENTS_GLOBAL: "earthquake:events:global",
  EVENT_PREFIX: "earthquake:event:",
  DETAIL_PREFIX: "earthquake:detail:",
} as const;

export interface SourceAttribution {
  name: "MetMalaysia" | "USGS";
  title: string;
  url: string;
  logo: string;
}

export const SOURCES = {
  MET: {
    name: "MetMalaysia",
    title: "Malaysian Meteorological Department (Jabatan Meteorologi Malaysia)",
    url: "https://www.met.gov.my/",
    logo: "https://api.met.gov.my/static/public/images/logomet.png",
  },
  USGS: {
    name: "USGS",
    title: "United States Geological Survey - Earthquake Hazards Program",
    url: "https://earthquake.usgs.gov/",
    logo: "https://earthquake.usgs.gov/favicon.ico",
  },
} as const;

// SEA / Ring of Fire / Neighboring Countries boundary!
export const REGIONAL_BOUNDS = {
  minLat: -11.0,
  maxLat: 21.0,
  minLng: 92.0,
  maxLng: 141.0,
} as const;
