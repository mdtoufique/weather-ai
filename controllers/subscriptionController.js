/**
 * Subscription HTTP handlers — create, list, update, and delete weather alert subscriptions.
 * @module controllers/subscriptionController
 */

import Subscription from '../models/Subscription.js';

const REQUIRED_CREATE_FIELDS = [
  'label',
  'lat',
  'lon',
  'metric',
  'operator',
  'threshold',
  'webhookUrl',
];

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
 * Create a new weather alert subscription.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function createSubscription(req, res, next) {
  try {
    const missing = REQUIRED_CREATE_FIELDS.filter(
      (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === '',
    );

    if (missing.length > 0) {
      throw httpError(400, `Missing required fields: ${missing.join(', ')}`);
    }

    const subscription = await Subscription.create(req.body);
    res.status(201).json(subscription);
  } catch (err) {
    next(err);
  }
}

/**
 * List subscriptions, optionally filtered by active status.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function listSubscriptions(req, res, next) {
  try {
    const filter = {};

    if (req.query.active !== undefined) {
      filter.active = req.query.active === 'true';
    }

    const subscriptions = await Subscription.find(filter);
    res.json(subscriptions);
  } catch (err) {
    next(err);
  }
}

/**
 * Get a single subscription by id.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function getSubscription(req, res, next) {
  try {
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      throw httpError(404, 'Subscription not found');
    }

    res.json(subscription);
  } catch (err) {
    next(err);
  }
}

/**
 * Update an existing subscription (partial).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function updateSubscription(req, res, next) {
  try {
    const subscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    if (!subscription) {
      throw httpError(404, 'Subscription not found');
    }

    res.json(subscription);
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a subscription.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function deleteSubscription(req, res, next) {
  try {
    const subscription = await Subscription.findByIdAndDelete(req.params.id);

    if (!subscription) {
      throw httpError(404, 'Subscription not found');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
