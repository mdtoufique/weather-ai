# Weather Alert Service

A background monitoring service built on the WeatherAI API. Instead of exposing weather data on request, it watches it continuously: clients register a location and a threshold condition, and the service polls WeatherAI on a schedule, evaluates conditions against every active subscription, and fires an outbound webhook the moment a threshold is breached — while protecting WeatherAI's monthly quota with Redis caching and respecting rate limits on both sides of the system.

## Why this approach is different

Most API integrations for an assignment like this are request/response demos: call an endpoint, render the JSON, done. That pattern proves you can use `fetch`, but not that you can run a service.

This project is built the other way around — as a system that runs on its own, independent of anyone sending it a request:

- **It has a background process, not just endpoints.** A cron job polls WeatherAI on its own schedule and evaluates every active subscription, with zero human interaction required. The API layer exists mainly to configure what the background job watches.
- **It remembers what it's already told you.** Each subscription tracks `lastTriggeredAt` and a `cooldownMinutes` window, so a breached threshold doesn't re-fire a webhook on every single poll tick. That's state management solving a real spam problem, not just data storage.
- **It treats the upstream API as a finite, fallible resource.** WeatherAI's Free tier caps out at 1,000 requests a month. Rather than hitting the API on every poll for every subscription, forecast responses are cached in Redis with a 15-minute TTL — repeated checks for the same coordinates reuse cached data instead of spending quota. Rate-limit headers are inspected and 429/5xx responses are handled with warnings and retry logic instead of crashing the poller.
- **It protects itself the same way it protects WeatherAI.** `express-rate-limit` caps inbound traffic to this API, separately from the outbound backoff logic used against WeatherAI. Two different rate limits, for two different directions of traffic, handled independently and deliberately.
- **Failure in one subscription doesn't take down the batch.** Each subscription's poll-and-evaluate cycle is isolated in its own try/catch, and every outcome — success or failure — is written to an `AlertLog`, so there's a full audit trail of what fired, what failed, and why.
- **It's fully documented and testable without a frontend.** Every route is described with OpenAPI/Swagger annotations, served live at `/docs`. That page is both documentation and a working demo — a reviewer can exercise the entire API from a browser with no client code needed.

The result: a small system that demonstrates scheduling, caching, quota-awareness, failure isolation, and self-documentation — the concerns that actually show up running a backend in production, not just calling one.

## Architecture

```
                        ┌─────────────────────────────────────┐
                        │           Express API                │
   Clients ───────────► │  /api/subscriptions                  │
                        │  /api/weather                        │──────► WeatherAI
                        │  /api/alerts                         │
                        │  /docs  /health                      │
                        └──────────┬────────────┬───────────────┘
                                   │            │
                                   ▼            ▼
                               MongoDB        Redis
                          (subscriptions,   (forecast
                           alert logs)        cache)


   Separate path — background polling, runs independent of any request:

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

## Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 18+, Express 5 (ESM) | Familiar, fast to iterate |
| Database | MongoDB + Mongoose | Subscriptions and alert history |
| Cache | Redis (ioredis) | Protects WeatherAI quota via cache-aside forecast caching |
| Scheduler | node-cron | Runs the poll/evaluate/alert cycle independent of HTTP traffic |
| HTTP client | axios | Outbound calls to WeatherAI and to subscriber webhook URLs |
| Inbound rate limiting | express-rate-limit | Protects this API from abuse |
| Logging | morgan | Request-level logging |
| API docs | swagger-jsdoc + swagger-ui-express | Live, interactive docs at `/docs` — doubles as the demo |

---

## Running it locally

### Prerequisites

- **Node.js** 18 or newer
- **MongoDB** — running locally, or a reachable Atlas connection string
- **Redis** — running locally (the API will start without it, but the forecast and polling paths depend on it)

If you don't already have Redis locally, pick one:

```bash
# Docker (any OS, recommended)
docker run -d --name redis -p 6379:6379 redis:7

# macOS (Homebrew)
brew install redis && brew services start redis

# Ubuntu / WSL
sudo apt install redis-server && sudo service redis-server start
```

```bash
# Windows without WSL
# Install Memurai Developer (Redis-compatible, listens on 6379): https://www.memurai.com/
```

### 1. Clone and install

```bash
git clone <repository-url>
cd weather-alert-service
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set, at minimum, a valid `WEATHERAI_API_KEY` (from your WeatherAI dashboard). Defaults assume:

| Service | Default local value |
|---|---|
| API | `http://localhost:3000` |
| MongoDB | `mongodb://localhost:27017/weather-alert-service` |
| Redis | `redis://localhost:6379` |

### 3. Start MongoDB and Redis

Make sure both are running before starting the app — the process exits on startup if it can't reach MongoDB, and forecast/poll routes will error without Redis.

```bash
# MongoDB, if run manually rather than as a service
mongod --dbpath /path/to/your/db

# Redis, if not already running as a service (see options above)
redis-server
```

### 4. Run the service

```bash
npm run dev     # nodemon, auto-reloads on file changes
# or
npm start        # plain node, closer to production behavior
```

You should see:

```text
Redis connected successfully
MongoDB connected successfully
pollWeatherJob: scheduled with cron "*/5 * * * *"
weather-alert-service listening on port 3000 — docs at http://localhost:3000/docs
```

