import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { config } from './config/index.js';
import { allowedTransitions } from './models/bookingStatus.js';
import { bookingRoutes } from './routes/bookingRoutes.js';
import { validateBooking } from './services/bookingValidation.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ status: 'UP', service: 'booking-service' });
});

app.get('/bookings/health', (_request, response) => {
  response.json({ status: 'UP', service: 'booking-service' });
});

app.use(bookingRoutes);

app.use((error, _request, response, _next) => {
  console.error('booking-service error', error);
  response.status(error.status || 500).json({
    message: error.status ? error.message : 'Unexpected booking-service error',
  });
});

async function start() {
  await mongoose.connect(config.mongoUri);
  app.listen(config.port, () => {
    console.log(`booking-service listening on ${config.port}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error) => {
    console.error('Failed to start booking-service', error);
    process.exit(1);
  });
}

export { allowedTransitions, app, start, validateBooking };
