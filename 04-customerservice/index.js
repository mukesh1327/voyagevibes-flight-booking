const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { createApp } = require('./src/api/app');
const { CustomerService } = require('./src/application/customerService');
const { InMemoryUserRepository } = require('./src/infrastructure/inMemoryUserRepository');
const { InMemoryNotificationRepository } = require('./src/infrastructure/inMemoryNotificationRepository');
const { InMemoryEventLedgerRepository } = require('./src/infrastructure/inMemoryEventLedgerRepository');
const { resolveMongoConfig, createMongoClient } = require('./src/infrastructure/mongo/mongoConfig');
const {
  MongoUserRepository,
  MongoNotificationRepository,
  MongoEventLedgerRepository
} = require('./src/infrastructure/mongo/mongoRepositories');
const { loadKafkaConfig } = require('./src/infrastructure/kafka/kafkaConfig');
const { CustomerSyncKafkaRuntime } = require('./src/infrastructure/kafka/customerSyncKafkaRuntime');

function firstExistingDirectory(candidates) {
  for (const directory of candidates) {
    if (fs.existsSync(directory)) {
      return directory;
    }
  }
  return null;
}

function normalizeHost(value, fallback) {
  if (!value) {
    return fallback;
  }

  const raw = String(value).trim();
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
    return parsed.hostname || fallback;
  } catch (_error) {
    return raw.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0] || fallback;
  }
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).trim().toLowerCase() === 'true';
}

function resolveServerConfig(env) {
  const parsedHttpPort = Number(env.HTTP_PORT || env.PORT || env.SERVER_PORT || 8084);
  const httpPort = Number.isFinite(parsedHttpPort) && parsedHttpPort > 0 ? parsedHttpPort : 8084;
  const parsedHttpsPort = Number(env.HTTPS_PORT || 9094);
  const httpsPort = Number.isFinite(parsedHttpsPort) && parsedHttpsPort > 0 ? parsedHttpsPort : 9094;
  const sslEnabled = parseBoolean(env.SERVER_SSL_ENABLED ?? env.HTTPS_ENABLED, true);
  const listenHost = env.SERVER_HOST || env.LISTEN_HOST || '0.0.0.0';
  const publicHost = normalizeHost(env.PUBLIC_HOST || env.PUBLIC_BASE_URL || env.SERVICE_PUBLIC_URL, 'customer.voyagevibes.in');
  const certHost = normalizeHost(env.SERVER_SSL_CERT_HOST, publicHost);
  const certBaseName = env.SERVER_SSL_CERT_BASENAME || certHost;
  const certDirValue = env.SERVER_SSL_CERT_DIR || env.TLS_CERT_DIR;
  const configuredCertDir = certDirValue ? path.resolve(certDirValue) : null;
  const certDirectory = configuredCertDir || firstExistingDirectory([
    path.resolve(__dirname, '../00-localhost-certs'),
    path.resolve(__dirname, '../00-localtest-certs')
  ]);
  const defaultCertPath = certDirectory ? path.join(certDirectory, `${certBaseName}.crt.pem`) : null;
  const defaultKeyPath = certDirectory ? path.join(certDirectory, `${certBaseName}.key.pem`) : null;

  return {
    httpPort,
    httpsPort,
    sslEnabled,
    listenHost,
    publicHost,
    certBaseName,
    certDirectory,
    certPath: env.SERVER_SSL_CERTIFICATE || defaultCertPath,
    keyPath: env.SERVER_SSL_CERTIFICATE_PRIVATE_KEY || defaultKeyPath
  };
}

function createServers(app, config) {
  const servers = [
    {
      protocol: 'http',
      port: config.httpPort,
      server: http.createServer(app)
    }
  ];

  if (!config.sslEnabled) {
    return servers;
  }

  if (!config.certPath || !config.keyPath) {
    throw new Error(
      `TLS cert/key not found for ${config.certBaseName}. ` +
      'Set SERVER_SSL_CERTIFICATE and SERVER_SSL_CERTIFICATE_PRIVATE_KEY, ' +
      'or place cert files in ../00-localhost-certs (preferred) or ../00-localtest-certs.'
    );
  }

  if (!fs.existsSync(config.certPath) || !fs.existsSync(config.keyPath)) {
    throw new Error(
      `TLS cert files missing. cert=${config.certPath}, key=${config.keyPath}. ` +
      `Expected ${config.certBaseName}.crt.pem and ${config.certBaseName}.key.pem in cert directory.`
    );
  }

  servers.push({
    protocol: 'https',
    port: config.httpsPort,
    server: https.createServer(
      {
        cert: fs.readFileSync(config.certPath),
        key: fs.readFileSync(config.keyPath),
      },
      app,
    )
  });

  return servers;
}

