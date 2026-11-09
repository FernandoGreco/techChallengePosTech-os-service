import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { PAPEIS_PERMITIDOS_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const handler = () => undefined;

  it('permite acesso quando não há restrição de papel', () => {
    const context = new ExecutionContextHost(
      [{ user: { id: 'cliente-1', tipo: 'cliente' } }],
      Object,
      handler,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('exige staff com papel permitido', () => {
    Reflect.defineMetadata(PAPEIS_PERMITIDOS_KEY, ['ADMIN'], handler);
    const staffContext = new ExecutionContextHost(
      [{ user: { id: 'staff-1', tipo: 'staff', papel: 'ADMIN' } }],
      Object,
      handler,
    );
    const customerContext = new ExecutionContextHost(
      [{ user: { id: 'cliente-1', tipo: 'cliente' } }],
      Object,
      handler,
    );

    expect(guard.canActivate(staffContext)).toBe(true);
    expect(guard.canActivate(customerContext)).toBe(false);
  });
});
