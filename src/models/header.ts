import { t } from "elysia";

export const appType = t.UnionEnum(['headless-app', 'mobile', 'unknown']);

export const AuthHeaderSchema = t.Object({
    appType,
    // signature
    apiKey: t.Optional(t.String()),
});