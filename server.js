/**
 * HTTP server bootstrap — loads env, connects dependencies, starts listening.
 * @module server
 */

import 'dotenv/config';
import app from './app.js';
import { connectDb as connectDB } from './utils/db.js';
import redisClient from './utils/redisClient.js';
import { startPollingJob } from './jobs/pollWeatherJob.js';

/**
 * Start the weather-alert-service HTTP server.
 * @returns {Promise<void>}
 */
async function start() {
  await connectDB();
  // redisClient is connected via module import above
  startPollingJob();

  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => {
    console.log(
      `weather-alert-service listening on port ${port} — docs at http://localhost:${port}/docs`,
    );
  });
}

start();
