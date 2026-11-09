const databaseUrl =
  process.env.OS_SERVICE_INTEGRATION_DATABASE_URL ??
  'postgresql://os_service:os_local_only@127.0.0.1:5433/os_service?schema=public';
const database = new URL(databaseUrl);
const databaseName = decodeURIComponent(database.pathname.slice(1));

if (
  !['localhost', '127.0.0.1', '::1'].includes(database.hostname) ||
  !databaseName.startsWith('os_service')
) {
  throw new Error(
    'Integration tests only run against a local database named os_service*',
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = 'os-service-integration-jwt-secret-over-32-characters';
process.env.INTERNAL_API_TOKEN =
  'os-service-integration-internal-token-over-32-characters';
