import { validarAmbiente } from './env.validation';

const ambienteValido = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/os_service',
  JWT_SECRET: 'test-jwt-secret-with-more-than-32-characters',
  INTERNAL_API_TOKEN: 'test-internal-token-with-more-than-32-characters',
};

describe('validarAmbiente', () => {
  it('retorna a configuração quando todas as variáveis obrigatórias são válidas', () => {
    expect(validarAmbiente(ambienteValido)).toBe(ambienteValido);
  });

  it('rejeita banco ausente ou fora de PostgreSQL', () => {
    expect(() =>
      validarAmbiente({ ...ambienteValido, DATABASE_URL: '' }),
    ).toThrow('DATABASE_URL');
    expect(() =>
      validarAmbiente({
        ...ambienteValido,
        DATABASE_URL: 'mysql://localhost/os',
      }),
    ).toThrow('DATABASE_URL');
  });

  it('rejeita segredo JWT ausente ou curto', () => {
    expect(() =>
      validarAmbiente({ ...ambienteValido, JWT_SECRET: undefined }),
    ).toThrow('JWT_SECRET');
    expect(() =>
      validarAmbiente({ ...ambienteValido, JWT_SECRET: 'short' }),
    ).toThrow('JWT_SECRET');
  });

  it('rejeita token interno ausente ou curto', () => {
    expect(() =>
      validarAmbiente({ ...ambienteValido, INTERNAL_API_TOKEN: undefined }),
    ).toThrow('INTERNAL_API_TOKEN');
    expect(() =>
      validarAmbiente({ ...ambienteValido, INTERNAL_API_TOKEN: 'short' }),
    ).toThrow('INTERNAL_API_TOKEN');
  });
});
