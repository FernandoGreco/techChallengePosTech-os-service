import { BadRequestException } from '@nestjs/common';
import type { PrincipalAutenticado } from '../../auth/principal';
import { AbrirOrdemServicoUseCase } from './abrir-ordem-servico.use-case';
import type { OrdensServicoRepository } from './ordens-servico.repository';

describe('AbrirOrdemServicoUseCase', () => {
  const abrir = jest.fn();
  const repository: OrdensServicoRepository = {
    abrir,
    buscarPorId: jest.fn(),
    registrarDiagnostico: jest.fn(),
  };
  const useCase = new AbrirOrdemServicoUseCase(repository);

  beforeEach(() => {
    jest.clearAllMocks();
    abrir.mockResolvedValue({ id: 'os-1' });
  });

  it('usa o cliente autenticado, mesmo que o comando traga outro cliente', async () => {
    const principal: PrincipalAutenticado = {
      id: 'cliente-autenticado',
      tipo: 'cliente',
    };

    await useCase.execute({
      clienteId: 'cliente-informado',
      veiculoId: 'veiculo-1',
      principal,
    });

    expect(abrir).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 'cliente-autenticado',
        veiculoId: 'veiculo-1',
      }),
    );
  });

  it('exige clienteId para abertura por staff', () => {
    expect(() =>
      useCase.execute({
        veiculoId: 'veiculo-1',
        principal: { id: 'staff-1', tipo: 'staff', papel: 'ADMIN' },
      }),
    ).toThrow(BadRequestException);
  });
});
