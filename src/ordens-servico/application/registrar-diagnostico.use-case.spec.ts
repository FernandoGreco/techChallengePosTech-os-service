import { ForbiddenException } from '@nestjs/common';
import { RegistrarDiagnosticoUseCase } from './registrar-diagnostico.use-case';
import type { OrdensServicoRepository } from './ordens-servico.repository';

describe('RegistrarDiagnosticoUseCase', () => {
  const registrarDiagnostico = jest.fn();
  const repository: OrdensServicoRepository = {
    abrir: jest.fn(),
    buscarPorId: jest.fn(),
    registrarDiagnostico,
  };
  const useCase = new RegistrarDiagnosticoUseCase(repository);

  beforeEach(() => {
    jest.clearAllMocks();
    registrarDiagnostico.mockResolvedValue({ id: 'os-1' });
  });

  it('permite mecânico e remove espaços excedentes do diagnóstico', async () => {
    await useCase.execute({
      ordemServicoId: 'os-1',
      diagnostico: '  Falha identificada  ',
      principal: { id: 'staff-1', tipo: 'staff', papel: 'MECANICO' },
    });

    expect(registrarDiagnostico).toHaveBeenCalledWith({
      ordemServicoId: 'os-1',
      diagnostico: 'Falha identificada',
    });
  });

  it('rejeita clientes e atendentes', () => {
    expect(() =>
      useCase.execute({
        ordemServicoId: 'os-1',
        diagnostico: 'Falha identificada',
        principal: { id: 'cliente-1', tipo: 'cliente' },
      }),
    ).toThrow(ForbiddenException);
    expect(() =>
      useCase.execute({
        ordemServicoId: 'os-1',
        diagnostico: 'Falha identificada',
        principal: { id: 'staff-1', tipo: 'staff', papel: 'ATENDENTE' },
      }),
    ).toThrow(ForbiddenException);
  });
});
