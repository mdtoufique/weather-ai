/**
 * Weather HTTP handlers — fetch and expose forecast weather data.
 * @module controllers/weatherController
 */

import { getForecast as fetchForecast } from '../utils/weatherApiClient.js';

/**
 * Build an error with an HTTP status code for the error handler.
 * @param {number} statusCode
 * @param {string} message
 * @returns {Error & { statusCode: number }}
 */
function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Get a weather forecast for query coordinates.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function getForecast(req, res, next) {
  try {
    const { lat, lon, days } = req.query;

    if (lat === undefined || lon === undefined || days === undefined) {
      throw httpError(400, 'Query params lat, lon, and days are required');
    }

    const latNum = Number(lat);
    const lonNum = Number(lon);
    const daysNum = Number(days);

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || !Number.isFinite(daysNum)) {
      throw httpError(400, 'Query params lat, lon, and days must be numeric');
    }

    if (latNum < -90 || latNum > 90) {
      throw httpError(400, 'lat must be between -90 and 90');
    }

    if (lonNum < -180 || lonNum > 180) {
      throw httpError(400, 'lon must be between -180 and 180');
    }

    const forecast = await fetchForecast(latNum, lonNum, daysNum);
    res.json(forecast);
  } catch (err) {
    next(err);
  }
}
