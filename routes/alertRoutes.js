/**
 * Alert route definitions — maps HTTP paths to alert controllers.
 * @module routes/alertRoutes
 */

import { Router } from 'express';
import { listAlertHistory } from '../controllers/alertController.js';

const router = Router();

/**
 * @openapi
 * /api/alerts:
 *   get:
 *     tags:
 *       - Alerts
 *     summary: List alert delivery history
 *     parameters:
 *       - in: query
 *         name: subscriptionId
 *         schema:
 *           type: string
 *         description: Filter by Subscription ObjectId
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 20
 *         description: Page size
 *     responses:
 *       200:
 *         description: Alert logs, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AlertLog'
 */
router.get('/', listAlertHistory);

export default router;
