import { Elysia, t } from "elysia";
import {
    getEarthquakes,
    getEarthquakeById,
    syncEarthquakeData,
    SOURCES,
} from "../modules/earthquake_api";
import { identityMacro } from "../macros/auth";
import type { RegionScope } from "../modules/earthquake_api/types";
import { earthQuakeQueryModel } from "../models/earthquake";
import { AuthHeaderSchema } from "../models/header";

export const earthquakeRoutes = new Elysia({ prefix: "/earthquake" }).use(identityMacro);

earthquakeRoutes.get("/", async ({ query, status }) => {
    const { scope, min_magnitude, limit, detail } = query;

    if (min_magnitude && isNaN(min_magnitude)) {
        return status(400, {
            success: false,
            error: "INVALID_MAGNITUDE",
            message: "min_magnitude must be a valid number",
        });
    }

    if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
        return status(400, {
            success: false,
            error: "INVALID_LIMIT",
            message: "limit must be an integer between 1 and 100",
        });
    }

    const result = await getEarthquakes({
        scope,
        min_magnitude,
        limit,
        detail,
    });

    return status(200, {
        success: true,
        scope,
        detail_mode: detail,
        count: result.count,
        last_updated: result.last_updated,
        sources_available: [SOURCES.MET, SOURCES.USGS],
        data: result.data,
    });
},
    {
        query: earthQuakeQueryModel,
        detail: {
            summary: "List Earthquakes",
            description: "Returns earthquakes with filters for scope, magnitude, and detail level.",
            tags: ["Earthquake"],
        },
    }
);
earthquakeRoutes.get("/:id", async ({ params: { id }, status }) => {
    const earthquake = await getEarthquakeById(id);

    if (!earthquake) {
        return status(404, {
            success: false,
            error: "NOT_FOUND",
            message: `Earthquake event '${id}' was not found`,
        });
    }

    return status(200, {
        success: true,
        data: earthquake,
    });
},
    {
        params: t.Object({
            id: t.String(),
        }),
        detail: {
            summary: "Get Earthquake Details",
            description: "Fetches single earthquake event with full seismic parameters, USGS data, ShakeMap visual URL, and MetMalaysia datas.",
            tags: ["Earthquake"],
        },
    }
);
earthquakeRoutes.get("/:id/map.png", async ({ params: { id }, status, set }) => {
    const earthquake = await getEarthquakeById(id);

    if (!earthquake) {
        return status(404, {
            success: false,
            error: "NOT_FOUND",
            message: `Earthquake event '${id}' was not found`,
        });
    }

    const imgUrl = earthquake.visual.map_image_url;
    const res = await fetch(imgUrl);

    if (!res.ok) {
        return status(502, {
            success: false,
            error: "MAP_FETCH_FAILED",
            message: `Failed to fetch map image: HTTP ${res.status}`,
        });
    }

    const contentType = res.headers.get("content-type") || "image/png";
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
        headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400",
        },
    });
},
    {
        params: t.Object({
            id: t.String(),
        }),
        detail: {
            summary: "Get Earthquake Map PNG",
            description: "Directly returns a PNG image depicting the epicentre marker on the map.",
            tags: ["Earthquake"],
        },
    }
);
earthquakeRoutes.post("/sync", async ({ query, status }) => {
    const force = query.force === "true" || query.force === "1";
    const result = await syncEarthquakeData({ force });

    return status(200, {
        success: !result.error,
        data: result,
    });
},
    {
        auth: true,
        query: t.Object({
            force: t.Optional(t.String()),
        }),
        headers: AuthHeaderSchema,
        detail: {
            summary: "Sync Earthquake Data",
            description: "Triggers dual-source sync fetching MetMalaysia warnings and USGS 4.5+ feeds, performing deduplication, SQLite persistence, and Redis indexing.",
            tags: ["Earthquake"],
        },
    }
);