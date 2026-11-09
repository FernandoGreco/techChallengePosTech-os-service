import { BadRequestException } from '@nestjs/common';
import { ConsultarClientePorCpfUseCase } from './consultar-cliente-por-cpf.use-case';
import type { ClientesRepository } from './clientes.repository';

describe('ConsultarClientePorCpfUseCase', () => {
  const buscarPorCpf = jest.fn();
  const repository: ClientesRepository = {
    cadastrar: jest.fn(),
    cadastrarVeiculo: jest.fn(),
    buscarPorCpf,
  };
  const useCase = new ConsultarClientePorCpfUseCase(repository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normaliza o CPF antes da consulta', async () => {
    buscarPorCpf.mockResolvedValue({ clienteId: 'cliente-1', ativo: true });

    await useCase.execute('529.982.247-25');

    expect(buscarPorCpf).toHaveBeenCalledWith('52998224725');
  });

  it('rejeita CPF inválido sem consultar o repositório', () => {
    expect(() => useCase.execute('111.111.111-11')).toThrow(
      BadRequestException,
    );
    expect(buscarPorCpf).not.toHaveBeenCalled();
  });
});
