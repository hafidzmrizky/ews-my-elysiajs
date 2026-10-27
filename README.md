# EWS-MY • Early Warning System API

Early warning system API for Malaysia and Southeast Asia. Provides real-time weather advisories, 7-day weather forecasts, air quality index (API/IPU), and dual-source earthquake tracking.

[![Bun](https://img.shields.io/badge/Bun-1.3+-black?logo=bun&logoColor=white)](https://bun.sh)
[![ElysiaJS](https://img.shields.io/badge/ElysiaJS-v1.4+-f43f5e?logo=elysia&logoColor=white)](https://elysiajs.com)
[![Redis](https://img.shields.io/badge/Redis-Cache-dc2626?logo=redis&logoColor=white)](https://redis.io)
[![SQLite](https://img.shields.io/badge/SQLite-bun:sqlite-003b57?logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![Host](https://img.shields.io/badge/Hosted%20by-arcanius.id-6366f1)](https://arcanius.id)

---

## Quick Links

| Resource | URL |
| :--- | :--- |
| **Live API Base** | [`https://ews-api-my.arcanius.id`](https://ews-api-my.arcanius.id) |
| **OpenAPI Docs** | [`https://ews-api-my.arcanius.id/api/openapi`](https://ews-api-my.arcanius.id/api/openapi) |
| **Health Check** | [`https://ews-api-my.arcanius.id/api/health`](https://ews-api-my.arcanius.id/api/health) |
| **Rate Limit** | 1,000 requests per 15-minute window |
| **Timezone** | Malaysian Time (MYT, UTC+8) / ISO 8601 UTC |
| **Hosting** | Hosted by [arcanius.id](https://arcanius.id) |

---

## Features

- **Consolidated Weather Overview**: Single endpoint combining active advisories, nearest air quality station, and 7-day forecast by coordinates or state/district.
- **MetMalaysia Warning Bulletins**: Automated parser for marine warnings (strong winds & rough seas) and land warnings (thunderstorms & heavy rain), resolved to affected states and districts.
- **Bilingual 7-Day Forecast**: Nationwide forecast data with English and Bahasa Melayu translations.
- **Real-time Air Quality (API / IPU)**: Live data from 68 Department of Environment (DOE / JAS) stations with nearest-station distance calculation.
- **Dual-Source Earthquake Engine**:
  - Ingests MetMalaysia warnings and USGS M4.5+ feeds.
  - Spatiotemporal deduplication ($\le 100\text{ km}$, $\pm 120\text{s}$) to merge matching events into unified records.
  - Calculates distance and 16-point compass bearing to Malaysian reference points.
  - Direct PNG map generation with epicentre marker.
- **Sub-Millisecond Geocoding**: In-memory Point-in-Polygon reverse geocoding using optimized bounding boxes and coastal fallback.
- **Low-RAM Delta Caching**: Uses `Bun.hash` signatures to prevent redundant upstream re-parsing and unnecessary database writes.

---

## API Reference

All endpoints are mounted under `/api`.

### Weather

#### Consolidated Overview
Fetch advisories, nearest air quality station, and 7-day forecast in one request:
```bash
# By coordinates
curl -s "https://ews-api-my.arcanius.id/api/weather/overview?lat=3.1390&lng=101.6869"

# By state and district
curl -s "https://ews-api-my.arcanius.id/api/weather/overview?state=Selangor&district=Petaling"
```

#### Weather Advisories
```bash
# Active advisories for coordinates
curl -s "https://ews-api-my.arcanius.id/api/weather/advisories?lat=5.9804&lng=116.0735"

# All active advisories nationwide
curl -s "https://ews-api-my.arcanius.id/api/weather/advisories"
```

#### 7-Day Weather Forecast
```bash
# Forecast by coordinates
curl -s "https://ews-api-my.arcanius.id/api/weather/forecast?lat=5.4141&lng=100.3288"

# Forecast by district and state
curl -s "https://ews-api-my.arcanius.id/api/weather/forecast?district=Klang&state=Selangor"
```

#### Air Quality (API / IPU)
```bash
# Nearest station by coordinates
curl -s "https://ews-api-my.arcanius.id/api/weather/air-quality?lat=3.1390&lng=101.6869"

# All stations in a state
curl -s "https://ews-api-my.arcanius.id/api/weather/air-quality?state=Johor"
```

---

### Earthquake

#### List Earthquakes
```bash
# Standardized feed (default)
curl -s "https://ews-api-my.arcanius.id/api/earthquake?limit=5"

# Filter by scope (malaysia | regional | global | all) & minimum magnitude
curl -s "https://ews-api-my.arcanius.id/api/earthquake?scope=regional&min_magnitude=5.0"

# Detailed mode with full seismic metrics and provider bulletins
curl -s "https://ews-api-my.arcanius.id/api/earthquake?detail=true&limit=2"
```

#### Get Earthquake by ID
```bash
curl -s "https://ews-api-my.arcanius.id/api/earthquake/us7000tte4"
```

#### Direct Map PNG Visual
Returns an `image/png` (600x400) showing the epicentre marker on the map:
```bash
curl -sI "https://ews-api-my.arcanius.id/api/earthquake/us7000tte4/map.png"
```

---

### Geolocation

```bash
# Reverse geocode coordinates to Malaysian district & state
curl -s "https://ews-api-my.arcanius.id/api/geo/location?lat=3.1390&lng=101.6869"

# List all Malaysian states and districts
curl -s "https://ews-api-my.arcanius.id/api/geo/states"
```

---

### System Health

```bash
curl -s "https://ews-api-my.arcanius.id/api/health"
```

---

## Local Development

### Prerequisites
- [Bun](https://bun.sh) (v1.1+)
- [Redis](https://redis.io) (v6.0+)

### Setup
```bash
# 1. Clone repository
git clone https://github.com/hafidzmrizky/ews-my-elysiajs.git
cd ews-my-elysiajs/app

# 2. Install dependencies
bun install

# 3. Configure environment
mkdir -p secret
cat <<EOF > secret/.env
APP_PORT=3050
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
OVERRIDE_API_KEY=your_secret_admin_key_here
EOF

# 4. Start development server
bun run dev
```

### Running Tests
```bash
bun test
```

---

## Contributing

1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "feat: add feature description"
   ```
4. Verify tests pass:
   ```bash
   bun test
   ```
5. Push to your branch and open a Pull Request.

---

## Attributions & Data Sources

- **[MetMalaysia](https://www.met.gov.my/)** (*Jabatan Meteorologi Malaysia*) / **[data.gov.my](https://data.gov.my/)** - Official weather forecasts, warning advisories, and earthquake bulletins.
- **[Department of Environment](https://www.doe.gov.my/)** (*Jabatan Alam Sekitar / JAS*) - Real-time Continuous Air Quality Monitoring (CAQM / APIMS) data.
- **[USGS](https://earthquake.usgs.gov/)** (*United States Geological Survey*) - Real-time global earthquake feeds and ShakeMap data.
- **[jakim.geojson](https://github.com/mptwaktusolat/jakim.geojson)** by [mptwaktusolat](https://github.com/mptwaktusolat) - Curated Malaysian state and district GeoJSON boundary polygons.
- **[arcanius.id](https://arcanius.id)** - Production hosting and server infrastructure.