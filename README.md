# Weather Alert Service

Node.js service that lets clients subscribe to weather threshold alerts. It polls [WeatherAI](https://api.example.com) on a cron schedule, evaluates conditions against each active subscription, and fires webhooks when thresholds are breached — while protecting the upstream quota with Redis caching and dual-layer rate limiting.

## Architecture

```
                        ┌─────────────────────────────────────┐
                        │           Express API               │
   Clients ───────────► │  /api/subscriptions                 │
                        │  /api/weather                       │──────► WeatherAI
                        │  /api/alerts                        │
                        │  /docs  /health                     │
                        └──────────┬────────────┬─────────────┘
                                   │            │
                                   ▼            ▼
                               MongoDB        Redis
                          (subscriptions,   (forecast
                           alert logs)        cache)


   Separate path — background polling:

   node-cron (POLL_CRON_SCHEDULE)
        │
        ▼
   Fetch active Subscriptions (MongoDB)
        │
        ▼
   getForecast(lat, lon) ──► Redis cache ──miss──► WeatherAI
        │
        ▼
   Evaluate metric / operator / threshold
   + cooldown check
        │
        ├── condition false ──► (no-op)
        │
        └── condition true ──► POST subscription.webhookUrl
                                    │
                                    ▼
                              Write AlertLog
                              (update lastTriggeredAt on success)
```

## Setup

```bash
git clone <repository-url>
cd weather-alert-service
npm install
cp .env.example .env
```

Edit `.env` and fill in the values (see table below). Then start in development mode:

```bash
npm run dev
```

The API listens on `PORT` (default `5000`). Open Swagger UI at [http://localhost:5000/docs](http://localhost:5000/docs).

## Environment variables

| Name | Required | Description |
|------|----------|-------------|
| `PORT` | No | HTTP listen port. Defaults to `5000`. |
| `NODE_ENV` | No | `development` or `production`. Controls error logging detail. |
| `MONGO_URI` | Yes | MongoDB connection string. |
| `REDIS_URL` | Yes | Redis connection URL used for forecast caching. |
| `WEATHERAI_BASE_URL` | Yes | Base URL for the WeatherAI HTTP API. |
| `WEATHERAI_API_KEY` | Yes | Bearer token sent as `Authorization: Bearer <key>`. |
| `POLL_CRON_SCHEDULE` | No | Cron expression for the poller. Defaults to `*/15 * * * *`. |
| `WEBHOOK_TIMEOUT_MS` | No | Axios timeout for outbound webhook POSTs. Defaults to `5000`. |
| `API_BASE_URL` | No | Public base URL shown in OpenAPI docs. Defaults to `http://localhost:5000`. |

## API overview

Interactive OpenAPI docs (request/response schemas, try-it-out): **[GET /docs](/docs)**.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check → `{ "status": "ok" }` |
| `POST` | `/api/subscriptions` | Create an alert subscription |
| `GET` | `/api/subscriptions` | List subscriptions (`?active=true` filter) |
| `GET` | `/api/subscriptions/:id` | Get one subscription |
| `PATCH` | `/api/subscriptions/:id` | Partially update a subscription |
| `DELETE` | `/api/subscriptions/:id` | Delete a subscription |
| `GET` | `/api/weather/forecast` | Proxy forecast (`lat`, `lon`, `days`) |
| `GET` | `/api/alerts` | Alert history (`?subscriptionId=`, `?page=`, `?limit=`) |
| `GET` | `/docs` | Swagger UI |

## Design decisions

### Redis caching (protecting WeatherAI quota)

Forecast responses are cached in Redis under keys like `forecast:{lat}:{lon}:{days}` with a **15-minute TTL**. Repeated polls and API clients for the same coordinates reuse cached data instead of calling WeatherAI, which keeps monthly request usage down. Calls also pass `ai=false` so forecast requests do not consume AI quota — only raw forecast numbers are needed for threshold checks.

### Rate limiting (two layers)

1. **Outbound (WeatherAI client)** — The axios client inspects `X-RateLimit-Remaining` and logs a warning when it drops below 20. On **429**, it throws a clear error that includes the reset time from `X-RateLimit-Reset`. On **5xx**, it retries once after 500ms before failing.
2. **Inbound (this API)** — `express-rate-limit` caps each client IP at **100 requests per 15 minutes**, returning a JSON error body and standard rate-limit headers.

Together these protect both the shared WeatherAI allowance and this service itself from abuse.

### Cooldown (preventing alert spam)

Each subscription has `cooldownMinutes` (default **60**). When a threshold breach would fire a webhook, the poller only proceeds if `lastTriggeredAt` is null or the cooldown window has elapsed. `lastTriggeredAt` is updated **only after a successful webhook**, so a failed delivery can be retried on the next cycle without waiting out the full cooldown — while successful alerts will not spam the webhook URL every poll tick.

## Deployment (Railway / Render)

1. **Create a web service** from this repo. Set the start command to `npm start` (runs `node server.js`).
2. **Provision MongoDB and Redis** (Railway plugins, Render Redis/Mongo, or managed Atlas + Redis Cloud) and copy connection strings into `MONGO_URI` and `REDIS_URL`.
3. **Set environment variables** in the dashboard to match the table above. Prefer production values for `NODE_ENV`, `WEATHERAI_*`, and a public `API_BASE_URL` so `/docs` shows the correct server URL.
4. **Port binding** — Railway and Render inject `PORT`; do not hard-code it. The app already uses `process.env.PORT || 5000`.
5. **Health checks** — Point the platform health check at `GET /health`.
6. **Single instance preferred** — The cron poller runs in-process. Multiple replicas would duplicate poll cycles and risk double webhooks; scale horizontally only if you move the job to a dedicated worker or add a distributed lock later.
7. **Outbound webhooks** — Ensure the platform allows egress HTTPS so webhook deliveries can reach customer URLs within `WEBHOOK_TIMEOUT_MS`.
