import { MET_EARTHQUAKE_URL, SOURCES } from "./constants";
import type {
  DetailedEarthquake,
  RawMetMalaysiaEarthquake,
} from "./types";
import {
  classifyMagnitude,
  classifyRegionScope,
  formatTimeAgo,
  generateMapImageUrl,
} from "./helpers";
import { findNearestMalaysianAnchor } from "../geolocation/geo";

/**
 * extract country name: Bonin Islands, Japan Region -> Japan 
 */
function extractCountry(location: string): string | undefined {
  if (!location) return undefined;
  const parts = location.split(",").map((s) => s.trim());
  if (parts.length > 1) {
    const last = parts[parts.length - 1].replace(/\b(region|islands|sea|peninsula)\b/gi, "").trim();
    if (last) return last;
  }
  return parts[0];
}

/**
 * parse the distance string from 3,301km NE Pulau X, Y -> km, direction, anchorName
 */
function parseMetDistanceMas(raw: string, lat: number, lon: number) {
  if (!raw) return findNearestMalaysianAnchor(lat, lon);

  const match = raw.match(/^([\d,]+)\s*km\s*([A-Za-z]+)?\s*(.+)$/i);
  if (match) {
    const km = parseInt(match[1].replace(/,/g, ""), 10);
    const dir = match[2]?.trim().toUpperCase();
    const ref = match[3]?.trim();
    return {
      distanceKm: isNaN(km) ? findNearestMalaysianAnchor(lat, lon).distanceKm : km,
      direction: dir || findNearestMalaysianAnchor(lat, lon).direction,
      anchorName: ref || findNearestMalaysianAnchor(lat, lon).anchorName,
    };
  }

  return findNearestMalaysianAnchor(lat, lon);
}

/**
 * normalisation from raw to a DetailedEarthquake type
 */
export function normalizeMetMyEarthquake(raw: RawMetMalaysiaEarthquake): DetailedEarthquake {
  const utcDate = new Date(`${raw.utcdatetime}Z`);
  const timestampMs = isNaN(utcDate.getTime()) ? Date.now() : utcDate.getTime();

  const cleanTime = raw.utcdatetime.replace(/[-:T]/g, "");
  const latCode = Math.round(raw.lat * 100);
  const lonCode = Math.round(raw.lon * 100);
  const id = `metmy_${cleanTime}_${latCode}_${lonCode}`;

  const masDist = parseMetDistanceMas(raw.n_distancemas, raw.lat, raw.lon);
  const regionScope = classifyRegionScope(raw.lat, raw.lon, masDist.distanceKm);
  const country = extractCountry(raw.location);

  const magVal = Math.round(raw.magdefault * 10) / 10;
  const magType = raw.magtypedefault || "M";

  const isTsunamiAlert =
    raw.status.toUpperCase().includes("TSUNAMI") ||
    raw.status.toUpperCase().includes("AMARAN");

  return {
    id,
    title: `M ${magVal} - ${raw.location || "Earthquake Warning"}`,
    magnitude: {
      value: magVal,
      type: magType,
      category: classifyMagnitude(magVal),
    },
    coordinates: {
      latitude: raw.lat,
      longitude: raw.lon,
      depth_km: raw.depth,
    },
    location: {
      place: raw.location,
      country,
      region_scope: regionScope,
    },
    malaysia_context: {
      is_relevant_to_malaysia: regionScope === "malaysia" || masDist.distanceKm <= 3500,
      distance_km: masDist.distanceKm,
      direction: masDist.direction,
      nearest_reference_point: masDist.anchorName,
    },
    timing: {
      utc: `${raw.utcdatetime}Z`,
      local_my: `${raw.localdatetime}+08:00`,
      timestamp_ms: timestampMs,
      time_ago: formatTimeAgo(timestampMs),
    },
    tsunami_alert: isTsunamiAlert,
    status: raw.status || "NORMAL",
    visual: {
      map_image_url: generateMapImageUrl(raw.lat, raw.lon),
      interactive_map_url: `https://www.openstreetmap.org/?mlat=${raw.lat}&mlon=${raw.lon}#map=7/${raw.lat}/${raw.lon}`,
    },
    sources: [
      {
        name: SOURCES.MET.name,
        title: SOURCES.MET.title,
        url: SOURCES.MET.url,
      },
    ],
    metmalaysia_data: {
      distance_mas_bm: raw.nbm_distancemas,
      distance_mas_en: raw.n_distancemas,
      distance_rest_bm: raw.nbm_distancerest,
      distance_rest_en: raw.n_distancerest,
      lat_vector: raw.lat_vector,
      lon_vector: raw.lon_vector,
      status_bm: raw.status,
      visible: raw.visible,
    },
    provider_ids: {
      metmy_id: id,
    },
  };
}

/**
 * fetch from the api
 */
export async function fetchMetMalaysiaEarthquakes(): Promise<{
  data: DetailedEarthquake[];
  rawText: string;
  error?: string;
}> {
  try {
    const response = await fetch(MET_EARTHQUAKE_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        data: [],
        rawText: "",
        error: `MetMalaysia HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const rawText = await response.text();
    const parsed: RawMetMalaysiaEarthquake[] = JSON.parse(rawText);

    if (!Array.isArray(parsed)) {
      return { data: [], rawText, error: "MetMalaysia response is not an array" };
    }

    const data = parsed.map(normalizeMetMyEarthquake);
    return { data, rawText };
  } catch (err) {
    return {
      data: [],
      rawText: "",
      error: `Failed to fetch MetMalaysia earthquakes: ${String(err)}`,
    };
  }
}
