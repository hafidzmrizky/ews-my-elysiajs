export interface RawMetMalaysiaEarthquake {
  utcdatetime: string;
  localdatetime: string;
  lat: number;
  lon: number;
  depth: number;
  location: string;
  location_original: string;
  n_distancemas: string;
  n_distancerest: string;
  nbm_distancemas: string;
  nbm_distancerest: string;
  magdefault: number;
  magtypedefault: string;
  status: string;
  visible: boolean;
  lat_vector?: string;
  lon_vector?: string;
}

export interface RawUSGSFeature {
  type: "Feature";
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    tz: number | null;
    url: string;
    detail: string;
    felt: number | null;
    cdi: number | null;
    mmi: number | null;
    alert: string | null;
    status: string;
    tsunami: number;
    sig: number;
    net: string;
    code: string;
    ids: string;
    sources: string;
    types: string;
    nst: number | null;
    dmin: number | null;
    rms: number | null;
    gap: number | null;
    magType: string;
    type: string;
    title: string;
    products?: {
      shakemap?: Array<{
        contents?: Record<string, { url: string; contentType?: string }>;
      }>;
      losspager?: Array<{
        contents?: Record<string, { url: string; contentType?: string }>;
      }>;
      dyfi?: Array<{
        contents?: Record<string, { url: string; contentType?: string }>;
      }>;
    };
  };
  geometry: {
    type: "Point";
    coordinates: [number, number, number]; // [lon, lat, depth] >.<
  };
}

export interface RawUSGSGeoJSON {
  type: "FeatureCollection";
  metadata: {
    generated: number;
    url: string;
    title: string;
    status: number;
    api: string;
    count: number;
  };
  features: RawUSGSFeature[];
  bbox?: number[];
}

// this is based on da ritcher scale
export type MagnitudeCategory =
  | "micro" // < 3.0
  | "minor" // 3.0 - 3.9
  | "light" // 4.0 - 4.9
  | "moderate" // 5.0 - 5.9
  | "strong" // 6.0 - 6.9
  | "major" // 7.0 - 7.9
  | "great"; // >= 8.0

export type RegionScope = "malaysia" | "regional" | "global";

export interface EarthquakeSourceRef {
  name: "MetMalaysia" | "USGS";
  title: string;
  url: string;
}

export interface StandardizedEarthquake {
  id: string;
  title: string;
  magnitude: {
    value: number;
    type: string;
    category: MagnitudeCategory;
  };
  coordinates: {
    latitude: number;
    longitude: number;
    depth_km: number;
  };
  location: {
    place: string;
    country?: string;
    region_scope: RegionScope;
  };
  malaysia_context: {
    is_relevant_to_malaysia: boolean;
    distance_km: number;
    direction?: string;
    nearest_reference_point: string;
  };
  timing: {
    utc: string;
    local_my: string;
    timestamp_ms: number;
    time_ago: string;
  };
  tsunami_alert: boolean;
  status: string;
  visual: {
    map_image_url: string;
    interactive_map_url: string;
  };
  sources: EarthquakeSourceRef[];
}

export interface DetailedEarthquake extends StandardizedEarthquake {
  usgs_data?: {
    event_page_url?: string;
    interactive_map_url?: string;
    visual_map_image_url?: string;
    metrics: {
      felt_reports?: number | null;
      cdi?: number | null;
      mmi?: number | null;
      alert_color?: string | null;
      significance?: number | null;
      rms?: number | null;
      gap?: number | null;
      nst?: number | null;
    };
  };
  metmalaysia_data?: {
    distance_mas_bm?: string;
    distance_mas_en?: string;
    distance_rest_bm?: string;
    distance_rest_en?: string;
    lat_vector?: string;
    lon_vector?: string;
    status_bm?: string;
    visible?: boolean;
  };
  provider_ids: {
    usgs_id?: string;
    metmy_id?: string;
  };
}

export interface EarthquakeFilterOptions {
  scope?: RegionScope | "all";
  min_magnitude?: number;
  limit?: number;
  detail?: boolean;
}

export interface EarthquakeSyncResult {
  updated: boolean;
  metmy_count: number;
  usgs_count: number;
  merged_count: number;
  total_events: number;
  error?: string;
}
