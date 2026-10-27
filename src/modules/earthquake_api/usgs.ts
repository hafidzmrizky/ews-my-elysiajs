import { USGS_4_5_DAY_URL, SOURCES } from "./constants";
import type {
  DetailedEarthquake,
  RawUSGSFeature,
  RawUSGSGeoJSON,
} from "./types";
import {
  classifyMagnitude,
  classifyRegionScope,
  formatTimeAgo,
  toMalaysianIsoString,
  generateMapImageUrl,
} from "./helpers";
import { findNearestMalaysianAnchor } from "../geolocation/geo";

/**
 * extract country name from: 89 km SE of X, Y -> Y
 * X = city/town name, Y = country name!!
 */
function extractCountryFromPlace(place: string): string | undefined {
  if (!place) return undefined;
  const parts = place.split(",").map((s) => s.trim());
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }
  const ofMatch = place.match(/\bof\s+(.+)$/i);
  if (ofMatch) {
    return ofMatch[1].trim();
  }
  return place;
}

/**
 * get the shakemap urls
 */
function extractVisualUrls(feature: RawUSGSFeature, lat: number, lon: number) {
  const products = feature.properties.products;
  const sm = products?.shakemap?.[0]?.contents;
  const shakemapIntensity = sm?.["download/intensity.jpg"]?.url;
  const pinThumbnail = sm?.["download/pin-thumbnail.png"]?.url;

  const defaultMapImageUrl =
    shakemapIntensity ||
    pinThumbnail ||
    generateMapImageUrl(lat, lon);

  const interactiveMapUrl = feature.properties.url
    ? `${feature.properties.url}/map`
    : `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=7/${lat}/${lon}`;

  return {
    map_image_url: defaultMapImageUrl,
    interactive_map_url: interactiveMapUrl,
  };
}

/**
 * normalizes raw USGS INTO DetailedEarthquake format
 * it uses malaysia anchor to determine the loc of the impact instead
 */
export function normalizeUSGSEarthquake(feature: RawUSGSFeature): DetailedEarthquake {
  const p = feature.properties;
  const [lon, lat, depth] = feature.geometry.coordinates;

  const timestampMs = p.time;
  const dateObj = new Date(timestampMs);
  const utcStr = dateObj.toISOString();
  const localMyStr = toMalaysianIsoString(dateObj);

  const masDist = findNearestMalaysianAnchor(lat, lon);
  const regionScope = classifyRegionScope(lat, lon, masDist.distanceKm);
  const country = extractCountryFromPlace(p.place);

  const magVal = Math.round((p.mag ?? 0) * 10) / 10;
  const magType = p.magType || "M";

  const visuals = extractVisualUrls(feature, lat, lon);

  return {
    id: feature.id,
    title: p.title || `M ${magVal} - ${p.place}`,
    magnitude: {
      value: magVal,
      type: magType,
      category: classifyMagnitude(magVal),
    },
    coordinates: {
      latitude: Math.round(lat * 10000) / 10000,
      longitude: Math.round(lon * 10000) / 10000,
      depth_km: Math.round(depth * 10) / 10,
    },
    location: {
      place: p.place,
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
      utc: utcStr,
      local_my: localMyStr,
      timestamp_ms: timestampMs,
      time_ago: formatTimeAgo(timestampMs),
    },
    tsunami_alert: p.tsunami === 1,
    status: (p.status || "reviewed").toUpperCase(),
    visual: visuals,
    sources: [
      {
        name: SOURCES.USGS.name,
        title: SOURCES.USGS.title,
        url: SOURCES.USGS.url,
      },
    ],
    usgs_data: {
      event_page_url: p.url,
      interactive_map_url: visuals.interactive_map_url,
      visual_map_image_url: visuals.map_image_url,
      metrics: {
        felt_reports: p.felt,
        cdi: p.cdi,
        mmi: p.mmi,
        alert_color: p.alert,
        significance: p.sig,
        rms: p.rms,
        gap: p.gap,
        nst: p.nst,
      },
    },
    provider_ids: {
      usgs_id: feature.id,
    },
  };
}

/**
 * fetch M4.5+ from usgs in 7 days
 */
export async function fetchUSGSEarthquakes(): Promise<{
  data: DetailedEarthquake[];
  rawText: string;
  error?: string;
}> {
  try {
    const response = await fetch(USGS_4_5_DAY_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        data: [],
        rawText: "",
        error: `USGS HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const rawText = await response.text();
    const parsed: RawUSGSGeoJSON = JSON.parse(rawText);

    if (!parsed?.features || !Array.isArray(parsed.features)) {
      return { data: [], rawText, error: "USGS response features missing or not an array" };
    }

    // filter to M4.5+ n normalize
    const data = parsed.features
      .filter((f) => (f.properties?.mag ?? 0) >= 4.5)
      .map(normalizeUSGSEarthquake);

    return { data, rawText };
  } catch (err) {
    return {
      data: [],
      rawText: "",
      error: `Failed to fetch USGS earthquakes: ${String(err)}`,
    };
  }
}

/**
 * fetch individual detail for event with event id
 */
export async function fetchUSGSEventDetail(
  eventId: string
): Promise<RawUSGSFeature | null> {
  try {
    const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${eventId}.geojson`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as RawUSGSFeature;
  } catch {
    return null;
  }
}
