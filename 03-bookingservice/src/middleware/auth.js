export const requireUser = (request, response, next) => {
  const authHeader = request.header('authorization');
  if (!authHeader) {
    response.status(401).json({ message: 'Missing Authorization header' });
    return;
  }

  request.userId = request.header('x-user-id') || 'local-dev-user';
  next();
};

export const requireAnyRole = (...allowedRoles) => (request, response, next) => {
  const roles = parseRoles(request.header('x-user-roles'));
  const canAccess = allowedRoles.some((role) => roles.has(role));

  if (!canAccess) {
    response.status(403).json({ message: `${allowedRoles.join(' or ')} role is required` });
    return;
  }

  next();
};

export function parseRoles(headerValue = '') {
  return new Set(
    headerValue
      .split(',')
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean),
  );
}
