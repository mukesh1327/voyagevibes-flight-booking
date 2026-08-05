import https from 'node:https';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const ISSUER = process.env.KEYCLOAK_ISSUER || 'https://keycloak.voyagevibes.in:8091/realms/flight-booking';
const JWKS_URI = process.env.KEYCLOAK_JWKS_URI || 'https://keycloak:8091/realms/flight-booking/protocol/openid-connect/certs';

// The realm's certificate is self-signed in this local/demo deployment.
const jwks = jwksClient({
  jwksUri: JWKS_URI,
  requestAgent: new https.Agent({ rejectUnauthorized: false }),
});

const getSigningKey = (header, callback) => {
  jwks.getSigningKey(header.kid, (error, key) => {
    if (error) {
      callback(error);
      return;
    }
    callback(null, key.getPublicKey());
  });
};

// Trusts the caller's identity and roles only once they've been read out of a Keycloak-signed
// token, instead of taking the x-user-id/x-user-roles headers a caller could set to anything.
export const requireUser = (request, response, next) => {
  const authHeader = request.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    response.status(401).json({ message: 'Missing bearer token' });
    return;
  }

  jwt.verify(token, getSigningKey, { issuer: ISSUER, algorithms: ['RS256'] }, (error, decoded) => {
    if (error) {
      response.status(401).json({ message: 'Invalid or expired token' });
      return;
    }
    request.userId = decoded.sub;
    request.userRoles = parseRealmRoles(decoded);
    next();
  });
};

export const requireAnyRole = (...allowedRoles) => (request, response, next) => {
  const roles = request.userRoles || new Set();
  const canAccess = allowedRoles.some((role) => roles.has(role));

  if (!canAccess) {
    response.status(403).json({ message: `${allowedRoles.join(' or ')} role is required` });
    return;
  }

  next();
};

export function parseRealmRoles(decoded) {
  const roles = decoded.realm_access?.roles || [];
  return new Set(roles.map((role) => String(role).toLowerCase()));
}
