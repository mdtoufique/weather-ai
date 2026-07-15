/**
 * AlertLog Mongoose model — persists alert evaluation and delivery history.
 * @module models/AlertLog
 */

import mongoose from 'mongoose';

const WEBHOOK_STATUSES = ['success', 'failed'];

const alertLogSchema = new mongoose.Schema(
  {
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
    metric: {
      type: String,
    },
    value: {
      type: Number,
    },
    threshold: {
      type: Number,
    },
    operator: {
      type: String,
    },
    webhookStatus: {
      type: String,
      enum: WEBHOOK_STATUSES,
    },
    webhookResponseCode: {
      type: Number,
    },
  },
  { timestamps: true },
);

alertLogSchema.index({ subscription: 1 });

const AlertLog = mongoose.model('AlertLog', alertLogSchema);

export default AlertLog;
