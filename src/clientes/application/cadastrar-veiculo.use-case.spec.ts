import { BadRequestException } from '@nestjs/common';
import { CadastrarVeiculoUseCase } from './cadastrar-veiculo.use-case';
import type { ClientesRepository } from './clientes.repository';

describe('CadastrarVeiculoUseCase', () => {
  const cadastrarVeiculo = jest.fn();
  const repository: ClientesRepository = {
    cadastrar: jest.fn(),
    cadastrarVeiculo,
    buscarPorCpf: jest.fn(),
  };
  const useCase = new CadastrarVeiculoUseCase(repository);

  beforeEach(() => {
    jest.clearAllMocks();
    cadastrarVeiculo.mockResolvedValue({
      id: 'veiculo-1',
      clienteId: 'cliente-1',
      placa: 'ABC1D23',
      marca: 'Marca',
      modelo: 'Modelo',
      ano: 2020,
    });
  });

  it('normaliza placa e descrição antes de persistir', async () => {
    await useCase.execute({
      clienteId: 'cliente-1',
      placa: 'abc-1d23',
      marca: ' Marca ',
      modelo: ' Modelo ',
      ano: 2020,
    });

    expect(cadastrarVeiculo).toHaveBeenCalledWith({
      clienteId: 'cliente-1',
      placa: 'ABC1D23',
      marca: 'Marca',
      modelo: 'Modelo',
      ano: 2020,
    });
  });

  it('rejeita placa inválida', () => {
    expect(() =>
      useCase.execute({
        clienteId: 'cliente-1',
        placa: 'invalid',
        marca: 'Marca',
        modelo: 'Modelo',
        ano: 2020,
      }),
    ).toThrow(BadRequestException);
  });
});
