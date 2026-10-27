import client from "../redis";
import {
  MET_WEATHER_WARNING_URL,
  REDIS_KEYS,
} from "./constants";
import { findDistrictByCoordinates, resolveStateCode, normalizeDistrictName } from "../geolocation";
import { parseWeatherWarnings } from "./parser";
import type {
  ParsedAdvisory,
  LocationAdvisoriesResult,
  RawWeatherWarning,
} from "./types";

export interface SyncResult {
  updated: boolean;
  count: number;
  hash: string;
  reason?: string;
  error?: string;
}

/**
 * fetches latest weather adv from MET and update into redis cache
 * it uses Bun.hash to hash and compare w stored one to det theres update or nah
 */
export async function syncWeatherAdvisories(options?: { force?: boolean }): Promise<SyncResult> {
  try {
    const url = MET_WEATHER_WARNING_URL.endsWith("/")
      ? MET_WEATHER_WARNING_URL
      : `${MET_WEATHER_WARNING_URL}/`;

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

    // compare with redis cache
    if (!options?.force) {
      const storedHash = await client.get(REDIS_KEYS.WEATHER_ADVISORY_BODY_HASH);
      if (storedHash && storedHash === currentHash) {
        // update last update timestamp
        await client.set(REDIS_KEYS.WEATHER_ADVISORY_LAST_UPDATE, new Date().toISOString());
        return {
          updated: false,
          count: 0,
          hash: currentHash,
          reason: "cache_hit_unchanged",
        };
      }
    }

    const rawWarnings = JSON.parse(rawText) as RawWeatherWarning[];
    const parsedAdvisories = parseWeatherWarnings(rawWarnings);

    const activeAdvisories = parsedAdvisories.filter((a) => a.is_active);

    const prevIndexKeys = await client.sMembers(REDIS_KEYS.ALL_INDEXED_KEYS_SET);

    const multi = client.multi();

    // delete all previous indexed sets and active set
    if (prevIndexKeys.length > 0) {
      multi.del(prevIndexKeys);
    }
    multi.del(REDIS_KEYS.ACTIVE_ADVISORIES_SET);
    multi.del(REDIS_KEYS.ALL_INDEXED_KEYS_SET);

    const newIndexKeys = new Set<string>();

    for (const adv of activeAdvisories) {
      const advKey = `${REDIS_KEYS.ADVISORY_PREFIX}${adv.id}`;
      // store advisory data (expire after 48h to prevent stale leftovers)
      multi.set(advKey, JSON.stringify(adv), { EX: 60 * 60 * 48 });
      multi.sAdd(REDIS_KEYS.ACTIVE_ADVISORIES_SET, adv.id);

      for (const st of adv.whole_states) {
        const stateCode = typeof st === "string" ? st : st.state;
        const stateSetKey = `${REDIS_KEYS.STATE_SET_PREFIX}${stateCode}`;
        multi.sAdd(stateSetKey, adv.id);
        newIndexKeys.add(stateSetKey);
      }

      for (const dist of adv.districts) {
        const distSetKey = `${REDIS_KEYS.DISTRICT_SET_PREFIX}${dist.state}:${dist.district_slug}`;
        multi.sAdd(distSetKey, adv.id);
        newIndexKeys.add(distSetKey);
      }

      for (const st of adv.marine_states) {
        const stateCode = typeof st === "string" ? st : st.state;
        const marineSetKey = `${REDIS_KEYS.MARINE_SET_PREFIX}${stateCode}`;
        multi.sAdd(marineSetKey, adv.id);
        newIndexKeys.add(marineSetKey);
      }
    }

    if (newIndexKeys.size > 0) {
      multi.sAdd(REDIS_KEYS.ALL_INDEXED_KEYS_SET, Array.from(newIndexKeys));
    }

    multi.set(REDIS_KEYS.WEATHER_ADVISORY_BODY_HASH, currentHash);
    multi.set(REDIS_KEYS.WEATHER_ADVISORY_LAST_UPDATE, new Date().toISOString());

    await multi.exec();

    return {
      updated: true,
      count: activeAdvisories.length,
      hash: currentHash,
    };
  } catch (err: any) {
    console.error("Error syncing weather advisories:", err);
    return {
      updated: false,
      count: 0,
      hash: "",
      error: err?.message || String(err),
    };
  }
}

/**
 * get advisory by id
 */
async function fetchAdvisoriesByIds(ids: string[]): Promise<ParsedAdvisory[]> {
  if (!ids || ids.length === 0) return [];

  const keys = ids.map((id) => `${REDIS_KEYS.ADVISORY_PREFIX}${id}`);
  const records = await client.mGet(keys);

  const results: ParsedAdvisory[] = [];
  for (const raw of records) {
    if (raw) {
      try {
        results.push(JSON.parse(raw));
      } catch {
        // some corrupted / broken ones
      }
    }
  }

  return results;
}

/**
 * get advisories based on lat, lng
 */
export async function getAdvisoriesForCoordinates(
  lat: number,
  lng: number
): Promise<LocationAdvisoriesResult> {
  const loc = findDistrictByCoordinates(lat, lng);

  if (!loc.found || !loc.state_code || !loc.district_slug) {
    return {
      location: loc,
      advisories: [],
      total_advisories: 0,
    };
  }

  const stateSetKey = `${REDIS_KEYS.STATE_SET_PREFIX}${loc.state_code}`;
  const districtSetKey = `${REDIS_KEYS.DISTRICT_SET_PREFIX}${loc.state_code}:${loc.district_slug}`;

  // state + district
  const matchingIds = await client.sUnion([stateSetKey, districtSetKey]);
  const advisories = await fetchAdvisoriesByIds(matchingIds);

  return {
    location: loc,
    advisories,
    total_advisories: advisories.length,
  };
}

/**
 * retrieve weather advisories for a district or state
 */
export async function getAdvisoriesForDistrict(
  stateNameOrCode: string,
  districtName?: string
): Promise<ParsedAdvisory[]> {
  const stateCode = resolveStateCode(stateNameOrCode);
  if (!stateCode) return [];

  const stateSetKey = `${REDIS_KEYS.STATE_SET_PREFIX}${stateCode}`;

  if (!districtName) {
    // to whole state
    const ids = await client.sMembers(stateSetKey);
    return fetchAdvisoriesByIds(ids);
  }

  const canonicalDistrict = normalizeDistrictName(districtName, stateCode);
  const districtSlug = canonicalDistrict.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const districtSetKey = `${REDIS_KEYS.DISTRICT_SET_PREFIX}${stateCode}:${districtSlug}`;

  const matchingIds = await client.sUnion([stateSetKey, districtSetKey]);
  return fetchAdvisoriesByIds(matchingIds);
}

/**
 * get all active advisories!!!
 */
export async function getAllActiveAdvisories(): Promise<ParsedAdvisory[]> {
  const activeIds = await client.sMembers(REDIS_KEYS.ACTIVE_ADVISORIES_SET);
  return fetchAdvisoriesByIds(activeIds);
}
