import { Elysia, t } from "elysia";
import {
    getAdvisoriesForCoordinates,
    getAdvisoriesForDistrict,
    getAllActiveAdvisories,
    syncWeatherAdvisories,
    syncWeatherForecast,
    syncAirQuality,
    getAllAirQualityStations,
    getAirQualityForCoordinates,
    getAirQualityByState,
    getAllForecasts,
    getForecastForCoordinates,
    getForecastForDistrict,
    getForecastsByState,
    getWeatherOverview,
    SOURCES,
} from "../modules/weather_api";
import { identityMacro } from "../macros/auth";
import { AuthHeaderSchema } from "../models/header";
import { airQualityQuery, fullRangeQuery } from "../models/weather";

export const weatherRoutes = new Elysia({ prefix: "/weather" }).use(identityMacro);

weatherRoutes.get("/overview", async ({ query, status }) => {
    if ((query.lat !== undefined && isNaN(query.lat)) || (query.lng !== undefined && isNaN(query.lng))) {
        return status(400, {
            success: false,
            error: "INVALID_COORDINATES",
            message: "lat and lng query parameters must be valid numbers",
        });
    }

    const result = await getWeatherOverview({
        lat: query.lat,
        lng: query.lng,
        state: query.state,
        district: query.district,
    });

    return status(200, {
        success: true,
        data: result,
    });
},
    {
        query: fullRangeQuery,
        detail: {
            tags: ["Weather"],
            summary: "Get Combined Weather Overview",
            description: "Active weather advisories, nearest air quality station, and 7-day forecast",
        },
    }
);
weatherRoutes.get("/air-quality", async ({ query, status }) => {
    if (query.lat !== undefined && query.lng !== undefined) {
        if (isNaN(query.lat) || isNaN(query.lng)) {
            return status(400, {
                success: false,
                error: "INVALID_COORDINATES",
                message: "lat and lng query parameters must be valid numbers",
            });
        }

        const result = await getAirQualityForCoordinates(query.lat, query.lng);
        return status(200, {
            success: true,
            data: result,
        });
    }

    if (query.state) {
        const result = await getAirQualityByState(query.state);
        return status(200, {
            success: true,
            data: result,
        });
    }

    const stations = await getAllAirQualityStations();
    return status(200, {
        success: true,
        data: {
            total_stations: stations.length,
            stations,
            source: SOURCES.DOE,
        },
    });
},
    {
        query: airQualityQuery,
        detail: {
            tags: ["Weather"],
            summary: "Get Air Quality Data",
            description: "Nearest station by coordinates, by state, or all stations!",
        },
    }
);
weatherRoutes.get("/forecast", async ({ query, status }) => {
    if (query.lat !== undefined && query.lng !== undefined) {
        if (isNaN(query.lat) || isNaN(query.lng)) {
            return status(400, {
                success: false,
                error: "INVALID_COORDINATES",
                message: "lat and lng query parameters must be valid numbers",
            });
        }

        const result = await getForecastForCoordinates(query.lat, query.lng);
        return status(200, {
            success: true,
            data: result,
        });
    }

    if (query.district) {
        const forecast = await getForecastForDistrict(query.district, query.state);
        return status(200, {
            success: true,
            data: {
                district: query.district,
                forecast,
                source: SOURCES.MET,
            },
        });
    }

    if (query.state) {
        const forecasts = await getForecastsByState(query.state);
        return status(200, {
            success: true,
            data: {
                state: query.state,
                total_locations: forecasts.length,
                forecasts,
                source: SOURCES.MET,
            },
        });
    }

    const all = await getAllForecasts();
    return status(200, {
        success: true,
        data: {
            total_locations: all.length,
            forecasts: all,
            source: SOURCES.MET,
        },
    });
},
    {
        query: fullRangeQuery,
        detail: {
            tags: ["Weather"],
            summary: "Get 7-Day Weather Forecast",
            description: "7-day weather forecast from MET Malaysia (by coordinates, district, state, or nationwide!!)",
        },
    }
);
weatherRoutes.get("/advisories", async ({ query, status }) => {
    if (query.lat !== undefined && query.lng !== undefined) {
        const { lat, lng } = query;

        if (isNaN(lat) || isNaN(lng)) {
            return status(400, {
                success: false,
                error: "INVALID_COORDINATES",
                message: "lat and lng query parameters must be valid numbers",
            });
        }

        const result = await getAdvisoriesForCoordinates(lat, lng);
        return status(200, {
            success: true,
            data: {
                ...result,
                advisories: result.advisories.map((advisory) => ({
                    ...advisory,
                    source: SOURCES.MET,
                })),
            },
        });
    }

    if (query.state) {
        const advisories = await getAdvisoriesForDistrict(query.state, query.district);
        return status(200, {
            success: true,
            data: {
                state: query.state,
                district: query.district || null,
                advisories: advisories.map((advisory) => ({
                    ...advisory,
                    source: SOURCES.MET,
                })),
                total_advisories: advisories.length,
            },
        });
    }

    const all = await getAllActiveAdvisories();
    return status(200, {
        success: true,
        data: {
            advisories: all.map((advisory) => ({
                ...advisory,
                source: SOURCES.MET,
            })),
            total_advisories: all.length,
        },
    });
},
    {
        query: fullRangeQuery,
        detail: {
            tags: ["Weather"],
            summary: "Get Weather Advisories",
            description: "Weather advisories by coordinates (lat, lng), state/district, or all active",
        },
    }
);

/**
 * Auth Required
 */
weatherRoutes.post("/sync", async ({ status }) => {
    const [advisories, forecast, airQuality] = await Promise.all([
        syncWeatherAdvisories({ force: true }),
        syncWeatherForecast({ force: true }),
        syncAirQuality({ force: true }),
    ]);

    return status(200, {
        success: true,
        data: {
            advisories,
            forecast,
            air_quality: airQuality,
        },
    });
},
    {
        auth: true,
        headers: AuthHeaderSchema,
        detail: {
            tags: ["Weather"],
            summary: "Sync Weather Data",
            description: "Sync weather advisory, forecast, and air quality from MET Malaysia and DOE",
        },
    }
);