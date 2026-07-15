/**
 * Scheduled job that polls weather data and evaluates alert subscriptions.
 * @module jobs/pollWeatherJob
 */

import cron from 'node-cron';
import axios from 'axios';
import Subscription from '../models/Subscription.js';
import AlertLog from '../models/AlertLog.js';
import { getForecast } from '../utils/weatherApiClient.js';

const DEFAULT_POLL_CRON = '*/15 * * * *';
const DEFAULT_WEBHOOK_TIMEOUT_MS = 5000;

/** @type {import('node-cron').ScheduledTask | null} */
let scheduledTask = null;

/**
 * Coerce a value to a finite number, or undefined if not numeric.
 * @param {unknown} value
 * @returns {number | undefined}
 */
function toFiniteNumber(value) {
  if (value == null || value === '') {
    return undefined;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * First daily forecast slice from a WeatherAI (or compatible) response.
 * @param {object} forecast
 * @returns {object | undefined}
 */
function getDaySlice(forecast) {
  if (Array.isArray(forecast?.daily) && forecast.daily.length > 0) {
    return forecast.daily[0];
  }
  if (Array.isArray(forecast?.days) && forecast.days.length > 0) {
    return forecast.days[0];
  }
  if (Array.isArray(forecast?.forecast) && forecast.forecast.length > 0) {
    return forecast.forecast[0];
  }
  return forecast;
}

/**
 * Map a subscription metric to its numeric value in a WeatherAI forecast.
 * WeatherAI /v1/forecast shape (ai=false):
 *   daily[]: { temp_max, temp_min, precipitation (mm), ... }
 *   current: { temperature, windspeed, ... }
 *   hourly[]: { temp, precipitation, ... }
 * rain_probability is not returned; derived from hourly wet-share when needed.
 * @param {object} forecast
 * @param {string} metric
 * @returns {number | undefined}
 */
function getMetricValue(forecast, metric) {
  const day = getDaySlice(forecast);
  const current = forecast?.current ?? {};

  switch (metric) {
    case 'temp_max':
      return toFiniteNumber(
        day?.temp_max
          ?? day?.temperature?.max?.celsius
          ?? day?.temperature?.max,
      );
    case 'temp_min':
      return toFiniteNumber(
        day?.temp_min
          ?? day?.temperature?.min?.celsius
          ?? day?.temperature?.min,
      );
    case 'wind_speed':
      return toFiniteNumber(
        current.windspeed
          ?? current.wind_speed
          ?? day?.wind_speed
          ?? day?.windspeed,
      );
    case 'rain_probability': {
      const explicit = toFiniteNumber(
        day?.rain_probability
          ?? day?.precipitation_probability
          ?? day?.precipitation_probability_max
          ?? day?.precip_probability
          ?? day?.precipitation?.chanceOfRain,
      );
      if (explicit !== undefined) {
        return explicit;
      }

      // Derive approximate probability: % of hourly slots with precip > 0
      const hourly = forecast?.hourly;
      if (Array.isArray(hourly) && hourly.length > 0) {
        const wetHours = hourly.filter(
          (h) => (toFiniteNumber(h.precipitation) ?? 0) > 0,
        ).length;
        return (wetHours / hourly.length) * 100;
      }

      // Last resort: any daily precipitation mm counts as 100%, else 0%
      const precipMm = toFiniteNumber(
        typeof day?.precipitation === 'object'
          ? day.precipitation?.mm
          : day?.precipitation,
      );
      if (precipMm !== undefined) {
        return precipMm > 0 ? 100 : 0;
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Evaluate whether a metric value meets the alert condition.
 * @param {number} value
 * @param {string} operator
 * @param {number} threshold
 * @returns {boolean}
 */
function evaluateCondition(value, operator, threshold) {
  switch (operator) {
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
    default:
      return false;
  }
}

/**
 * Whether cooldown has elapsed since lastTriggeredAt.
 * @param {Date | null | undefined} lastTriggeredAt
 * @param {number} cooldownMinutes
 * @param {Date} now
 * @returns {boolean}
 */
function isCooldownElapsed(lastTriggeredAt, cooldownMinutes, now) {
  if (!lastTriggeredAt) {
    return true;
  }

  const elapsedMs = now.getTime() - new Date(lastTriggeredAt).getTime();
  return elapsedMs > cooldownMinutes * 60 * 1000;
}

/**
 * Process a single active subscription: fetch forecast, evaluate, webhook, log.
 * @param {import('mongoose').Document} subscription
 * @param {Date} now
 * @returns {Promise<'triggered' | 'skipped' | 'failed'>}
 */
async function processSubscription(subscription, now) {
  const forecast = await getForecast(subscription.lat, subscription.lon, 1);
  const value = getMetricValue(forecast, subscription.metric);

  if (value === undefined || Number.isNaN(value)) {
    throw new Error(`Unable to resolve metric "${subscription.metric}" from forecast`);
  }

  const conditionMet = evaluateCondition(
    value,
    subscription.operator,
    subscription.threshold,
  );

  if (
    !conditionMet
    || !isCooldownElapsed(subscription.lastTriggeredAt, subscription.cooldownMinutes, now)
  ) {
    return 'skipped';
  }

  const triggeredAt = now;
  const payload = {
    label: subscription.label,
    metric: subscription.metric,
    value,
    threshold: subscription.threshold,
    operator: subscription.operator,
    triggeredAt,
  };

  const timeout = Number(process.env.WEBHOOK_TIMEOUT_MS) || DEFAULT_WEBHOOK_TIMEOUT_MS;
  let webhookStatus = 'success';
  let webhookResponseCode;

  try {
    const response = await axios.post(subscription.webhookUrl, payload, {
      timeout,
      headers: { 'Content-Type': 'application/json' },
    });
    webhookResponseCode = response.status;
  } catch (err) {
    webhookStatus = 'failed';
    webhookResponseCode = err.response?.status;
  }

  await AlertLog.create({
    subscription: subscription._id,
    triggeredAt,
    metric: subscription.metric,
    value,
    threshold: subscription.threshold,
    operator: subscription.operator,
    webhookStatus,
    webhookResponseCode,
  });

  if (webhookStatus === 'success') {
    subscription.lastTriggeredAt = triggeredAt;
    await subscription.save();
    return 'triggered';
  }

  return 'failed';
}

/**
 * Run one polling cycle across all active subscriptions.
 * @returns {Promise<void>}
 */
async function runPollCycle() {
  const now = new Date();
  const subscriptions = await Subscription.find({ active: true });

  let checked = 0;
  let triggered = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    checked += 1;
    try {
      const result = await processSubscription(subscription, now);
      if (result === 'triggered') {
        triggered += 1;
      } else if (result === 'failed') {
        failed += 1;
      }
    } catch (err) {
      failed += 1;
      console.error(
        `pollWeatherJob: failed for subscription ${subscription._id}:`,
        err.message,
      );
    }
  }

  console.log(
    `pollWeatherJob: checked=${checked} triggered=${triggered} failed=${failed}`,
  );
}

/**
 * Schedule the weather polling cron job using POLL_CRON_SCHEDULE.
 * @returns {import('node-cron').ScheduledTask}
 */
export function startPollingJob() {
  const schedule = process.env.POLL_CRON_SCHEDULE || DEFAULT_POLL_CRON;

  if (scheduledTask) {
    return scheduledTask;
  }

  scheduledTask = cron.schedule(schedule, () => {
    runPollCycle().catch((err) => {
      console.error('pollWeatherJob: cycle failed:', err.message);
    });
  });

  console.log(`pollWeatherJob: scheduled with cron "${schedule}"`);
  return scheduledTask;
}

/**
 * Stop the weather polling cron job if running.
 * @returns {void}
 */
export function stopPollingJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
