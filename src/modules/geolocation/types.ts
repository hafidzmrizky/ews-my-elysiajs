export interface StateMetadata {
  id: number;
  code: string;
  name: string;
  aliases: string[];
}

export interface RegionDefinition {
  state: string;
  districts: string[];
}

export interface StateInfo {
  state: string; // state code
  state_name: string; // full state name
}

export interface TargetDistrict {
  state: string; // state code
  state_name: string; // full state name
  district: string; // normalized district name
  district_slug: string;
}

export interface DistrictMatchResult {
  found: boolean;
  state_code?: string;
  state_name?: string;
  district_name?: string;
  district_slug?: string;
  distance_km?: number;
  is_coastal_fallback?: boolean;
  message?: string;
}
