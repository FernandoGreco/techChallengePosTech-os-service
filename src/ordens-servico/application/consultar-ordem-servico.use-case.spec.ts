import { NotFoundException } from '@nestjs/common';
import { StatusOS } from '../domain/status-os';
import { ConsultarOrdemServicoUseCase } from './consultar-ordem-servico.use-case';
import type { OrdensServicoRepository } from './ordens-servico.repository';

describe('ConsultarOrdemServicoUseCase', () => {
  const buscarPorId = jest.fn();
  const repository: OrdensServicoRepository = {
    abrir: jest.fn(),
    buscarPorId,
    registrarDiagnostico: jest.fn(),
  };
  const useCase = new ConsultarOrdemServicoUseCase(repository);
  const ordem = {
    id: 'os-1',
    numero: 1,
    clienteId: 'cliente-1',
    veiculoId: 'veiculo-1',
    status: StatusOS.RECEBIDA,
    diagnostico: null,
    dataCriacao: new Date('2026-01-01T10:00:00.000Z'),
    cliente: { id: 'cliente-1', nome: 'Ana' },
    veiculo: {
      id: 'veiculo-1',
      placa: 'ABC1D23',
      marca: 'Marca',
      modelo: 'Modelo',
      ano: 2020,
    },
    historico: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    buscarPorId.mockResolvedValue(ordem);
  });

  it('permite consulta pelo proprietário', async () => {
    await expect(
      useCase.execute('os-1', { id: 'cliente-1', tipo: 'cliente' }),
    ).resolves.toEqual(ordem);
  });

  it('oculta OS de outro cliente como não encontrada', async () => {
    await expect(
      useCase.execute('os-1', { id: 'cliente-2', tipo: 'cliente' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('permite staff consultar status e retorna apenas os campos necessários', async () => {
    await expect(
      useCase.consultarStatus('os-1', {
        id: 'staff-1',
        tipo: 'staff',
        papel: 'ADMIN',
      }),
    ).resolves.toEqual({
      id: 'os-1',
      numero: 1,
      status: StatusOS.RECEBIDA,
      dataCriacao: ordem.dataCriacao,
    });
  });
});
