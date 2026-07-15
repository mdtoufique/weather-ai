/**
 * Central Express error-handling middleware.
 * @module middlewares/errorHandler
 */

/**
 * Catch unhandled route errors and send a normalized JSON error response.
 * Logs full stack in development; message only in production.
 * Never sends stack traces to the client in production.
 * @param {Error & { statusCode?: number }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (process.env.NODE_ENV === 'production') {
    console.error(message);
  } else {
    console.error(err.stack || message);
  }

  res.status(statusCode).json({ error: message });
}
