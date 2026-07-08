export const config = Object.freeze({
  port: Number(process.env.PORT || 8084),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bookingdb',
  flightServiceUrl: (process.env.FLIGHT_SERVICE_URL || 'http://localhost:8083').replace(/\/$/, ''),
});
