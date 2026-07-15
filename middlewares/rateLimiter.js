/**
 * Rate-limiting middleware configuration for API protection.
 * @module middlewares/rateLimiter
 */

import rateLimit from 'express-rate-limit';

/**
 * Limit clients to 100 requests per 15 minutes per IP.
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

export default rateLimiter;
