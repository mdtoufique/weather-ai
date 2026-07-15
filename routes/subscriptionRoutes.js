/**
 * Subscription route definitions — maps HTTP paths to subscription controllers.
 * @module routes/subscriptionRoutes
 */

import { Router } from 'express';
import {
  createSubscription,
  listSubscriptions,
  getSubscription,
  updateSubscription,
  deleteSubscription,
} from '../controllers/subscriptionController.js';

const router = Router();

/**
 * @openapi
 * /api/subscriptions:
 *   post:
 *     tags:
 *       - Subscriptions
 *     summary: Create a weather alert subscription
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - label
 *               - lat
 *               - lon
 *               - metric
 *               - operator
 *               - threshold
 *               - webhookUrl
 *             properties:
 *               label:
 *                 type: string
 *                 description: Human name for this alert
 *               lat:
 *                 type: number
 *               lon:
 *                 type: number
 *               metric:
 *                 type: string
 *                 enum: [rain_probability, temp_max, temp_min, wind_speed]
 *               operator:
 *                 type: string
 *                 enum: [">", "<", ">=", "<="]
 *               threshold:
 *                 type: number
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *               active:
 *                 type: boolean
 *                 default: true
 *               cooldownMinutes:
 *                 type: number
 *                 default: 60
 *     responses:
 *       201:
 *         description: Subscription created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Missing required fields or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', createSubscription);

/**
 * @openapi
 * /api/subscriptions:
 *   get:
 *     tags:
 *       - Subscriptions
 *     summary: List weather alert subscriptions
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status (e.g. true)
 *     responses:
 *       200:
 *         description: List of subscriptions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Subscription'
 */
router.get('/', listSubscriptions);

/**
 * @openapi
 * /api/subscriptions/{id}:
 *   get:
 *     tags:
 *       - Subscriptions
 *     summary: Get a subscription by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Subscription found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getSubscription);

/**
 * @openapi
 * /api/subscriptions/{id}:
 *   patch:
 *     tags:
 *       - Subscriptions
 *     summary: Partially update a subscription
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *               lat:
 *                 type: number
 *               lon:
 *                 type: number
 *               metric:
 *                 type: string
 *                 enum: [rain_probability, temp_max, temp_min, wind_speed]
 *               operator:
 *                 type: string
 *                 enum: [">", "<", ">=", "<="]
 *               threshold:
 *                 type: number
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *               active:
 *                 type: boolean
 *               cooldownMinutes:
 *                 type: number
 *     responses:
 *       200:
 *         description: Subscription updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:id', updateSubscription);

/**
 * @openapi
 * /api/subscriptions/{id}:
 *   delete:
 *     tags:
 *       - Subscriptions
 *     summary: Delete a subscription
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription MongoDB ObjectId
 *     responses:
 *       204:
 *         description: Subscription deleted
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', deleteSubscription);

export default router;
