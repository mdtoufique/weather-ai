/**
 * Express application entry — middleware, routes, and error handling setup.
 * @module app
 */

import express from 'express';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { stream } from './utils/logger.js';
import rateLimiter from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import swaggerSpec from './docs/swagger.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import weatherRoutes from './routes/weatherRoutes.js';
import alertRoutes from './routes/alertRoutes.js';

const app = express();

app.use(express.json());
app.use(morgan('combined', { stream }));
app.use(rateLimiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/alerts', alertRoutes);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(errorHandler);

export default app;
