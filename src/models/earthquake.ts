import { t } from "elysia";

const scope = t.Union([t.Literal("all"), t.Literal("malaysia"), t.Literal("regional"), t.Literal("global")]);

export const earthQuakeQueryModel = t.Object({
    scope,
    min_magnitude: t.Optional(t.Numeric({
        minimum: 0,
        maximum: 10,
    })),
    limit: t.Optional(t.Numeric({
        minimum: 1,
        maximum: 100,
    })),
    detail: t.Optional(t.Boolean()),
});