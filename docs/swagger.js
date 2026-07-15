/**
 * OpenAPI / Swagger specification setup (swagger-jsdoc).
 * @module docs/swagger
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const port = process.env.PORT || 5000;
const serverUrl =
  process.env.API_BASE_URL || `http://localhost:${port}`;

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Weather Alert Service API',
      version: '1.0.0',
      description:
        'Polls WeatherAI and fires webhooks on threshold breaches.',
    },
    servers: [
      {
        url: serverUrl,
      },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Human-readable error message',
            },
          },
          required: ['message'],
        },
        Subscription: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            label: { type: 'string' },
            lat: { type: 'number' },
            lon: { type: 'number' },
            metric: {
              type: 'string',
              enum: ['rain_probability', 'temp_max', 'temp_min', 'wind_speed'],
            },
            operator: {
              type: 'string',
              enum: ['>', '<', '>=', '<='],
            },
            threshold: { type: 'number' },
            webhookUrl: { type: 'string', format: 'uri' },
            active: { type: 'boolean' },
            lastTriggeredAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            cooldownMinutes: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AlertLog: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            subscription: { type: 'string' },
            triggeredAt: { type: 'string', format: 'date-time' },
            metric: { type: 'string' },
            value: { type: 'number' },
            threshold: { type: 'number' },
            operator: { type: 'string' },
            webhookStatus: {
              type: 'string',
              enum: ['success', 'failed'],
            },
            webhookResponseCode: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  // Forward slashes required so glob matches on Windows
  apis: [path.join(__dirname, '../routes/*.js').replace(/\\/g, '/')],
});

export default swaggerSpec;
