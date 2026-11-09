export function validarAmbiente(
  config: Record<string, string | undefined>,
): Record<string, string | undefined> {
  if (!config.DATABASE_URL?.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL deve apontar para PostgreSQL');
  }
  if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres');
  }
  if (!config.INTERNAL_API_TOKEN || config.INTERNAL_API_TOKEN.length < 32) {
    throw new Error('INTERNAL_API_TOKEN deve ter pelo menos 32 caracteres');
  }
  return config;
}
