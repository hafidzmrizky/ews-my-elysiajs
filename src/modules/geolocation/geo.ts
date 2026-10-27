import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import {
    MALAYSIA_STATES,
    STATE_ALIAS_MAP,
    DISTRICT_ALIASES,
    MALAYSIA_BOUNDS,
    MALAYSIA_ANCHORS,
} from "./const";
import type { DistrictMatchResult } from "./types";

interface GeoDistrictFeature {
    type: string;
    properties: {
        name: string;
        code_state: number;
        state: string;
    };
    geometry: {
        type: "MultiPolygon";
        coordinates: number[][][][];
    };
}

interface IndexedDistrict {
    name: string;
    slug: string;
    state_code: string;
    state_name: string;
    code_state: number;
    bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
    centroid: [number, number]; // [lng, lat]
    geometry: GeoDistrictFeature["geometry"];
}

// cache for indexed districts
let indexedDistricts: IndexedDistrict[] = [];
let districtsByState: Record<string, string[]> = {};
let isInitialized = false;

function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
    return (rad * 180) / Math.PI;
}

export function findNearestMalaysianAnchor(
    lat: number,
    lng: number
): { distanceKm: number; anchorName: string; direction: string } {
    let minDistance = Infinity;
    let closest: (typeof MALAYSIA_ANCHORS)[number] = MALAYSIA_ANCHORS[0];

    for (const anchor of MALAYSIA_ANCHORS) {
        const dist = haversineDistanceKm(lat, lng, anchor.lat, anchor.lng);
        if (dist < minDistance) {
            minDistance = dist;
            closest = anchor;
        }
    }

    const direction = calculateCompassDirection(closest.lat, closest.lng, lat, lng);

    return {
        distanceKm: Math.round(minDistance),
        anchorName: closest.name,
        direction,
    };
}

export function calculateCompassDirection(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): string {
    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x =
        Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
    const points = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
    ];
    const idx = Math.round(brng / 22.5) % 16;
    return points[idx];
}

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ray-casting algo, used to check whether the point is inside the polygon
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];

        const intersect =
            yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

// to check if the point is inside the multipolygon
// ring 0 is the exterior boundary
// ring 1, 2, etc. are interior holes
function pointInMultiPolygon(lng: number, lat: number, multiPoly: number[][][][]): boolean {
    for (const poly of multiPoly) {
        if (poly.length === 0) continue;
        if (pointInRing(lng, lat, poly[0])) {
            // if the point is inside the exterior boundary
            let inHole = false;
            for (let h = 1; h < poly.length; h++) {
                if (pointInRing(lng, lat, poly[h])) {
                    // point is inside the interior hole
                    inHole = true;
                    break;
                }
            }
            if (!inHole) return true;
        }
    }
    return false;
}

// to load and index geojson data
export function initializeGeo(): void {
    if (isInitialized) return;

    const currentDir = dirname(fileURLToPath(import.meta.url));
    const geojsonPath = join(currentDir, "geojson", "malaysia.district.geojson");

    try {
        const rawData = readFileSync(geojsonPath, "utf-8");
        const parsed = JSON.parse(rawData);

        indexedDistricts = [];
        districtsByState = {};

        for (const feature of parsed.features as GeoDistrictFeature[]) {
            const { name, code_state, state: stateCode } = feature.properties;
            const stateMeta = MALAYSIA_STATES[stateCode];
            const stateName = stateMeta ? stateMeta.name : stateCode;

            let minLng = Infinity;
            let minLat = Infinity;
            let maxLng = -Infinity;
            let maxLat = -Infinity;
            let sumLng = 0;
            let sumLat = 0;
            let count = 0;

            for (const poly of feature.geometry.coordinates) {
                for (const ring of poly) {
                    for (const [x, y] of ring) {
                        if (x < minLng) minLng = x;
                        if (x > maxLng) maxLng = x;
                        if (y < minLat) minLat = y;
                        if (y > maxLat) maxLat = y;
                        sumLng += x;
                        sumLat += y;
                        count++;
                    }
                }
            }

            const centroid: [number, number] = count > 0 ? [sumLng / count, sumLat / count] : [0, 0];
            const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");

            indexedDistricts.push({
                name,
                slug,
                state_code: stateCode,
                state_name: stateName,
                code_state,
                bbox: [minLng, minLat, maxLng, maxLat],
                centroid,
                geometry: feature.geometry,
            });

            if (!districtsByState[stateCode]) {
                districtsByState[stateCode] = [];
            }
            districtsByState[stateCode].push(name);
        }

        isInitialized = true;
    } catch (err) {
        console.error("Failed to initialize GeoJSON in geolocation module:", err);
        throw err;
    }
}

