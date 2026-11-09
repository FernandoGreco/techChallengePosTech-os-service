import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InternalTokenGuard } from './internal-token.guard';

describe('InternalTokenGuard', () => {
  const guard = new InternalTokenGuard();
  const expectedToken = 'test-internal-token-with-more-than-32-characters';

  beforeEach(() => {
    process.env.INTERNAL_API_TOKEN = expectedToken;
  });

  it('autoriza a credencial serviço-a-serviço correta', () => {
    const request = {
      header: jest.fn().mockReturnValue(expectedToken),
    };

    expect(guard.canActivate(new ExecutionContextHost([request]))).toBe(true);
  });

  it('rejeita credencial ausente ou incorreta', () => {
    const semToken = { header: jest.fn().mockReturnValue(undefined) };
    const tokenIncorreto = { header: jest.fn().mockReturnValue('invalid') };

    expect(() =>
      guard.canActivate(new ExecutionContextHost([semToken])),
    ).toThrow(UnauthorizedException);
    expect(() =>
      guard.canActivate(new ExecutionContextHost([tokenIncorreto])),
    ).toThrow(UnauthorizedException);
  });

  it('falha explicitamente quando a credencial não está configurada', () => {
    const previousToken = process.env.INTERNAL_API_TOKEN;
    delete process.env.INTERNAL_API_TOKEN;
    const request = { header: jest.fn().mockReturnValue(expectedToken) };

    expect(() =>
      guard.canActivate(new ExecutionContextHost([request])),
    ).toThrow(ServiceUnavailableException);

    process.env.INTERNAL_API_TOKEN = previousToken;
  });
});
