const { MongoClient } = require('mongodb');

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).trim().toLowerCase() === 'true';
}

function parseIntOrDefault(value, defaultValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function toText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function databaseFromUri(uri) {
  try {
    const parsed = new URL(uri);
    const path = decodeURIComponent(parsed.pathname || '').replace(/^\/+/, '').trim();
    return path.length > 0 ? path : null;
  } catch (_error) {
    return null;
  }
}

function resolveMongoConfig(env) {
  const config = env || process.env;
  const enabled = parseBoolean(config.MONGODB_ENABLED, true);
  const required = parseBoolean(config.MONGODB_REQUIRED, true);
  const configuredDatabase = toText(config.MONGODB_DATABASE);
  const appName = toText(config.MONGODB_APP_NAME) || 'customer-service';
  const serverSelectionTimeoutMS = parseIntOrDefault(config.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 5000);
  const maxPoolSize = parseIntOrDefault(config.MONGODB_MAX_POOL_SIZE, 10);
  const minPoolSize = parseIntOrDefault(config.MONGODB_MIN_POOL_SIZE, 0);
  const writeConcern = toText(config.MONGODB_WRITE_CONCERN) || 'majority';
  const writeTimeoutMS = parseIntOrDefault(config.MONGODB_WRITE_TIMEOUT_MS, 5000);
  const journal = parseBoolean(config.MONGODB_JOURNAL, true);

  const directConnectionSetting = config.MONGODB_DIRECT_CONNECTION;
  const directConnection = parseBoolean(directConnectionSetting, true);
  const providedUri = toText(config.MONGODB_URI);
  if (providedUri) {
    const database = configuredDatabase || databaseFromUri(providedUri) || 'customerdb';
    return {
      enabled,
      required,
      database,
      uri: providedUri,
      appName,
      maxPoolSize,
      minPoolSize,
      serverSelectionTimeoutMS,
      writeConcern,
      writeTimeoutMS,
      journal,
      hostSummary: 'MONGODB_URI'
    };
  }

  const database = configuredDatabase || 'customerdb';
  const host = toText(config.MONGODB_HOST) || 'localhost';
  const port = parseIntOrDefault(config.MONGODB_PORT, 27017);
  const username = toText(config.MONGODB_USER) || toText(config.MONGODB_INITDB_ROOT_USERNAME) || 'admin';
  const password = toText(config.MONGODB_PASSWORD) || toText(config.MONGODB_INITDB_ROOT_PASSWORD) || 'RedHat#123';
  const authSource = toText(config.MONGODB_AUTH_SOURCE) || (username ? 'admin' : null);

  const credentials = username && password
    ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
    : '';

  const queryParts = [];
  if (authSource) {
    queryParts.push(`authSource=${encodeURIComponent(authSource)}`);
  }
  if (directConnectionSetting !== undefined && directConnectionSetting !== null && directConnectionSetting !== '') {
    queryParts.push(`directConnection=${directConnection ? 'true' : 'false'}`);
  }

  const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  const uri = `mongodb://${credentials}${host}:${port}/${encodeURIComponent(database)}${query}`;

  return {
    enabled,
    required,
    database,
    uri,
    appName,
    maxPoolSize,
    minPoolSize,
    serverSelectionTimeoutMS,
    writeConcern,
    writeTimeoutMS,
    journal,
    hostSummary: `${host}:${port}`
  };
}

function createMongoClient(config) {
  return new MongoClient(config.uri, {
    appName: config.appName,
    maxPoolSize: config.maxPoolSize,
    minPoolSize: config.minPoolSize,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
    writeConcern: {
      w: config.writeConcern,
      wtimeoutMS: config.writeTimeoutMS,
      j: config.journal
    }
  });
}

module.exports = { resolveMongoConfig, createMongoClient };
