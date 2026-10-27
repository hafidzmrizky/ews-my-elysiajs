import { t } from "elysia";

export const geoQuery = t.Object({
    lat: t.Numeric({
        minimum: -90,
        maximum: 90,
    }),
    lng: t.Numeric({
        minimum: -180,
        maximum: 180,
    }),
})