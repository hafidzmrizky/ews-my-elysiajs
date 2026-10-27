import { t } from "elysia";

export const fullRangeQuery = t.Object({
    lat: t.Optional(t.Numeric({
        minimum: -90,
        maximum: 90,
    })),
    lng: t.Optional(t.Numeric({
        minimum: -180,
        maximum: 180,
    })),
    state: t.Optional(t.String({ min: 2 })),
    district: t.Optional(t.String({ min: 2 }))
});

export const airQualityQuery = t.Object({
    lat: t.Optional(t.Numeric({
        minimum: -90,
        maximum: 90,
    })),
    lng: t.Optional(t.Numeric({
        minimum: -180,
        maximum: 180,
    })),
    state: t.Optional(t.String({ min: 2 })),
})