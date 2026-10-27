import type { DetailedEarthquake } from "./types";
import { haversineDistanceKm } from "../geolocation";
import { SOURCES } from "./constants";

/**
 * check if two records represent the same events, rules: distance <= 100km, time diff only <= 120s, diff in magnitude 0.8!
 */
export function isSameEvent(
  a: DetailedEarthquake,
  b: DetailedEarthquake
): boolean {
  const timeDiffSec = Math.abs(a.timing.timestamp_ms - b.timing.timestamp_ms) / 1000;
  if (timeDiffSec > 120) return false;

  const distKm = haversineDistanceKm(
    a.coordinates.latitude,
    a.coordinates.longitude,
    b.coordinates.latitude,
    b.coordinates.longitude
  );
  if (distKm > 100) return false;

  const magDiff = Math.abs(a.magnitude.value - b.magnitude.value);
  if (magDiff > 0.8) return false;

  return true;
}

/**
 * merge two records (metmalaysia & usgs)
 */
export function mergeEarthquakeRecords(
  metmy: DetailedEarthquake,
  usgs: DetailedEarthquake
): DetailedEarthquake {
  // if theres usgs id, use this as primary
  const primaryId = usgs.id;

  const combinedSources = [
    {
      name: SOURCES.MET.name,
      title: SOURCES.MET.title,
      url: SOURCES.MET.url,
    },
    {
      name: SOURCES.USGS.name,
      title: SOURCES.USGS.title,
      url: SOURCES.USGS.url,
    },
  ];

  // met data > usgs data for malaysia context
  const masContext = metmy.metmalaysia_data?.distance_mas_en
    ? metmy.malaysia_context
    : usgs.malaysia_context;

  // usgs data > met data for map url
  const mapImageUrl =
    usgs.usgs_data?.visual_map_image_url ||
    usgs.visual.map_image_url ||
    metmy.visual.map_image_url;

  const interactiveMapUrl =
    usgs.usgs_data?.interactive_map_url ||
    usgs.visual.interactive_map_url ||
    metmy.visual.interactive_map_url;

  return {
    id: primaryId,
    title: usgs.title || metmy.title,
    magnitude: {
      value: usgs.magnitude.value || metmy.magnitude.value,
      type: usgs.magnitude.type || metmy.magnitude.type,
      category: usgs.magnitude.category || metmy.magnitude.category,
    },
    coordinates: {
      latitude: usgs.coordinates.latitude,
      longitude: usgs.coordinates.longitude,
      depth_km: usgs.coordinates.depth_km || metmy.coordinates.depth_km,
    },
    location: {
      place: usgs.location.place || metmy.location.place,
      country: usgs.location.country || metmy.location.country,
      region_scope: metmy.location.region_scope || usgs.location.region_scope,
    },
    malaysia_context: masContext,
    timing: {
      utc: usgs.timing.utc,
      local_my: metmy.timing.local_my || usgs.timing.local_my,
      timestamp_ms: usgs.timing.timestamp_ms,
      time_ago: usgs.timing.time_ago,
    },
    tsunami_alert: usgs.tsunami_alert || metmy.tsunami_alert,
    status: usgs.status || metmy.status,
    visual: {
      map_image_url: mapImageUrl,
      interactive_map_url: interactiveMapUrl,
    },
    sources: combinedSources,
    usgs_data: usgs.usgs_data,
    metmalaysia_data: metmy.metmalaysia_data,
    provider_ids: {
      usgs_id: usgs.id,
      metmy_id: metmy.id,
    },
  };
}

/**
 * to deduplicate and merge usgs and met list.
 */
export function deduplicateAndMerge(
  metmyList: DetailedEarthquake[],
  usgsList: DetailedEarthquake[]
): { merged: DetailedEarthquake[]; matchedCount: number } {
  const result: DetailedEarthquake[] = [];
  const matchedUsgsIds = new Set<string>();
  let matchedCount = 0;

  for (const met of metmyList) {
    const matchingUsgs = usgsList.find(
      (u) => !matchedUsgsIds.has(u.id) && isSameEvent(met, u)
    );

    if (matchingUsgs) {
      matchedUsgsIds.add(matchingUsgs.id);
      matchedCount++;
      result.push(mergeEarthquakeRecords(met, matchingUsgs));
    } else {
      result.push(met);
    }
  }

  // not duplicate, add rest
  for (const u of usgsList) {
    if (!matchedUsgsIds.has(u.id)) {
      result.push(u);
    }
  }

  // descending order
  result.sort((a, b) => b.timing.timestamp_ms - a.timing.timestamp_ms);

  return { merged: result, matchedCount };
}