// init on start
initializeGeo();

/**
 * check if coord is in MY's bounds
 */
export function isWithinMalaysiaBounds(lat: number, lng: number): boolean {
    return (
        lat >= MALAYSIA_BOUNDS.minLat &&
        lat <= MALAYSIA_BOUNDS.maxLat &&
        lng >= MALAYSIA_BOUNDS.minLng &&
        lng <= MALAYSIA_BOUNDS.maxLng
    );
}

/**
 * to find Malaysian districits and state for the lat, lng
 * 
 * performs sub-millisecond pip testing with bbox pre-filtering
 * includes coastal fallback for points within 10-30km of coast
 */
export function findDistrictByCoordinates(lat: number, lng: number): DistrictMatchResult {
    if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
        return {
            found: false,
            message: "Invalid latitude or longitude numbers",
        };
    }

    // reject if outside of bounds (incl buffer)
    if (
        lat < MALAYSIA_BOUNDS.minLat - 0.2 ||
        lat > MALAYSIA_BOUNDS.maxLat + 0.2 ||
        lng < MALAYSIA_BOUNDS.minLng - 0.2 ||
        lng > MALAYSIA_BOUNDS.maxLng + 0.2
    ) {
        return {
            found: false,
            message: "Coordinates are outside Malaysia boundary",
        };
    }

    // direct in polygon match
    for (const item of indexedDistricts) {
        const [minLng, minLat, maxLng, maxLat] = item.bbox;
        if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;

        if (pointInMultiPolygon(lng, lat, item.geometry.coordinates)) {
            return {
                found: true,
                state_code: item.state_code,
                state_name: item.state_name,
                district_name: item.name,
                district_slug: item.slug,
                distance_km: 0,
                is_coastal_fallback: false,
            };
        }
    }

    // fallback for coastal / near-shore (within 10-30km)
    let closestDistrict: IndexedDistrict | null = null;
    let minDistance = Infinity;

    for (const item of indexedDistricts) {
        const [minLng, minLat, maxLng, maxLat] = item.bbox;
        if (
            lng < minLng - 0.15 ||
            lng > maxLng + 0.15 ||
            lat < minLat - 0.15 ||
            lat > maxLat + 0.15
        ) {
            continue;
        }

        const dist = haversineDistanceKm(lat, lng, item.centroid[1], item.centroid[0]);
        if (dist < minDistance) {
            minDistance = dist;
            closestDistrict = item;
        }
    }

    // if closest within 30km
    if (closestDistrict && minDistance <= 30) {
        return {
            found: true,
            state_code: closestDistrict.state_code,
            state_name: closestDistrict.state_name,
            district_name: closestDistrict.name,
            district_slug: closestDistrict.slug,
            distance_km: Math.round(minDistance * 10) / 10,
            is_coastal_fallback: true,
        };
    }

    return {
        found: false,
        message: "No Malaysian district found for given coordinates",
    };
}

/**
 * get all MY districts by state code
 */
export function getDistrictsByState(stateCode: string): string[] {
    const norm = stateCode.toUpperCase();
    return districtsByState[norm] ? [...districtsByState[norm]] : [];
}

/**
 * normalize a district name against the known districts for a state
 */
export function normalizeDistrictName(rawName: string, stateCode?: string): string {
    const clean = rawName.toLowerCase().replace(/[\(\),]/g, "").trim();

    // check explicit alias first
    const alias = DISTRICT_ALIASES[clean];
    if (alias) return alias;

    if (stateCode && districtsByState[stateCode]) {
        const list = districtsByState[stateCode];
        for (const d of list) {
            if (d.toLowerCase() === clean) return d;
        }
        for (const d of list) {
            if (d.toLowerCase().includes(clean) || clean.includes(d.toLowerCase())) {
                return d;
            }
        }
    }

    for (const item of indexedDistricts) {
        if (item.name.toLowerCase() === clean) return item.name;
    }
    for (const item of indexedDistricts) {
        if (item.name.toLowerCase().includes(clean) || clean.includes(item.name.toLowerCase())) {
            return item.name;
        }
    }

    return rawName.trim();
}

/**
 * resolve any name, acroynim, alias to canonical state code
 */
export function resolveStateCode(input: string): string | null {
    const clean = input.toLowerCase().replace(/[\(\),]/g, "").replace(/\s+/g, " ").trim();
    return STATE_ALIAS_MAP[clean] || null;
}

/**
 * return full state name from canonical state code
 */
export function getStateName(stateCode: string): string {
    const meta = MALAYSIA_STATES[stateCode.toUpperCase()];
    return meta ? meta.name : stateCode;
}
