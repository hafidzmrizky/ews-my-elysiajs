import {
  findDistrictByCoordinates,
  resolveStateCode,
  getStateName,
  normalizeDistrictName,
} from "../geolocation";
import { SOURCES } from "./constants";
import { getAdvisoriesForCoordinates, getAdvisoriesForDistrict } from "./sync";
import { getAirQualityForCoordinates, getAirQualityByState } from "./air_quality";
import { getForecastForCoordinates, getForecastForDistrict } from "./forecast";
import type { WeatherOverviewResult, DistrictMatchResult } from "./types";

export interface OverviewParams {
  lat?: number;
  lng?: number;
  state?: string;
  district?: string;
}

/**
 * consolidated weather overview (advisories, air quality, 7 day forecast) based on coord/state/district
 */
export async function getWeatherOverview(params: OverviewParams): Promise<WeatherOverviewResult> {
  const { lat, lng, state, district } = params;

  let location: DistrictMatchResult = {
    found: false,
    message: "No location specified",
  };

  // if coordinate is given
  if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
    location = findDistrictByCoordinates(lat, lng);

    const [advisoriesResult, airResult, forecastResult] = await Promise.all([
      getAdvisoriesForCoordinates(lat, lng),
      getAirQualityForCoordinates(lat, lng),
      getForecastForCoordinates(lat, lng),
    ]);

    const activeAdvisories = advisoriesResult.advisories.map((a) => ({
      ...a,
      source: SOURCES.MET,
    }));

    return {
      location,
      air_quality: {
        nearest_station: airResult.nearest_station,
        source: SOURCES.DOE,
      },
      forecast: forecastResult.forecast
        ? {
          location_name: forecastResult.forecast.location_name,
          location_category: forecastResult.forecast.location_category,
          seven_days: forecastResult.forecast.forecasts,
          source: SOURCES.MET,
        }
        : null,
      advisories: {
        total: activeAdvisories.length,
        items: activeAdvisories,
        source: SOURCES.MET,
      },
    };
  }

  // if state is given
  if (state) {
    const stateCode = resolveStateCode(state) || state.toUpperCase();
    const stateName = getStateName(stateCode);
    const targetDistrict = district ? normalizeDistrictName(district, stateCode) : undefined;

    location = {
      found: true,
      state_code: stateCode,
      state_name: stateName,
      district_name: targetDistrict,
      district_slug: targetDistrict
        ? targetDistrict.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-")
        : undefined,
    };

    const [advisories, airState, forecast] = await Promise.all([
      getAdvisoriesForDistrict(stateCode, targetDistrict),
      getAirQualityByState(stateCode),
      targetDistrict
        ? getForecastForDistrict(targetDistrict, stateCode)
        : getForecastForDistrict(stateName, stateCode),
    ]);

    const activeAdvisories = advisories.map((a) => ({
      ...a,
      source: SOURCES.MET,
    }));

    return {
      location,
      air_quality: {
        nearest_station: airState.highest_station || airState.stations[0] || null,
        source: SOURCES.DOE,
      },
      forecast: forecast
        ? {
          location_name: forecast.location_name,
          location_category: forecast.location_category,
          seven_days: forecast.forecasts,
          source: SOURCES.MET,
        }
        : null,
      advisories: {
        total: activeAdvisories.length,
        items: activeAdvisories,
        source: SOURCES.MET,
      },
    };
  }

  return {
    location,
    air_quality: {
      nearest_station: null,
      source: SOURCES.DOE,
    },
    forecast: null,
    advisories: {
      total: 0,
      items: [],
      source: SOURCES.MET,
    },
  };
}
