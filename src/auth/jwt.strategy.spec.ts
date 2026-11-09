import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const secret = 'test-jwt-secret-with-more-than-32-characters';
  let strategy: JwtStrategy;

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    strategy = new JwtStrategy();
  });

  it('converte token da Lambda em principal cliente', () => {
    expect(
      strategy.validate({
        sub: 'cliente-1',
        iss: 'oficina-auth-lambda',
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toEqual({ id: 'cliente-1', tipo: 'cliente' });
  });

  it('converte token interno com papel permitido em principal staff', () => {
    expect(
      strategy.validate({
        sub: 'staff-1',
        iss: 'oficina-staff',
        papel: 'MECANICO',
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toEqual({
      id: 'staff-1',
      tipo: 'staff',
      papel: 'MECANICO',
    });
  });

  it('rejeita emissor e papel desconhecidos', () => {
    expect(() =>
      strategy.validate({
        sub: 'staff-1',
        iss: 'issuer-unknown',
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toThrow(UnauthorizedException);
    expect(() =>
      strategy.validate({
        sub: 'staff-1',
        iss: 'oficina-staff',
        papel: 'CLIENTE',
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toThrow(UnauthorizedException);
  });

  it('rejeita claims sem subject ou expiração', () => {
    expect(() => strategy.validate({ iss: 'oficina-auth-lambda' })).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      strategy.validate({ sub: 'cliente-1', iss: 'oficina-auth-lambda' }),
    ).toThrow(UnauthorizedException);
  });

  it('não inicia sem segredo forte configurado', () => {
    const previousSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    expect(() => new JwtStrategy()).toThrow('JWT_SECRET');

    process.env.JWT_SECRET = previousSecret;
  });
});
