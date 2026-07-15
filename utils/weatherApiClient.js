/**
 * HTTP client for the WeatherAI upstream API (axios).
 * @module utils/weatherApiClient
 */

import axios from 'axios';
import redis from './redisClient.js';

const FORECAST_CACHE_TTL_SECONDS = 900;
const RATE_LIMIT_WARN_THRESHOLD = 20;
const RETRY_DELAY_MS = 500;

const weatherApi = axios.create({
  baseURL: process.env.WEATHERAI_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.WEATHERAI_API_KEY}`,
  },
});

/**
 * Format an X-RateLimit-Reset header value as a readable ISO date string.
 * @param {string | undefined} resetHeader
 * @returns {string}
 */
function formatRateLimitReset(resetHeader) {
  if (resetHeader == null || resetHeader === '') {
    return 'unknown';
  }

  const asNumber = Number(resetHeader);
  if (!Number.isNaN(asNumber)) {
    const ms = asNumber > 1e12 ? asNumber : asNumber * 1000;
    return new Date(ms).toISOString();
  }

  return String(resetHeader);
}

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Call WeatherAI GET /v1/forecast, with one retry on 5xx after 500ms.
 * @param {number} lat
 * @param {number} lon
 * @param {number} days
 * @param {boolean} [isRetry=false]
 * @returns {Promise<object>}
 */
async function fetchForecastFromApi(lat, lon, days, isRetry = false) {
  try {
    const response = await weatherApi.get('/v1/forecast', {
      params: { lat, lon, days, ai: false },
    });

    const remainingHeader = response.headers['x-ratelimit-remaining'];
    if (remainingHeader != null && Number(remainingHeader) < RATE_LIMIT_WARN_THRESHOLD) {
      console.warn(
        `WeatherAI rate limit remaining is low: ${remainingHeader}`,
      );
    }

    return response.data;
  } catch (err) {
    const status = err.response?.status;

    if (status === 429) {
      const resetReadable = formatRateLimitReset(
        err.response.headers['x-ratelimit-reset'],
      );
      throw new Error(
        `WeatherAI rate limit exceeded (429). Limit resets at ${resetReadable}`,
      );
    }

    if (status >= 500 && status < 600 && !isRetry) {
      await sleep(RETRY_DELAY_MS);
      return fetchForecastFromApi(lat, lon, days, true);
    }

    throw err;
  }
}

/**
 * Get a weather forecast for the given coordinates (cache-aside via Redis).
 * @param {number} lat
 * @param {number} lon
 * @param {number} [days=3]
 * @returns {Promise<object>}
 */
export async function getForecast(lat, lon, days = 3) {
  const cacheKey = `forecast:${lat}:${lon}:${days}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const data = await fetchForecastFromApi(lat, lon, days);

  await redis.set(
    cacheKey,
    JSON.stringify(data),
    'EX',
    FORECAST_CACHE_TTL_SECONDS,
  );

  return data;
}
