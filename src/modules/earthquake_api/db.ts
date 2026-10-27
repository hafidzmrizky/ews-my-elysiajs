import { Database } from "bun:sqlite";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import type {
  DetailedEarthquake,
  StandardizedEarthquake,
  EarthquakeFilterOptions,
} from "./types";

const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = join(DATA_DIR, "earthquake.sqlite");
const db = new Database(DB_PATH);

// to initiate database schema >.<!!!
db.run(`
  CREATE TABLE IF NOT EXISTS earthquakes (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    magnitude REAL NOT NULL,
    mag_type TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    depth_km REAL NOT NULL,
    place TEXT NOT NULL,
    country TEXT,
    region_scope TEXT NOT NULL,
    distance_km REAL,
    direction TEXT,
    nearest_landmark TEXT,
    tsunami_alert INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    event_time INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    standardized_json TEXT NOT NULL,
    detail_json TEXT
  );
`);

db.run(`CREATE INDEX IF NOT EXISTS idx_eq_event_time ON earthquakes(event_time DESC);`);
db.run(`CREATE INDEX IF NOT EXISTS idx_eq_region ON earthquakes(region_scope);`);
db.run(`CREATE INDEX IF NOT EXISTS idx_eq_mag ON earthquakes(magnitude DESC);`);

const upsertStmt = db.prepare(`
  INSERT INTO earthquakes (
    id, source, title, magnitude, mag_type, latitude, longitude, depth_km,
    place, country, region_scope, distance_km, direction, nearest_landmark,
    tsunami_alert, status, event_time, updated_at, standardized_json, detail_json
  ) VALUES (
    $id, $source, $title, $magnitude, $mag_type, $latitude, $longitude, $depth_km,
    $place, $country, $region_scope, $distance_km, $direction, $nearest_landmark,
    $tsunami_alert, $status, $event_time, $updated_at, $standardized_json, $detail_json
  )
  ON CONFLICT(id) DO UPDATE SET
    source = excluded.source,
    title = excluded.title,
    magnitude = excluded.magnitude,
    mag_type = excluded.mag_type,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    depth_km = excluded.depth_km,
    place = excluded.place,
    country = excluded.country,
    region_scope = excluded.region_scope,
    distance_km = excluded.distance_km,
    direction = excluded.direction,
    nearest_landmark = excluded.nearest_landmark,
    tsunami_alert = excluded.tsunami_alert,
    status = excluded.status,
    event_time = excluded.event_time,
    updated_at = excluded.updated_at,
    standardized_json = excluded.standardized_json,
    detail_json = COALESCE(excluded.detail_json, earthquakes.detail_json);
`);

export function upsertEarthquake(event: DetailedEarthquake): void {
  const sourcesStr = event.sources.map((s) => s.name).join(",");
  const now = Date.now();

  const stdCopy: StandardizedEarthquake = {
    id: event.id,
    title: event.title,
    magnitude: event.magnitude,
    coordinates: event.coordinates,
    location: event.location,
    malaysia_context: event.malaysia_context,
    timing: event.timing,
    tsunami_alert: event.tsunami_alert,
    status: event.status,
    visual: event.visual,
    sources: event.sources,
  };

  upsertStmt.run({
    $id: event.id,
    $source: sourcesStr,
    $title: event.title,
    $magnitude: event.magnitude.value,
    $mag_type: event.magnitude.type,
    $latitude: event.coordinates.latitude,
    $longitude: event.coordinates.longitude,
    $depth_km: event.coordinates.depth_km,
    $place: event.location.place,
    $country: event.location.country ?? null,
    $region_scope: event.location.region_scope,
    $distance_km: event.malaysia_context.distance_km,
    $direction: event.malaysia_context.direction ?? null,
    $nearest_landmark: event.malaysia_context.nearest_reference_point,
    $tsunami_alert: event.tsunami_alert ? 1 : 0,
    $status: event.status,
    $event_time: event.timing.timestamp_ms,
    $updated_at: now,
    $standardized_json: JSON.stringify(stdCopy),
    $detail_json: JSON.stringify(event),
  });
}

export function getEarthquakeById(id: string): DetailedEarthquake | null {
  const row = db
    .prepare("SELECT detail_json, standardized_json FROM earthquakes WHERE id = ? LIMIT 1")
    .get(id) as { detail_json: string | null; standardized_json: string } | undefined;

  if (!row) return null;
  if (row.detail_json) {
    try {
      return JSON.parse(row.detail_json) as DetailedEarthquake;
    } catch {
      // fall thru >.<!!!
    }
  }
  return JSON.parse(row.standardized_json) as DetailedEarthquake;
}

export function queryEarthquakesFromDb(
  options: EarthquakeFilterOptions = {}
): (StandardizedEarthquake | DetailedEarthquake)[] {
  const { scope = "all", min_magnitude = 0, limit = 20, detail = false } = options;

  let sql = `SELECT ${detail ? "detail_json, standardized_json" : "standardized_json"} FROM earthquakes WHERE 1=1`;
  const params: (string | number)[] = [];

  if (scope && scope !== "all") {
    sql += ` AND region_scope = ?`;
    params.push(scope);
  }

  if (min_magnitude && min_magnitude > 0) {
    sql += ` AND magnitude >= ?`;
    params.push(min_magnitude);
  }

  sql += ` ORDER BY event_time DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as Array<{
    detail_json?: string | null;
    standardized_json: string;
  }>;

  return rows.map((r) => {
    if (detail && r.detail_json) {
      try {
        return JSON.parse(r.detail_json);
      } catch {
        return JSON.parse(r.standardized_json);
      }
    }
    return JSON.parse(r.standardized_json);
  });
}

export default db;
