import { Elysia, t } from "elysia";
import { findDistrictByCoordinates, getDistrictsByState, MALAYSIA_STATES } from "../modules/geolocation";
import { geoQuery } from "../models/geo";

export const geoRoutes = new Elysia({ prefix: "/geo" });

geoRoutes.get("/location", async ({ query, status }) => {
    const { lat, lng } = query;

    if (isNaN(lat) || isNaN(lng)) {
        return status(400, {
            success: false,
            error: "INVALID_COORDINATES",
            message: "lat and lng query parameters must be valid numbers",
        });
    }

    const match = findDistrictByCoordinates(lat, lng);
    return status(200, {
        success: true,
        data: match,
    });
}, {
    query: geoQuery,
    detail: {
        tags: ["Geographic"],
        summary: "Get Location",
        description: "Identify Malaysian district and state for coordinates using local GeoJSON",
    },
})
geoRoutes.get("/states", async ({ status }) => {
    const states = Object.values(MALAYSIA_STATES).map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        districts: getDistrictsByState(s.code),
    }));

    return status(200, {
        success: true,
        data: states,
    });
}, {
    detail: {
        tags: ["Geographic"],
        summary: "Get States",
        description: "List all Malaysian states and their respective districts",
    },
})