- Health check: [http://localhost:3000/health](http://localhost:3000/health)
- Interactive docs: [http://localhost:3000/docs](http://localhost:3000/docs)

If `PORT` is unset, the app falls back to `5000` — keep `API_BASE_URL` in `.env` matching whatever port you actually run on, since Swagger's "Try it out" uses that value to build request URLs.

### 5. Smoke-test it

```bash
# Liveness
curl http://localhost:3000/health

# Forecast proxy (exercises the Redis cache + WeatherAI call)
curl "http://localhost:3000/api/weather/forecast?lat=23.81&lon=90.41&days=1"

# Create a subscription — use a real webhook receiver to see it fire,
# e.g. generate a free URL at https://webhook.site
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{"label":"Dhaka rain","lat":23.81,"lon":90.41,"metric":"rain_probability","operator":">=","threshold":30,"webhookUrl":"https://webhook.site/YOUR-ID","cooldownMinutes":5}'

# Inspect state
curl http://localhost:3000/api/subscriptions
curl http://localhost:3000/api/alerts
```

(On Windows `cmd`, replace the trailing `\` line continuations with `^`.)

The poller runs on `POLL_CRON_SCHEDULE` (every 5 minutes by default). When a subscription's condition is met and its cooldown has elapsed, the service POSTs to `webhookUrl` and logs the outcome to `AlertLog` — watch the webhook.site page or your server logs to see it happen live.

### Local troubleshooting

| Symptom | Likely cause |
|---|---|
| Repeated `Redis error:` in logs | Redis isn't running, or `REDIS_URL` is wrong |
| App exits immediately on boot | MongoDB isn't running, or `MONGO_URI` is wrong |
| Swagger "Try it out" calls the wrong host | `API_BASE_URL` doesn't match the port you're actually running on |
| Poll logs `Unable to resolve metric …` | WeatherAI's forecast response shape doesn't match the mapping in `jobs/pollWeatherJob.js` |
| No webhook ever arrives | Condition genuinely isn't being met, cooldown hasn't elapsed yet, or the poller hasn't run a cycle since you created the subscription — check logs for `triggered=` counts |

---

## Environment variables

| Name | Required | Description |
|---|---|---|
| `PORT` | No | HTTP listen port. Falls back to `5000` if unset. |
| `NODE_ENV` | No | `development` or `production` — controls error verbosity. |
| `MONGO_URI` | Yes | MongoDB connection string. |
| `REDIS_URL` | Yes | Redis connection URL, used for forecast caching. |
| `WEATHERAI_BASE_URL` | Yes | Base URL for the WeatherAI API. |
| `WEATHERAI_API_KEY` | Yes | Sent as `Authorization: Bearer <key>` on every WeatherAI call. |
| `POLL_CRON_SCHEDULE` | No | Cron expression for the poller. Defaults to `*/15 * * * *`. |
| `WEBHOOK_TIMEOUT_MS` | No | Timeout for outbound webhook POSTs. Defaults to `5000`. |
| `API_BASE_URL` | No | Public base URL shown in the OpenAPI docs. |

## API overview

Full interactive reference with request/response schemas: **[GET /docs](http://localhost:3000/docs)**.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/api/subscriptions` | Create an alert subscription |
| `GET` | `/api/subscriptions` | List subscriptions (`?active=true`) |
| `GET` | `/api/subscriptions/:id` | Get one subscription |
| `PATCH` | `/api/subscriptions/:id` | Partially update a subscription |
| `DELETE` | `/api/subscriptions/:id` | Delete a subscription |
| `GET` | `/api/weather/forecast` | Cached forecast proxy (`lat`, `lon`, `days`) |
| `GET` | `/api/alerts` | Alert history (`?subscriptionId=`, `?page=`, `?limit=`) |
| `GET` | `/docs` | Swagger UI |

## Design decisions

**Redis caching.** Forecasts are cached under `forecast:{lat}:{lon}:{days}` with a 15-minute TTL. Repeated checks — from either API clients or the poller itself checking the same coordinates across cycles — reuse cached data instead of spending WeatherAI quota. Calls also pass `ai=false`, since threshold evaluation only needs raw numbers, not AI-generated summaries.

**Two-layer rate limiting.** Outbound calls to WeatherAI watch `X-RateLimit-Remaining` and log a warning under 20 remaining; a `429` throws a clear error including the `X-RateLimit-Reset` time, and `5xx` responses get one retry after 500ms. Inbound traffic to this API is separately capped at 100 requests per 15 minutes per IP via `express-rate-limit`. These are deliberately independent — one manages a shared external resource, the other protects this service itself.

**Cooldown logic.** Each subscription has a `cooldownMinutes` window (default 60). A webhook only fires if `lastTriggeredAt` is null or the cooldown has elapsed, and `lastTriggeredAt` only updates on a *successful* delivery — so a failed webhook can retry on the next cycle without waiting out a full cooldown, while a successful one won't spam the same URL repeatedly.

## Deployment (Railway / Render)

1. Create a web service from this repo; start command `npm start`.
2. Provision MongoDB and Redis (platform plugins, or managed Atlas + Redis Cloud) and set `MONGO_URI` / `REDIS_URL` accordingly.
3. Set the remaining environment variables from the table above, including a public `API_BASE_URL` so `/docs` reflects the right host.
4. Don't hard-code the port — the app already reads `process.env.PORT`, which Railway/Render inject automatically.
5. Point the platform's health check at `GET /health`.
6. Run a **single instance**. The poller runs in-process; multiple replicas would duplicate poll cycles and could send duplicate webhooks. Scale by extracting the job to a dedicated worker with a distributed lock if that's ever needed.
7. Confirm outbound HTTPS egress is allowed so webhook deliveries can reach subscriber URLs within `WEBHOOK_TIMEOUT_MS`.
