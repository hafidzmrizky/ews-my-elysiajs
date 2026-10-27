import client from "../redis";
import { REDIS_EARTHQUAKE_KEYS } from "./constants";
import { fetchMetMalaysiaEarthquakes } from "./metmy";
import { fetchUSGSEarthquakes, fetchUSGSEventDetail, normalizeUSGSEarthquake } from "./usgs";
import { deduplicateAndMerge } from "./merger";
import {
    upsertEarthquake,
    getEarthquakeById as getFromDb,
    queryEarthquakesFromDb,
} from "./db";
import type {
    DetailedEarthquake,
    StandardizedEarthquake,
    EarthquakeFilterOptions,
    EarthquakeSyncResult,
} from "./types";

export * from "./constants";
export * from "./types";
export * from "./helpers";
export * from "./db";
export * from "./merger";
export * from "./metmy";
export * from "./usgs";

/**
 * sync earthquake data from MET and USGS to sqlite and redis :D
 * Bun.hash to check hash, if not changed then skip (to save the comparing ahh trip or writing)
 */
export async function syncEarthquakeData(options?: {
    force?: boolean;
}): Promise<EarthquakeSyncResult> {
    try {
        const [metRes, usgsRes] = await Promise.all([
            fetchMetMalaysiaEarthquakes(),
            fetchUSGSEarthquakes(),
        ]);

        if (metRes.error && usgsRes.error) {
            return {
                updated: false,
                metmy_count: 0,
                usgs_count: 0,
                merged_count: 0,
                total_events: 0,
                error: `Both providers failed. MetMY: ${metRes.error}, USGS: ${usgsRes.error}`,
            };
        }

        // calc the hash, so this only takes some of the data to create the signature :D
        const metSignature = metRes.data
            .map((e) => `${e.id}:${e.magnitude.value}:${e.status}`)
            .join("|");
        const usgsSignature = usgsRes.data
            .map((e) => `${e.id}:${e.timing.timestamp_ms}:${e.magnitude.value}:${e.status}`)
            .join("|");

        const metHash = metSignature ? String(Bun.hash(metSignature)) : "";
        const usgsHash = usgsSignature ? String(Bun.hash(usgsSignature)) : "";

        const [cachedMetHash, cachedUsgsHash] = await Promise.all([
            client.get(REDIS_EARTHQUAKE_KEYS.BODY_HASH_METMY),
            client.get(REDIS_EARTHQUAKE_KEYS.BODY_HASH_USGS),
        ]);

        const isMetChanged = options?.force || metHash !== cachedMetHash;
        const isUsgsChanged = options?.force || usgsHash !== cachedUsgsHash;

        if (!isMetChanged && !isUsgsChanged) {
            return {
                updated: false,
                metmy_count: metRes.data.length,
                usgs_count: usgsRes.data.length,
                merged_count: 0,
                total_events: metRes.data.length + usgsRes.data.length,
            };
        }

        const { merged, matchedCount } = deduplicateAndMerge(metRes.data, usgsRes.data);
        for (const eq of merged) {
            upsertEarthquake(eq);
        }

        // store into the redis >.<
        const standardizedList: StandardizedEarthquake[] = merged.map((eq) => ({
            id: eq.id,
            title: eq.title,
            magnitude: eq.magnitude,
            coordinates: eq.coordinates,
            location: eq.location,
            malaysia_context: eq.malaysia_context,
            timing: eq.timing,
            tsunami_alert: eq.tsunami_alert,
            status: eq.status,
            visual: eq.visual,
            sources: eq.sources,
        }));

        const nowIso = new Date().toISOString();

        await Promise.all([
            client.set(REDIS_EARTHQUAKE_KEYS.LAST_UPDATE, nowIso),
            metHash ? client.set(REDIS_EARTHQUAKE_KEYS.BODY_HASH_METMY, metHash) : Promise.resolve(),
            usgsHash ? client.set(REDIS_EARTHQUAKE_KEYS.BODY_HASH_USGS, usgsHash) : Promise.resolve(),
            client.set(REDIS_EARTHQUAKE_KEYS.EVENTS_ALL, JSON.stringify(standardizedList), { EX: 86400 }),
            client.set(
                REDIS_EARTHQUAKE_KEYS.EVENTS_MALAYSIA,
                JSON.stringify(standardizedList.filter((e) => e.location.region_scope === "malaysia")),
                { EX: 86400 }
            ),
            client.set(
                REDIS_EARTHQUAKE_KEYS.EVENTS_REGIONAL,
                JSON.stringify(standardizedList.filter((e) => e.location.region_scope === "regional")),
                { EX: 86400 }
            ),
            client.set(
                REDIS_EARTHQUAKE_KEYS.EVENTS_GLOBAL,
                JSON.stringify(standardizedList.filter((e) => e.location.region_scope === "global")),
                { EX: 86400 }
            ),
        ]);

        return {
            updated: true,
            metmy_count: metRes.data.length,
            usgs_count: usgsRes.data.length,
            merged_count: matchedCount,
            total_events: merged.length,
        };
    } catch (err) {
        return {
            updated: false,
            metmy_count: 0,
            usgs_count: 0,
            merged_count: 0,
            total_events: 0,
            error: `Earthquake sync error: ${String(err)}`,
        };
    }
}

/**
 * to retrieve the earthquake data either from redis (cache) or sqlite
 */
export async function getEarthquakes(
    options: EarthquakeFilterOptions = {}
): Promise<{
    success: boolean;
    count: number;
    data: (StandardizedEarthquake | DetailedEarthquake)[];
    last_updated?: string | null;
}> {
    const { scope = "all", min_magnitude = 0, limit = 20, detail = false } = options;

    const lastUpdate = await client.get(REDIS_EARTHQUAKE_KEYS.LAST_UPDATE);

    if (detail || min_magnitude > 0) {
        const results = queryEarthquakesFromDb(options);
        return {
            success: true,
            count: results.length,
            data: results,
            last_updated: lastUpdate,
        };
    }

    let redisKey: string = REDIS_EARTHQUAKE_KEYS.EVENTS_ALL;
    if (scope === "malaysia") redisKey = REDIS_EARTHQUAKE_KEYS.EVENTS_MALAYSIA;
    else if (scope === "regional") redisKey = REDIS_EARTHQUAKE_KEYS.EVENTS_REGIONAL;
    else if (scope === "global") redisKey = REDIS_EARTHQUAKE_KEYS.EVENTS_GLOBAL;

    const cachedStr = await client.get(redisKey);
    if (cachedStr) {
        try {
            const list: StandardizedEarthquake[] = JSON.parse(cachedStr);
            return {
                success: true,
                count: Math.min(list.length, limit),
                data: list.slice(0, limit),
                last_updated: lastUpdate,
            };
        } catch {
            // ignore and go direct to sqlite (to retrieve >.<)
        }
    }

    const dbResults = queryEarthquakesFromDb(options);
    return {
        success: true,
        count: dbResults.length,
        data: dbResults,
        last_updated: lastUpdate,
    };
}

/**
 * get by earthquake id (usgs only >.<)
 */
export async function getEarthquakeById(
    id: string
): Promise<DetailedEarthquake | null> {
    const localEvent = getFromDb(id);
    if (localEvent) return localEvent;

    if (id.startsWith("us") || id.length >= 8) {
        const rawDetail = await fetchUSGSEventDetail(id);
        if (rawDetail) {
            const normalized = normalizeUSGSEarthquake(rawDetail);
            upsertEarthquake(normalized);
            return normalized;
        }
    }

    return null;
}