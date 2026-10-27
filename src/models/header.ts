import { t } from "elysia";

export const appType = t.UnionEnum(['headless-app', 'mobile', 'unknown']);

export const AuthHeaderSchema = t.Object({
    appType,
    // signature
    api_key: t.Optional(t.String()),
});