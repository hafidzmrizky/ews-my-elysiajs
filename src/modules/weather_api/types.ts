import type {
  StateInfo,
  TargetDistrict,
  DistrictMatchResult,
} from "../geolocation";
import type { SourceAttribution } from "./constants";

export type { StateInfo, TargetDistrict, DistrictMatchResult, SourceAttribution };

export interface TranslatedText {
  bm: string;
  en: string;
}

export interface WarningIssue {
  issued?: string | null;
  title_bm?: string | null;
  title_en?: string | null;
}

export interface RawWeatherWarning {
  warning_issue?: WarningIssue | null;
  valid_from?: string | null;
  valid_to?: string | null;
  heading_en?: string | null;
  heading_bm?: string | null;
  text_en?: string | null;
  text_bm?: string | null;
  instruction_en?: string | null;
  instruction_bm?: string | null;
}

export interface ParsedAdvisory {
  id: string;
  title_bm: string;
  title_en: string;
  heading_bm: string;
  heading_en: string;
  issued: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  type: "land" | "marine" | "general";
  whole_states: StateInfo[];
  districts: TargetDistrict[];
  marine_states: StateInfo[];
  text_bm: string;
  text_en: string;
  instruction_bm?: string | null;
  instruction_en?: string | null;
  source?: SourceAttribution;
}

export interface LocationAdvisoriesResult {
  location: DistrictMatchResult;
  advisories: ParsedAdvisory[];
  total_advisories: number;
}

// air quality
export interface RawDoeStation {
  ID: number;
  STATE_ID: number;
  STATE_NAME: string;
  STATION_STATUS: number;
  STATION_ID: string;
  STATION_LOCATION: string;
  LONGITUDE: number;
  LATITUDE: number;
  API: number;
  PARAM_SYMBOL: string;
  CLASS: string;
  RECORD_DT: string;
}

export interface AirQualityStation {
  id: string;
  location_name: string;
  full_location: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  state: {
    id: number;
    code: string;
    name: string;
  };
  api: number;
  class: string;
  class_bm: string;
  primary_pollutant: string;
  recorded_at: string;
  distance_km?: number;
}

export interface AirQualityLocationResult {
  location?: DistrictMatchResult;
  nearest_station: AirQualityStation | null;
  state_stations: AirQualityStation[];
  source: SourceAttribution;
}

export interface AirQualityStateResult {
  state: {
    code: string;
    name: string;
  };
  average_api: number;
  highest_station: AirQualityStation | null;
  stations: AirQualityStation[];
  source: SourceAttribution;
}

// weather forecast
export interface RawForecastRecord {
  location?: {
    location_id?: string;
    location_name?: string;
  };
  date?: string;
  morning_forecast?: string;
  afternoon_forecast?: string;
  night_forecast?: string;
  summary_forecast?: string;
  summary_when?: string;
  min_temp?: number;
  max_temp?: number;
}

export interface DailyForecast {
  date: string;
  day_en: string;
  day_bm: string;
  is_today: boolean;
  morning_forecast: TranslatedText;
  afternoon_forecast: TranslatedText;
  night_forecast: TranslatedText;
  summary_forecast: TranslatedText;
  summary_when: TranslatedText;
  temperature: {
    min: number;
    max: number;
    unit: string;
  };
}

export interface DistrictForecast {
  location_id: string;
  location_name: string;
  location_slug: string;
  location_category: string; // "District" | "State" | "Town" | "Division" | "Recreation Centre" 
  state: {
    code: string;
    name: string;
  };
  forecasts: DailyForecast[];
  source: SourceAttribution;
}

// overview
export interface WeatherOverviewResult {
  location: DistrictMatchResult;
  air_quality: {
    nearest_station: AirQualityStation | null;
    source: SourceAttribution;
  };
  forecast: {
    location_name: string;
    location_category: string;
    seven_days: DailyForecast[];
    source: SourceAttribution;
  } | null;
  advisories: {
    total: number;
    items: ParsedAdvisory[];
    source: SourceAttribution;
  };
}
