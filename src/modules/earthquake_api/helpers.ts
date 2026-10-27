import { REGIONAL_BOUNDS } from "./constants";
import type { MagnitudeCategory, RegionScope } from "./types";
import { haversineDistanceKm } from "../geolocation";

/**
 * classify the magnitude of the earthquake (based on richter & mercalli's) 
 */
export function classifyMagnitude(val: number): MagnitudeCategory {
  if (val < 3.0) return "micro";
  if (val < 4.0) return "minor";
  if (val < 5.0) return "light";
  if (val < 6.0) return "moderate";
  if (val < 7.0) return "strong";
  if (val < 8.0) return "major";
  return "great";
}

/**
 * classify where does it happen (in malaysia, regional, global)
 */
export function classifyRegionScope(
  lat: number,
  lng: number,
  distanceKm: number
): RegionScope {
  // Directly in or immediately adjacent to Malaysia
  if (distanceKm <= 75) return "malaysia";

  // Regional: within Southeast Asia / Ring of Fire bounding box or <= 2500km
  const inRegionalBox =
    lat >= REGIONAL_BOUNDS.minLat &&
    lat <= REGIONAL_BOUNDS.maxLat &&
    lng >= REGIONAL_BOUNDS.minLng &&
    lng <= REGIONAL_BOUNDS.maxLng;

  if (inRegionalBox || distanceKm <= 2500) {
    return "regional";
  }

  return "global";
}

/**
 * time format to a human readable
 */
export function formatTimeAgo(timestampMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

/**
 * convert to myt gmt+8
 */
export function toMalaysianIsoString(date: Date): string {
  const mytDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const iso = mytDate.toISOString();
  return `${iso.substring(0, 19)}+08:00`;
}

/**
 * generate map img using yandex static map
 */
export function generateMapImageUrl(
  lat: number,
  lon: number,
  usgsImageUrl?: string | null
): string {
  if (
    usgsImageUrl &&
    (usgsImageUrl.endsWith(".png") ||
      usgsImageUrl.endsWith(".jpg") ||
      usgsImageUrl.endsWith(".jpeg"))
  ) {
    return usgsImageUrl;
  }
  const cleanLat = Math.round(lat * 10000) / 10000;
  const cleanLon = Math.round(lon * 10000) / 10000;
  return `https://static-maps.yandex.ru/1.x/?ll=${cleanLon},${cleanLat}&z=6&size=600,400&l=map&pt=${cleanLon},${cleanLat},pm2rdm`;
}
