export const config = Object.freeze({
  port: Number(process.env.PORT || 8084),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bookingdb',
  flightServiceUrl: (process.env.FLIGHT_SERVICE_URL || 'http://localhost:8083').replace(/\/$/, ''),
  paymentServiceUrl: (process.env.PAYMENT_SERVICE_URL || 'http://localhost:8085').replace(/\/$/, ''),
  keycloakTokenUrl: process.env.KEYCLOAK_TOKEN_URL
    || 'https://keycloak:8091/realms/flight-booking/protocol/openid-connect/token',
  keycloakServiceClientId: process.env.KEYCLOAK_SERVICE_CLIENT_ID || 'flight-auth-admin',
  keycloakServiceClientSecret: process.env.KEYCLOAK_SERVICE_CLIENT_SECRET || 'CorpWebSecret123$',
});
