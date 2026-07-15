/**
 * Weather route definitions — maps HTTP paths to weather controllers.
 * @module routes/weatherRoutes
 */

import { Router } from 'express';
import { getForecast } from '../controllers/weatherController.js';

const router = Router();

/**
 * @openapi
 * /api/weather/forecast:
 *   get:
 *     tags:
 *       - Weather
 *     summary: Get a weather forecast for coordinates
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: Latitude
 *       - in: query
 *         name: lon
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: Longitude
 *       - in: query
 *         name: days
 *         required: true
 *         schema:
 *           type: number
 *         description: Number of forecast days
 *     responses:
 *       200:
 *         description: Forecast data from WeatherAI (or Redis cache)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing or invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/forecast', getForecast);

export default router;