async function listen(servers, config) {
  await Promise.all(servers.map(({ server, port }) => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, config.listenHost, () => {
      resolve();
    });
  })));

  console.log(`customer-service http listening on http://${config.publicHost}:${config.httpPort}`);
  if (config.sslEnabled) {
    console.log(`customer-service https listening on https://${config.publicHost}:${config.httpsPort}`);
    console.log(`customer-service tls certs loaded from: ${path.dirname(config.certPath)}`);
  }
}

function buildInMemoryService() {
  return new CustomerService(
    new InMemoryUserRepository(),
    new InMemoryNotificationRepository(),
    new InMemoryEventLedgerRepository(),
    undefined,
    createIdentityProfileProvider(process.env)
  );
}

function resolveAuthServiceBaseUrl(env) {
  return (env.AUTHSERVICE_BASE_URL || env.AUTH_SERVICE_BASE_URL || 'http://auth-service:8081').trim();
}

function createIdentityProfileProvider(env) {
  const baseUrl = resolveAuthServiceBaseUrl(env).replace(/\/+$/, '');

  return async (userId) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`${baseUrl}/api/v1/users/me`, {
        method: 'GET',
        headers: {
          'X-User-Id': userId,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      return {
        userId: payload.userId,
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        mobile: payload.mobile,
        mobileVerified: payload.mobileVerified,
      };
    } catch (_error) {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };
}

async function buildPersistence(env, logger) {
  const mongoConfig = resolveMongoConfig(env);
  if (!mongoConfig.enabled) {
    return {
      service: buildInMemoryService(),
      storage: 'in-memory',
      stop: async () => {}
    };
  }

  const client = createMongoClient(mongoConfig);

  try {
    await client.connect();
    const database = client.db(mongoConfig.database);
    const userRepository = new MongoUserRepository(database.collection('users'));
    const notificationRepository = new MongoNotificationRepository(database.collection('notifications'));
    const eventLedgerRepository = new MongoEventLedgerRepository(database.collection('sync_event_ledger'));

    await Promise.all([
      userRepository.init(),
      notificationRepository.init(),
      eventLedgerRepository.init()
    ]);

    logger.log(`customer-service mongodb connected (${mongoConfig.hostSummary}, db=${mongoConfig.database})`);

    return {
      service: new CustomerService(
        userRepository,
        notificationRepository,
        eventLedgerRepository,
        undefined,
        createIdentityProfileProvider(env)
      ),
      storage: 'mongodb',
      stop: async () => {
        await client.close();
      }
    };
  } catch (error) {
    await client.close().catch(() => {});
    if (mongoConfig.required) {
      throw new Error(`mongodb startup failed: ${error.message}`);
    }

    logger.error(`mongodb unavailable, using in-memory fallback: ${error.message}`);
    return {
      service: buildInMemoryService(),
      storage: 'in-memory',
      stop: async () => {}
    };
  }
}

function registerSignalHandlers(servers, kafkaRuntime, persistence) {
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    console.log(`customer-service shutdown signal: ${signal}`);

    try {
      await kafkaRuntime.stop();
    } catch (error) {
      console.error(`failed stopping kafka runtime: ${error.message}`);
    }

    try {
      await persistence.stop();
    } catch (error) {
      console.error(`failed stopping persistence runtime: ${error.message}`);
    }

    await Promise.all(servers.map(({ server }) => new Promise((resolve) => {
      server.close(() => resolve());
    })));

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function bootstrap() {
  const persistence = await buildPersistence(process.env, console);
  const app = createApp({ service: persistence.service });
  const service = persistence.service;
  const serverConfig = resolveServerConfig(process.env);
  const kafkaConfig = loadKafkaConfig(process.env);
  const kafkaRuntime = new CustomerSyncKafkaRuntime(service, kafkaConfig, console);
  const servers = createServers(app, serverConfig);

  await listen(servers, serverConfig);

  try {
    await kafkaRuntime.start();
  } catch (error) {
    service.setKafkaEnabled(false);
    if (kafkaConfig.required) {
      throw error;
    }
    console.error(`kafka disabled after startup failure: ${error.message}`);
  }

  console.log(`customer-service storage mode: ${persistence.storage}`);
  registerSignalHandlers(servers, kafkaRuntime, persistence);
}

bootstrap().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
