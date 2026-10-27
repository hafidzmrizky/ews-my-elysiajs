import { Elysia } from "elysia";
import { getIPFromHeaders } from "../modules/ip";
import { AuthHeaderSchema } from "../models/header";

export const identityMacro = new Elysia()
    .state("ip", "")
    .onBeforeHandle(async ({ request, store: { ip }, set }) => {
        ip = await getIPFromHeaders(request.headers) ?? "";
    })
    .macro({
        auth: {
            schema: { AuthHeaderSchema },
            async resolve({ headers, status, store: { ip } }) {
                const { appType, api_key } = headers;

                if (api_key && api_key === process.env.OVERRIDE_API_KEY) {
                    return {
                        user_type: "admin"
                    }
                }

                return status(401, {
                    message: "Invalid API key"
                })
            }
        },
    })