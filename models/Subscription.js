/**
 * Subscription Mongoose model — persists weather alert subscription records.
 * @module models/Subscription
 */

import mongoose from 'mongoose';

const METRICS = ['rain_probability', 'temp_max', 'temp_min', 'wind_speed'];
const OPERATORS = ['>', '<', '>=', '<='];

/**
 * Validate that a string is a well-formed absolute URL.
 * @param {string} value
 * @returns {boolean}
 */
function isValidUrl(value) {
  try {
    return Boolean(new URL(value));
  } catch {
    return false;
  }
}

const subscriptionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
    },
    lat: {
      type: Number,
      required: true,
    },
    lon: {
      type: Number,
      required: true,
    },
    metric: {
      type: String,
      enum: METRICS,
      required: true,
    },
    operator: {
      type: String,
      enum: OPERATORS,
      required: true,
    },
    threshold: {
      type: Number,
      required: true,
    },
    webhookUrl: {
      type: String,
      required: true,
      validate: {
        validator: isValidUrl,
        message: 'webhookUrl must be a valid URL',
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastTriggeredAt: {
      type: Date,
      default: null,
    },
    cooldownMinutes: {
      type: Number,
      default: 60,
    },
  },
  { timestamps: true },
);

subscriptionSchema.index({ active: 1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
