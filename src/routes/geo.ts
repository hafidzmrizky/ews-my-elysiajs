import { Elysia, t } from "elysia";
import { findDistrictByCoordinates, getDistrictsByState, getDistrictDetailsByState, getStateCoordinates, MALAYSIA_STATES } from "../modules/geolocation";
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
geoRoutes.get("/states/:code/coordinates", async ({ params: { code }, status, query }) => {
    const queryDistrict = query.district;

    const state = Object.values(MALAYSIA_STATES).find((s) => s.code === code.toUpperCase());
    if (!state) {
        return status(404, {
            success: false,
            error: "STATE_NOT_FOUND",
            message: `State with code ${code} not found`,
        });
    }

    const districtDetails = getDistrictDetailsByState(state.code);

    if (queryDistrict) {
        const district = districtDetails.find((d) => d.name.toLowerCase() === queryDistrict.toLowerCase());
        if (!district) {
            return status(404, {
                success: false,
                error: "DISTRICT_NOT_FOUND",
                message: `District ${queryDistrict} not found in state ${state.name}`,
            });
        }
        return status(200, {
            success: true,
            state: state.name,
            district: district.name,
            coordinates: district.centroid,
        });
    }

    const coordinates = getStateCoordinates(state.code);
    return status(200, {
        success: true,
        state: state.name,
        district: null,
        coordinates,
    });
}, {
    query: t.Object({
        district: t.Optional(t.String()),
    }),
    detail: {
        tags: ["Geographic"],
        summary: "Get State/District Coordinates",
        description: "Get the epicentrum (centroid) coordinates of a Malaysian state or district by state code",
    },
});