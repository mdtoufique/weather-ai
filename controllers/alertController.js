/**
 * Alert HTTP handlers — query alert delivery logs.
 * @module controllers/alertController
 */

import AlertLog from '../models/AlertLog.js';

/**
 * List alert history, newest first, with optional subscription filter and pagination.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function listAlertHistory(req, res, next) {
  try {
    const filter = {};

    if (req.query.subscriptionId) {
      filter.subscription = req.query.subscriptionId;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const alerts = await AlertLog.find(filter)
      .sort({ triggeredAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json(alerts);
  } catch (err) {
    next(err);
  }
}
