import { Elysia } from "elysia";
import { rateLimit } from 'elysia-rate-limit'
import { config } from "dotenv";
import { getIPFromHeaders } from "./modules/ip";
import cron from "@elysia/cron";
import client from "./modules/redis";
import openapi from "@elysia/openapi";
import { weatherRoutes } from "./routes/weather";
import { earthquakeRoutes } from "./routes/earthquake";
import { syncWeatherAdvisories, syncWeatherForecast, syncAirQuality } from "./modules/weather_api";
import { syncEarthquakeData } from "./modules/earthquake_api";
import { geoRoutes } from "./routes/geo";
import { identityMacro } from "./macros/auth";
import { REDIS_KEYS as REDIS_WEATHER_KEYS } from './modules/weather_api/constants'

config({ path: "secret/.env" });
const PORT = process.env.APP_PORT || 3000;

const app = new Elysia({ prefix: "/api" })
  .state("ip", "")
  .onBeforeHandle(async ({ request, cookie: { api_key }, headers, store: { ip }, set }) => {
    try {
      ip = await getIPFromHeaders(request.headers) ?? "";
      console.log(`🌏 | ${new Date().toISOString()} - ${request.method} ${request.url} - IP: ${ip}`);
    } catch {
      // ip extraction failure should never block a request >.<
    }
  });

/**
 * Error Handling
 */
app.onError(({ error, code, request, status }) => {
  if (code === "NOT_FOUND") {
    return status(404, {
      success: false,
      error: "NOT_FOUND",
      message: `Route not found: ${request.method} ${new URL(request.url).pathname}`
    });
  }

  console.error(`Error ${code}: ${error}`);
});

/**
 * Plugins (rate limiter, openapi, others)
 */
app.use(rateLimit({
  duration: 1000 * 60 * 15,
  max: 1000,
}));
app.use(openapi({
  documentation: {
    info: {
      title: "Earthquake Weather System API for Malaysia",
      version: "1.0.0",
      description: "API for Earthquake Weather System",
    },
    tags: [
      {
        name: "General",
        description: "General API endpoints",
      },
      {
        name: "Weather",
        description: "Weather related API endpoints"
      },
      {
        name: "Geographic",
        description: "Geolocation-related API endpoints"
      },
      {
        name: "Earthquake",
        description: "Earthquake-related API endpoints"
      }
    ],
    servers: [
      {
        url: process.env.ENVIRONMENT === 'production' ? process.env.BASE_URL ?? '' : `http://localhost:${PORT}/`,
        description: "Server"
      }
    ]
  }
}));

/**
 * Crons >.<
 */
app.use(cron({
  name: 'cron-fetch-earthquake-cache-every-min',
  pattern: '* * * * *',
  async run() {
    console.log("cron-fetch-earthquake-cache-every-min triggered");
    const res = await syncEarthquakeData();
    if (res.updated) {
      console.log(`Earthquake data updated (${res.total_events} events, ${res.merged_count} merged)`);
    }
  }
}));
app.use(cron({
  name: 'cron-fetch-advisory-cache-every-min',
  pattern: '* * * * *',
  async run() {
    console.log("cron-fetch-advisory-cache-every-min triggered");
    const res = await syncWeatherAdvisories();
    if (res.updated) {
      console.log(`Weather advisories updated (${res.count} active)`);
    }
  }
}));
app.use(cron({
  name: 'cron-fetch-weather-forecast-cache-every-hr',
  pattern: '0 * * * *',
  async run() {
    console.log("cron-fetch-weather-forecast-cache-every-hr triggered");
    const res = await syncWeatherForecast();
    if (res.updated) {
      console.log(`Weather forecast updated (${res.count} locations)`);
    }
  }
}));
app.use(cron({
  name: 'cron-fetch-air-quality-cache-every-hr',
  pattern: '0 * * * *',
  async run() {
    console.log("cron-fetch-air-quality-cache-every-hr triggered");
    const res = await syncAirQuality();
    if (res.updated) {
      console.log(`Air quality updated (${res.count} stations)`);
    }
  }
}));

/**
 * Routes!! >.<
 */
app.use(weatherRoutes);
app.use(earthquakeRoutes);
app.use(geoRoutes);
app.use(identityMacro);
app.get("/health", async ({ status }) => {
  const h_earthquake_last_successful_update = await client.get("earthquake_last_successful_update");
  const h_air_last_successful_update = await client.get(REDIS_WEATHER_KEYS.DOE_AIR_QUALITY_LAST_UPDATE);
  const h_weather_advisory_last_successful_update = await client.get(REDIS_WEATHER_KEYS.WEATHER_ADVISORY_LAST_UPDATE);
  const h_weather_forecast_last_successful_update = await client.get(REDIS_WEATHER_KEYS.WEATHER_FORECAST_LAST_UPDATE);
  return status(200, {
    "timestamp": new Date().toISOString(),
    "earthquake_last_successful_update": h_earthquake_last_successful_update,
    "air_last_successful_update": h_air_last_successful_update,
    "weather_advisory_last_successful_update": h_weather_advisory_last_successful_update,
    "weather_forecast_last_successful_update": h_weather_forecast_last_successful_update,
  });
}, {
  detail: {
    tags: ["General"],
    summary: "Get API Health",
    description: "Check the health of the API and the last time the data was updated"
  }

})

/**
 * Startup!! 
 */
app.listen(PORT, () => {
  console.log(`🦊 | ElysiaJS - Started - Running on ${app.server?.hostname}:${app.server?.port}`);
  console.log(`🚪 | Total Endpoint(s): ${app.routes.length}`);
});